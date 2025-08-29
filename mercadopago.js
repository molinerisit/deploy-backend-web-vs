// backend/mercadopago.js (ESM)
// Wrapper independiente del SDK: usa fetch contra la API de Mercado Pago.
// Mantiene las mismas firmas/export que usa tu server.js.

let _accessToken = null;
let _isConfigured = false;

function ensureConfigured() {
  if (!_isConfigured || !_accessToken) {
    throw new Error("Mercado Pago no fue inicializado");
  }
}

function normalizeHttpsOrWarn(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") {
      console.warn("[MP] back_url no es https; Mercado Pago podría rechazarla:", url);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function normalizeHttps(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function initializeMercadoPago(accessToken) {
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN requerido");
  _accessToken = accessToken;
  _isConfigured = true;
  console.log("[MP] Inicializado (HTTP wrapper).");
}

/**
 * Crea una suscripción (preapproval) directa para un usuario.
 * @param {Object} p
 *  - userId (number | string)
 *  - plan: "single" | "multi"
 *  - payerEmail: string
 *  - backUrl: string (idealmente HTTPS público)
 *  - currency: string (ej. "ARS")
 *  - amount: number
 */
export async function createSubscriptionDirect(p) {
  ensureConfigured();

  const {
    userId,
    plan,
    payerEmail,
    backUrl,
    currency = "ARS",
    amount = 0,
  } = p || {};

  if (!userId) throw new Error("userId requerido");
  if (!["single", "multi"].includes(plan)) throw new Error("plan inválido");
  if (!payerEmail) throw new Error("payerEmail requerido");
  if (!amount || amount <= 0) throw new Error("amount inválido");
  if (!currency) throw new Error("currency requerido");

  // back_url: si no es https, no abortamos; la pasamos con warning.
  const normalizedBack = normalizeHttpsOrWarn(backUrl);

  // notification_url: sólo si es https válida
  const webhookBase = process.env.WEBHOOK_PUBLIC_URL || process.env.PUBLIC_RETURN_URL_BASE;
  const notificationUrl = normalizeHttps(
    webhookBase ? `${webhookBase.replace(/\/+$/, "")}/webhook` : null
  );

  const payload = {
    reason: `Licencia ${plan}`,
    external_reference: String(userId),
    payer_email: payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: Number(amount),
      currency_id: String(currency).toUpperCase(),
    },
  };
  if (normalizedBack) payload.back_url = normalizedBack;
  if (notificationUrl) payload.notification_url = notificationUrl;

  console.log("[MP] create preapproval", {
    reason: payload.reason,
    payer_email: payload.payer_email,
    amount: payload.auto_recurring.transaction_amount,
    currency: payload.auto_recurring.currency_id,
    back_url: payload.back_url,
  });

  const resp = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${_accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("[MP] Error create preapproval:", resp.status, body);
    const e = new Error(body?.message || "No se pudo crear la preaprobación");
    e.status = resp.status;
    e.cause = body;
    throw e;
  }

  const id = body?.id;
  const init_point = body?.init_point;
  if (!id || !init_point) {
    console.error("[MP] Respuesta inesperada:", body);
    const e = new Error("No se pudo crear la preaprobación");
    e.status = 502;
    throw e;
  }

  console.log("[MP] preapproval created", { id, init_point });
  return { init_point, mpPreapprovalId: id };
}

/** Obtiene una preaprobación por ID */
export async function getPreapprovalById(id) {
  ensureConfigured();
  if (!id) throw new Error("preapproval id requerido");

  const resp = await fetch(
    `https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${_accessToken}` } }
  );

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(json?.message || "Error al obtener preapproval");
    e.status = resp.status;
    throw e;
  }
  return json;
}

async function updatePreapprovalStatus(id, status) {
  ensureConfigured();
  if (!id) throw new Error("preapproval id requerido");

  const resp = await fetch(
    `https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${_accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  );

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(json?.message || "Error al actualizar preapproval");
    e.status = resp.status;
    throw e;
  }
  return json;
}

/** Cambiar estado a cancelled */
export async function cancelPreapproval(id) {
  return updatePreapprovalStatus(id, "cancelled");
}

/** Cambiar estado a paused */
export async function pausePreapproval(id) {
  return updatePreapprovalStatus(id, "paused");
}

/** Cambiar estado a authorized (reanudar) */
export async function resumePreapproval(id) {
  return updatePreapprovalStatus(id, "authorized");
}
