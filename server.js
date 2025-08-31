// backend/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { buildStatsRouter } from "./stats-routes.js";

// Sync (loader dinámico, se activa con SYNC_API_ENABLED=1)
import { registerSyncRoutes } from "./sync-loader.js";

import { sequelize, User, License } from "./models.js";
import {
  initializeMercadoPago,
  createSubscriptionDirect,
  getPreapprovalById,
  cancelPreapproval,
  pausePreapproval,
  resumePreapproval,
} from "./mercadopago.js";
import { authMiddleware } from "./auth.js";
import { signLicenseJWS, getPublicKeyPem } from "./license-sign.js";

/* =========================
   Config & helpers
========================= */
const app = express();

// CORS
const allowOrigins = (process.env.ALLOW_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowOrigins.length ? allowOrigins : true,
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.set("trust proxy", 1);
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const FRONTEND_URL =
  process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
const PUBLIC_RETURN_URL_BASE = process.env.PUBLIC_RETURN_URL_BASE; // ej: https://tu-backend.com
const WEBHOOK_PUBLIC_URL = process.env.WEBHOOK_PUBLIC_URL; // fallback de base pública
const SYNC_ENABLED = process.env.SYNC_API_ENABLED === "1";

if (!JWT_SECRET) {
  console.error("Falta JWT_SECRET");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
if (!MP_ACCESS_TOKEN) {
  console.error("Falta MP_ACCESS_TOKEN");
  process.exit(1);
}

// Inicializar SDK MP (wrapper HTTP en mercadopago.js)
initializeMercadoPago(MP_ACCESS_TOKEN);

// DB
await sequelize.authenticate().catch((err) => {
  console.error("Error DB:", err);
  process.exit(1);
});
await sequelize.sync();
console.log("DB lista");
app.use("/stats", buildStatsRouter());

// Montar rutas de /sync si está habilitado por env
registerSyncRoutes(app);

// JWT
const signJWT = (u) =>
  jwt.sign({ id: u.id, email: u.email, role: u.role }, JWT_SECRET, {
    expiresIn: "7d",
  });

// Helpers URL
function ensureAbsoluteUrl(input, fallback = "http://localhost:5173") {
  try {
    return new URL(input).toString();
  } catch {
    try {
      return new URL(
        /^https?:\/\//i.test(input) ? input : `https://${input}`
      ).toString();
    } catch {
      return new URL(fallback).toString();
    }
  }
}

function joinUrl(base, segment) {
  const b = ensureAbsoluteUrl(base);
  const u = new URL(b);
  const left = u.pathname.replace(/\/+$/, "");
  const right = String(segment || "").replace(/^\/+/, "");
  u.pathname = `${left}/${right}`;
  return u.toString();
}

// back_url para Mercado Pago (siempre HTTPS público y sin // dobles)
function computeMpBackUrl() {
  const candidate = PUBLIC_RETURN_URL_BASE
    ? joinUrl(PUBLIC_RETURN_URL_BASE, "return")
    : WEBHOOK_PUBLIC_URL
    ? joinUrl(WEBHOOK_PUBLIC_URL, "return")
    : joinUrl(FRONTEND_URL, "return"); // último recurso

  const u = new URL(candidate);
  if (u.protocol !== "https:") {
    console.warn(
      "[/subscribe] back_url no es https; usado igualmente, MP puede rechazar. value:",
      candidate
    );
  }
  return u.toString();
}

function limitForPlan(plan) {
  return plan === "multi" ? 3 : 1;
}
function generateLicenseToken() {
  return `VS-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(
    36
  )}`;
}

function daysLeftFrom(date) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function licenseStatusFromRecord(lic) {
  // Determina estado coherente con expiración y estado guardado
  if (!lic) return null;
  const dLeft = daysLeftFrom(lic.expiresAt);
  let status = lic.status; // "active" | "inactive" | "paused" | "cancelled" | "expired" | "disabled"
  if (dLeft !== null && dLeft < 0) status = "expired";
  else if (status === "active" && dLeft !== null && dLeft <= 7) status = "warning";

  return {
    status, // para el desktop: "active" | "warning" | "expired" | "disabled" (tomamos "cancelled"/"paused" como "disabled" si querés)
    message:
      status === "active"
        ? `Licencia activa${dLeft ? ` (${dLeft} días restantes)` : ""}.`
        : status === "warning"
        ? `Tu licencia vence pronto${dLeft ? ` (${dLeft} días)` : ""}.`
        : status === "expired"
        ? "Licencia expirada."
        : status === "paused"
        ? "Suscripción pausada."
        : status === "cancelled"
        ? "Suscripción cancelada."
        : "Licencia no activa.",
    daysLeft: dLeft ?? null,
    plan: lic.plan || "single",
  };
}

// HTML fallback para redirección
function htmlRedirect(targetUrl) {
  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Volviendo al panel…</title>
  <meta http-equiv="refresh" content="0;url='${targetUrl}'" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#0f172a; color:#e5e7eb; display:grid; place-items:center; height:100vh; margin:0; }
    .card { background:#0b1220; border:1px solid #334155; border-radius:12px; padding:20px; max-width:560px; }
    a { color:#60a5fa; }
    .small { color:#94a3b8; font-size:12px; margin-top:8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Redirigiendo a tu panel…</h1>
    <p>Si no te lleva automáticamente, hacé clic acá:</p>
    <p><a href="${targetUrl}">Ir al panel</a></p>
    <p class="small">Podés copiar y pegar esta URL en tu navegador si fuera necesario:<br/><code>${targetUrl}</code></p>
  </div>
</body>
</html>`.trim();
}

/* =========================
   Rutas públicas básicas
========================= */
app.get("/health", (_, res) => res.json({ ok: true, ts: Date.now() }));

app.post("/register", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email y contraseña son requeridos." });

    const emailNorm = String(email).trim().toLowerCase();
    const passwordStr = String(password);

    const exists = await User.findOne({ where: { email: emailNorm } });
    if (exists)
      return res.status(409).json({ error: "El email ya está registrado." });

    const passwordHash = await bcrypt.hash(passwordStr, 10);
    const user = await User.create({
      email: emailNorm,
      passwordHash,
      role: "client",
    });

    console.log("[register] nuevo usuario:", {
      id: user.id,
      email: user.email,
    });
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

app.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email y contraseña son requeridos." });

    const emailNorm = String(email).trim().toLowerCase();
    const passwordStr = String(password);

    const user = await User.findOne({ where: { email: emailNorm } });
    console.log("[login] email:", emailNorm, "userFound:", !!user);

    if (!user)
      return res
        .status(400)
        .json({ error: "Usuario o contraseña incorrectos" });

    const match = await bcrypt.compare(passwordStr, user.passwordHash);
    console.log("[login] passwordMatch:", match);
    if (!match)
      return res
        .status(400)
        .json({ error: "Usuario o contraseña incorrectos" });

    res.json({
      token: signJWT(user),
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

/* =========================
   Auth middleware
========================= */
const auth = authMiddleware();

/* =========================
   Licencias (protegido)
========================= */
app.get("/license", auth, async (req, res) => {
  try {
    const license = await License.findOne({
      where: { userId: req.user.id },
      order: [["updatedAt", "DESC"]],
    });
    res.json(license ?? null);
  } catch (err) {
    console.error("license get error:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Vincular dispositivo a la licencia activa
app.post("/license/devices/attach", auth, async (req, res) => {
  try {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: "deviceId requerido" });

    const lic = await License.findOne({
      where: { userId: req.user.id, status: "active" },
    });
    if (!lic) return res.status(404).json({ error: "No hay licencia activa" });

    const max = limitForPlan(lic.plan);
    const set = new Set(lic.devices || []);
    if (set.has(deviceId)) return res.json(lic);

    if (set.size >= max)
      return res
        .status(403)
        .json({ error: `Límite de dispositivos alcanzado (${max})` });
    set.add(deviceId);
    lic.devices = [...set];
    await lic.save();
    res.json(lic);
  } catch (err) {
    console.error("attach error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Desvincular dispositivo por id
app.post("/license/devices/detach", auth, async (req, res) => {
  try {
    const { deviceId } = req.body || {};
    const lic = await License.findOne({ where: { userId: req.user.id } });
    if (!lic) return res.status(404).json({ error: "Sin licencia" });
    lic.devices = (lic.devices || []).filter((d) => d !== deviceId);
    await lic.save();
    res.json(lic);
  } catch (err) {
    console.error("detach error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* =========================
   Suscripciones (crear)
========================= */
app.post("/subscribe", auth, async (req, res) => {
  try {
    const { plan, mpEmail } = req.body || {};
    if (!["single", "multi"].includes(plan))
      return res.status(400).json({ error: "Plan inválido" });

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const currency = (process.env.MP_CURRENCY || "ARS").toUpperCase();
    const single = Number(process.env.PRICE_SINGLE || 2999);
    const multi = Number(process.env.PRICE_MULTI || 4499);
    const amount = plan === "multi" ? multi : single;

    const backUrl = computeMpBackUrl();
    console.log("[/subscribe] mpBackUrl:", backUrl, {
      FRONTEND_URL,
      PUBLIC_RETURN_URL_BASE,
      WEBHOOK_PUBLIC_URL,
      BACKEND_PUBLIC_URL: process.env.BACKEND_PUBLIC_URL,
    });

    const { init_point, mpPreapprovalId } = await createSubscriptionDirect({
      userId: user.id,
      plan,
      payerEmail: mpEmail || user.email,
      backUrl,
      currency,
      amount,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // pendiente por 1 día
    const lic = await License.findOne({ where: { userId: user.id } });
    if (lic) {
      Object.assign(lic, {
        plan,
        status: "inactive",
        mpPreapprovalId,
        expiresAt,
      });
      await lic.save();
    } else {
      await License.create({
        userId: user.id,
        plan,
        status: "inactive",
        mpPreapprovalId,
        expiresAt,
      });
    }

    res.json({ init_point });
  } catch (err) {
    console.error("Error /subscribe:", err?.status || "", err?.message || err);
    if (err?.cause)
      console.error("MP cause:", JSON.stringify(err.cause, null, 2));
    const status = Number(err?.status) || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "No se pudo crear la suscripción",
      details: err?.message || "Error desconocido",
    });
  }
});

/* =========================
   Return desde MP (back_url)
========================= */
app.get("/return", async (req, res) => {
  try {
    const preapprovalId =
      req.query.preapproval_id || req.query.preapprovalId || req.query.id;
    if (!preapprovalId) {
      const target = new URL(
        "/dashboard?status=missing_preapproval",
        ensureAbsoluteUrl(FRONTEND_URL)
      ).toString();
      res.status(302).setHeader("Location", target).send(htmlRedirect(target));
      return;
    }

    const pre = await getPreapprovalById(String(preapprovalId));
    const userId = pre?.external_reference
      ? Number(pre.external_reference)
      : null;

    if (["authorized", "active"].includes(pre.status) && userId) {
      let lic = await License.findOne({ where: { userId } });
      if (!lic) {
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 1);
        lic = await License.create({
          userId,
          plan: "single",
          status: "active",
          expiresAt: exp,
          mpPreapprovalId: pre.id,
          token: generateLicenseToken(),
        });
      } else {
        if (lic.mpPreapprovalId && lic.mpPreapprovalId !== pre.id) {
          try {
            await cancelPreapproval(lic.mpPreapprovalId);
          } catch (e) {
            console.warn(
              "No se pudo cancelar preaprobación vieja:",
              e?.message
            );
          }
        }
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 1);
        lic.mpPreapprovalId = pre.id;
        lic.status = "active";
        lic.expiresAt = exp;
        if (!lic.token) lic.token = generateLicenseToken();
        await lic.save();
      }
      const target = new URL(
        `/return?preapproval_id=${pre.id}&status=ok`,
        ensureAbsoluteUrl(FRONTEND_URL)
      ).toString();
      res.status(302).setHeader("Location", target).send(htmlRedirect(target));
      return;
    }

    const target = new URL(
      `/return?preapproval_id=${pre.id}&status=${pre.status || "unknown"}`,
      ensureAbsoluteUrl(FRONTEND_URL)
    ).toString();
    res.status(302).setHeader("Location", target).send(htmlRedirect(target));
  } catch (err) {
    console.error("return error:", err);
    const target = new URL(
      `/return?status=error`,
      ensureAbsoluteUrl(FRONTEND_URL)
    ).toString();
    res.status(302).setHeader("Location", target).send(htmlRedirect(target));
  }
});

/* =========================
   Refrescar licencia (forzar estado y token)
========================= */
app.post("/license/refresh", auth, async (req, res) => {
  try {
    let lic = await License.findOne({ where: { userId: req.user.id } });
    if (!lic) return res.json(null);
    if (!lic.mpPreapprovalId) return res.json(lic);

    let pre = null;
    try {
      pre = await getPreapprovalById(String(lic.mpPreapprovalId));
    } catch (e) {
      console.warn(
        "[/license/refresh] No se pudo consultar preapproval:",
        e?.message || e
      );
    }

    if (pre && ["authorized", "active"].includes(pre.status)) {
      if (lic.mpPreapprovalId && lic.mpPreapprovalId !== pre.id) {
        try {
          await cancelPreapproval(lic.mpPreapprovalId);
        } catch (e) {
          console.warn("No se pudo cancelar preaprobación vieja:", e?.message);
        }
      }
      const exp = new Date();
      exp.setMonth(exp.getMonth() + 1);
      lic.mpPreapprovalId = pre.id;
      lic.status = "active";
      lic.expiresAt = exp;
      if (!lic.token) lic.token = generateLicenseToken();
      await lic.save();
    }

    res.json(lic);
  } catch (err) {
    console.error("/license/refresh error:", err);
    res.status(500).json({ error: "No se pudo refrescar la licencia" });
  }
});

/* =========================
   Webhook (preapproval)
========================= */
app.post("/webhook", async (req, res) => {
  try {
    const type =
      req.body.type || req.query.type || req.body.topic || req.query.topic;
    const dataId =
      req.body?.data?.id || req.query["data.id"] || req.body.id || req.query.id;
    res.status(200).send("OK");
    if (!type || !dataId) return;

    if (String(type).includes("preapproval")) {
      const pre = await getPreapprovalById(String(dataId));
      const userId = pre?.external_reference
        ? Number(pre.external_reference)
        : null;

      let lic = null;
      if (userId) lic = await License.findOne({ where: { userId } });
      if (!lic)
        lic = await License.findOne({ where: { mpPreapprovalId: pre.id } });
      if (!lic) return;

      if (["authorized", "active"].includes(pre.status)) {
        if (lic.mpPreapprovalId && lic.mpPreapprovalId !== pre.id) {
          try {
            await cancelPreapproval(lic.mpPreapprovalId);
          } catch (e) {
            console.warn(
              "No se pudo cancelar preaprobación vieja:",
              e?.message
            );
          }
        }
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 1);
        lic.mpPreapprovalId = pre.id;
        lic.status = "active";
        lic.expiresAt = exp;
        if (!lic.token) lic.token = generateLicenseToken();
        await lic.save();
      } else if (pre.status === "paused") {
        lic.status = "paused";
        await lic.save();
      } else if (pre.status === "cancelled") {
        lic.status = "cancelled";
        await lic.save();
      }
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }
});

/* =========================
   Gestión suscripción (protegido)
========================= */
// Cancelar
app.post("/subscription/cancel", auth, async (req, res) => {
  try {
    const lic = await License.findOne({ where: { userId: req.user.id } });
    if (!lic?.mpPreapprovalId)
      return res
        .status(404)
        .json({ error: "No hay suscripción para cancelar" });
    const mp = await cancelPreapproval(lic.mpPreapprovalId);
    lic.status = "cancelled";
    await lic.save();
    res.json({ ok: true, mp });
  } catch (err) {
    console.error("cancel error:", err);
    res
      .status(Number(err?.status) || 500)
      .json({ error: "No se pudo cancelar la suscripción" });
  }
});

// Pausar
app.post("/subscription/pause", auth, async (req, res) => {
  try {
    const lic = await License.findOne({ where: { userId: req.user.id } });
    if (!lic?.mpPreapprovalId)
      return res.status(404).json({ error: "No hay suscripción para pausar" });
    const mp = await pausePreapproval(lic.mpPreapprovalId);
    lic.status = "paused";
    await lic.save();
    res.json({ ok: true, mp });
  } catch (err) {
    console.error("pause error:", err);
    res
      .status(Number(err?.status) || 500)
      .json({ error: "No se pudo pausar la suscripción" });
  }
});

// Reanudar
app.post("/subscription/resume", auth, async (req, res) => {
  try {
    const lic = await License.findOne({ where: { userId: req.user.id } });
    if (!lic?.mpPreapprovalId)
      return res
        .status(404)
        .json({ error: "No hay suscripción para reanudar" });
    const mp = await resumePreapproval(lic.mpPreapprovalId);
    lic.status = "active";
    await lic.save();
    res.json({ ok: true, mp });
  } catch (err) {
    console.error("resume error:", err);
    res
      .status(Number(err?.status) || 500)
      .json({ error: "No se pudo reanudar la suscripción" });
  }
});

// Cambiar medio de pago (re-vincular)
app.post("/subscription/change-method", auth, async (req, res) => {
  try {
    const { mpEmail, plan } = req.body || {};
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const lic = await License.findOne({ where: { userId: user.id } });
    const currentPlan = plan || lic?.plan || "single";

    const currency = (process.env.MP_CURRENCY || "ARS").toUpperCase();
    const single = Number(process.env.PRICE_SINGLE || 2999);
    const multi = Number(process.env.PRICE_MULTI || 4499);
    const amount = currentPlan === "multi" ? multi : single;

    const backUrl = computeMpBackUrl();

    const { init_point, mpPreapprovalId } = await createSubscriptionDirect({
      userId: user.id,
      plan: currentPlan,
      payerEmail: mpEmail || user.email,
      backUrl,
      currency,
      amount,
    });

    // No tocamos la suscripción anterior aún; el webhook hará el swap cuando la nueva esté authorized
    res.json({ init_point, mpPreapprovalId });
  } catch (err) {
    console.error(
      "change-method error:",
      err?.status || "",
      err?.message || err
    );
    res
      .status(Number(err?.status) || 500)
      .json({ error: "No se pudo iniciar el cambio de medio de pago" });
  }
});

/* =========================
   Licenciamiento offline (JWS) - público
========================= */
// Clave pública para verificación offline
app.get("/.well-known/venta-simple-license-pubkey", (_, res) => {
  try {
    const pem = getPublicKeyPem();
    if (!pem) return res.status(500).send("Public key not configured");
    res.type("text/plain").send(pem);
  } catch {
    res.status(500).send("Error");
  }
});

// Validar token + deviceId, vincular si hay cupo y emitir JWS
app.post("/public/license/validate", async (req, res) => {
  try {
    const { token, deviceId } = req.body || {};
    if (!token || !deviceId)
      return res.status(400).json({ error: "token y deviceId requeridos" });

    const lic = await License.findOne({ where: { token } });
    if (!lic) return res.status(404).json({ error: "Licencia no encontrada" });

    if (lic.status !== "active")
      return res
        .status(403)
        .json({ error: `Licencia no activa (${lic.status})` });
    if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) {
      return res.status(403).json({ error: "Licencia expirada" });
    }

    const max = limitForPlan(lic.plan);
    const set = new Set(lic.devices || []);
    if (!set.has(deviceId)) {
      if (set.size >= max)
        return res
          .status(403)
          .json({ error: `Límite de dispositivos alcanzado (${max})` });
      set.add(deviceId);
      lic.devices = [...set];
      await lic.save();
    }

    const features = {
      sync: true,
      whatsapp_bot: Boolean(lic.features?.whatsapp_bot || false),
      ai_cameras: Boolean(lic.features?.ai_cameras || false),
    };

    const jws = signLicenseJWS({
      userId: lic.userId,
      licenseId: lic.id,
      token: lic.token,
      plan: lic.plan,
      status: lic.status,
      deviceId,
      maxDevices: max,
      features,
    });

    res.json({
      license_jws: jws,
      license: {
        id: lic.id,
        plan: lic.plan,
        status: lic.status,
        expiresAt: lic.expiresAt,
        devices: lic.devices,
      },
      offline_ttl_sec: Number(process.env.LICENSE_OFFLINE_TTL_SEC || 72 * 3600),
    });
  } catch (err) {
    console.error("validate error:", err);
    res.status(500).json({ error: "Error al validar licencia" });
  }
});

// Refrescar JWS (mismo token + deviceId ya vinculado)
app.post("/public/license/refresh", async (req, res) => {
  try {
    const { token, deviceId } = req.body || {};
    if (!token || !deviceId)
      return res.status(400).json({ error: "token y deviceId requeridos" });

    const lic = await License.findOne({ where: { token } });
    if (!lic) return res.status(404).json({ error: "Licencia no encontrada" });
    if (lic.status !== "active")
      return res
        .status(403)
        .json({ error: `Licencia no activa (${lic.status})` });
    if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) {
      return res.status(403).json({ error: "Licencia expirada" });
    }
    if (!Array.isArray(lic.devices) || !lic.devices.includes(deviceId)) {
      return res
        .status(403)
        .json({ error: "Este dispositivo no está vinculado a la licencia" });
    }

    const features = {
      sync: true,
      whatsapp_bot: Boolean(lic.features?.whatsapp_bot || false),
      ai_cameras: Boolean(lic.features?.ai_cameras || false),
    };
    const max = limitForPlan(lic.plan);

    const jws = signLicenseJWS({
      userId: lic.userId,
      licenseId: lic.id,
      token: lic.token,
      plan: lic.plan,
      status: lic.status,
      deviceId,
      maxDevices: max,
      features,
    });

    res.json({
      license_jws: jws,
      license: {
        id: lic.id,
        plan: lic.plan,
        status: lic.status,
        expiresAt: lic.expiresAt,
        devices: lic.devices,
      },
      offline_ttl_sec: Number(process.env.LICENSE_OFFLINE_TTL_SEC || 72 * 3600),
    });
  } catch (err) {
    console.error("refresh error:", err);
    res.status(500).json({ error: "Error al refrescar licencia" });
  }
});

/* =========================
   Serie temporal de ventas (protegido)
   GET /stats/sales-series?from=YYYY-MM-DD&to=YYYY-MM-DD&bucket=day|week|month
========================= */
app.get("/stats/sales-series", auth, async (req, res) => {
  try {
    // Parámetros
    const from = String(req.query.from || "").slice(0, 10);
    const to   = String(req.query.to || "").slice(0, 10);
    const bucket = String(req.query.bucket || "day").toLowerCase(); // day|week|month

    if (!from || !to) return res.status(400).json({ error: "from y to son requeridos (YYYY-MM-DD)" });
    if (!["day","week","month"].includes(bucket)) return res.status(400).json({ error: "bucket inválido" });

    // Permitir override por ENV si tu esquema no usa los nombres por defecto
    const SALES_TABLE = process.env.SALES_TABLE || "Venta";         // "Venta" | "ventas" | etc.
    const CREATED_AT  = process.env.SALES_CREATED_AT || "createdAt";// fecha de la venta (utc)
    const AMOUNT_COL  = process.env.SALES_AMOUNT_COL || "total";    // monto de la venta
    const USER_COL    = process.env.SALES_USER_COL || "userId";     // si no existe, se reintenta sin filtro

    // Normalizamos a rangos de tiempo en UTC (inclusive start, exclusive end)
    // toExclusive = (to + 1 día) para incluir el día "to" completo
    const toExclusive = new Date(to + "T00:00:00Z");
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    // date_trunc bucket
    const bucketSql = bucket; // Postgres: 'day' | 'week' | 'month'

    // Intento 1: con filtro por usuario (multi-tenant)
    const sqlBase = `
      SELECT
        date_trunc(:bucket, "${SALES_TABLE}"."${CREATED_AT}") AS ts_bucket,
        SUM(COALESCE("${SALES_TABLE}"."${AMOUNT_COL}", 0))   AS amount,
        COUNT(1)                                            AS tickets
      FROM "${SALES_TABLE}"
      WHERE "${SALES_TABLE}"."${CREATED_AT}" >= :fromTs
        AND "${SALES_TABLE}"."${CREATED_AT}" <  :toTs
        AND "${SALES_TABLE}"."${USER_COL}" = :uid
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const sqlNoUser = `
      SELECT
        date_trunc(:bucket, "${SALES_TABLE}"."${CREATED_AT}") AS ts_bucket,
        SUM(COALESCE("${SALES_TABLE}"."${AMOUNT_COL}", 0))   AS amount,
        COUNT(1)                                            AS tickets
      FROM "${SALES_TABLE}"
      WHERE "${SALES_TABLE}"."${CREATED_AT}" >= :fromTs
        AND "${SALES_TABLE}"."${CREATED_AT}" <  :toTs
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const replacements = {
      bucket: bucketSql,
      fromTs: new Date(from + "T00:00:00Z"),
      toTs: toExclusive,
      uid: req.user.id,
    };

    let rows;
    try {
      rows = await sequelize.query(sqlBase, { type: sequelize.QueryTypes.SELECT, replacements });
    } catch (e) {
      // Si falla (columna userId no existe), reintenta sin filtro
      rows = await sequelize.query(sqlNoUser, { type: sequelize.QueryTypes.SELECT, replacements });
    }

    // Normalizamos respuesta (ISO date, números)
    const data = rows.map(r => ({
      ts: new Date(r.ts_bucket).toISOString(),  // inicio del bucket en UTC
      amount: Number(r.amount || 0),
      tickets: Number(r.tickets || 0),
    }));

    res.json({ bucket, from, to, data });
  } catch (err) {
    console.error("/stats/sales-series error:", err);
    res.status(500).json({ error: "Error al calcular la serie de ventas" });
  }
});


/* =========================
   Endpoints de estado (para Desktop)
========================= */
if (SYNC_ENABLED) {
  console.log("[sync] habilitado (SYNC_API_ENABLED=1)");
  // status por token: /desktop/license/status?licenseKey=VS-xxxx
  // también expone aliases que ya está llamando el desktop
  const statusHandler = async (req, res) => {
    try {
      const licenseKey = String(req.query.licenseKey || "").trim();
      if (!licenseKey) return res.status(400).json({ error: "licenseKey requerido" });

      const lic = await License.findOne({ where: { token: licenseKey } });
      if (!lic) return res.status(404).json({ error: "Not found" });

      const payload = licenseStatusFromRecord(lic);
      return res.json(payload);
    } catch (e) {
      console.error("[status] error:", e?.message || e);
      return res.status(500).json({ error: "Error interno" });
    }
  };

  app.get("/desktop/license/status", statusHandler);
  app.get("/subscription/status", statusHandler);
  app.get("/license/status", statusHandler);
} else {
  console.log("[sync] deshabilitado (define SYNC_API_ENABLED=1 para habilitar)");
}

/* =========================
   404 & start
========================= */
app.use((_, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => console.log(`Server listo en :${PORT}`));
