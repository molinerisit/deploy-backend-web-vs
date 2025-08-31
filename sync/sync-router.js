// backend/sync/sync-router.js
import express from "express";
import { License } from "../models.js";

// Helpers locales si más adelante los necesitás acá
const limitForPlan = (plan) => (plan === "multi" ? 3 : 1);

const router = express.Router();

// Ping simple para probar conectividad (quedará en /sync/ping)
router.get("/ping", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

/**
 * NOTA IMPORTANTE:
 * Los endpoints legacy usados por el Desktop:
 *   GET /desktop/license/status?licenseKey=VS-xxxx
 *   GET /license/status?licenseKey=VS-xxxx
 *   GET /subscription/status?licenseKey=VS-xxxx
 *
 * Ya los define server.js (bajo la bandera SYNC_API_ENABLED).
 * No los volvemos a definir acá para evitar rutas duplicadas
 * y, sobre todo, evitar que queden prefijadas con /sync/.
 */

export default router;
