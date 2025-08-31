// backend/sync-loader.js (ESM)
export function registerSyncRoutes(app) {
  const enabled = String(process.env.SYNC_API_ENABLED || "0").toLowerCase();
  if (!["1", "true", "yes", "on"].includes(enabled)) {
    console.log("[sync] deshabilitado (define SYNC_API_ENABLED=1 para habilitar)");
    return;
  }

  import("./sync/sync-router.js")
    .then((mod) => {
      let exported = mod.default || mod.syncRouter;

      if (!exported) {
        console.warn("[sync] no se encontró export default ni syncRouter en ./sync/sync-router.js");
        return;
      }

      // Si exportaron una función que devuelve Router, la invocamos
      if (typeof exported === "function") {
        try {
          exported = exported();
        } catch (e) {
          console.error("[sync] la función exportada no devolvió un Router:", e?.message || e);
          return;
        }
      }

      // En este punto esperamos un express.Router()
      if (!exported || typeof exported !== "function" || !exported.stack) {
        console.error("[sync] el export no parece un Router de express");
        return;
      }

      app.use("/sync", exported);
      console.log("[sync] rutas /sync habilitadas");
    })
    .catch((e) => {
      console.warn("[sync] no se pudo cargar ./sync/sync-router.js:", e?.message || e);
    });
}

export default { registerSyncRoutes };
