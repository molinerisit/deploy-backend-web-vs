// backend/sync/sync-router.js
import express from "express";
import { License } from "../models.js";

// Helpers
const limitForPlan = (plan) => (plan === "multi" ? 3 : 1);

export default function registerSyncRoutes(app) {
  const router = express.Router();

  // Ping simple para probar conectividad
  router.get("/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  /**
   * Compatibilidad con el desktop viejo:
   * GET /desktop/license/status?licenseKey=VS-xxxx
   * GET /license/status?licenseKey=VS-xxxx
   * GET /subscription/status?licenseKey=VS-xxxx
   *
   * Responde 200 con info básica si encuentra la licencia por token,
   * 404 si no existe, 403 si no está activa o está vencida.
   */
  async function legacyStatusHandler(req, res) {
    try {
      const licenseKey = String(req.query.licenseKey || "").trim();
      if (!licenseKey) return res.status(400).json({ error: "licenseKey requerido" });

      const lic = await License.findOne({ where: { token: licenseKey } });
      if (!lic) return res.status(404).json({ error: "Not found" });

      // vencimiento
      if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) {
        return res.status(403).json({ error: "Licencia expirada", status: "expired" });
      }

      // estado
      if (lic.status !== "active") {
        return res.status(403).json({ error: `Licencia no activa (${lic.status})`, status: lic.status });
      }

      return res.json({
        status: "active",
        plan: lic.plan,
        expiresAt: lic.expiresAt,
        devices: lic.devices || [],
        maxDevices: limitForPlan(lic.plan),
      });
    } catch (err) {
      console.error("[sync-router] legacyStatusHandler error:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }

  router.get("/desktop/license/status", legacyStatusHandler);
  router.get("/license/status", legacyStatusHandler);
  router.get("/subscription/status", legacyStatusHandler);

  // Montar todo bajo /sync
  app.use("/sync", router);

  console.log("[sync] router montado en /sync");
}
