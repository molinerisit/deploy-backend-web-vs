// backend/sync-auth.js (ESM)
export function licenseAuthFactory(LicenseModel) {
  return async function licenseAuth(req, res, next) {
    try {
      // Acepta:
      //  - Authorization: Bearer <LICENSE_TOKEN>
      //  - Authorization: License <LICENSE_TOKEN>
      //  - X-License-Token: <LICENSE_TOKEN>
      const auth = req.headers.authorization || "";
      const hdrToken =
        (auth.startsWith("Bearer ") && auth.slice(7)) ||
        (auth.startsWith("License ") && auth.slice(8)) ||
        null;
      const token = hdrToken || req.headers["x-license-token"];

      if (!token) return res.status(401).json({ error: "license token requerido" });

      const lic = await LicenseModel.findOne({ where: { token: String(token) } });
      if (!lic) return res.status(404).json({ error: "Licencia no encontrada" });

      // estado / expiración
      const now = Date.now();
      if (lic.status !== "active") {
        return res.status(403).json({ error: `Licencia no activa (${lic.status})` });
      }
      if (lic.expiresAt && new Date(lic.expiresAt).getTime() < now) {
        return res.status(403).json({ error: "Licencia expirada" });
      }

      // (opcional) validar deviceId si te lo manda la app
      const deviceId =
        req.headers["x-device-id"] || req.query.deviceId || req.body?.deviceId;
      if (deviceId) {
        const ok = Array.isArray(lic.devices) && lic.devices.includes(String(deviceId));
        if (!ok) return res.status(403).json({ error: "Dispositivo no vinculado a la licencia" });
      }

      // Guardamos en req para usar en endpoints
      req.license = lic;
      req.tenantUserId = lic.userId;
      next();
    } catch (err) {
      console.error("[licenseAuth] error:", err);
      res.status(500).json({ error: "Error de autenticación de licencia" });
    }
  };
}
