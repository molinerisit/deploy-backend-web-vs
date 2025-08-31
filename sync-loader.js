// backend/sync-loader.js (ESM)
export function registerSyncRoutes(app) {
  const enabled = String(process.env.SYNC_API_ENABLED || "0").toLowerCase();
  if (!["1", "true", "yes", "on"].includes(enabled)) {
    console.log("[sync] deshabilitado (define SYNC_API_ENABLED=1 para habilitar)");
    return;
  }

  import("./sync/sync-router.js")
    .then((mod) => {
      // aceptamos default, named `syncRouter` o `buildSyncRouter`
      let exported = mod.default ?? mod.syncRouter ?? mod.buildSyncRouter;

      if (!exported) {
        console.warn("[sync] no se encontró export en ./sync/sync-router.js (default | syncRouter | buildSyncRouter)");
        return;
      }

      // Si ya es un Router (express.Router()), tiene .stack
      if (typeof exported === "function" && exported.stack && Array.isArray(exported.stack)) {
        app.use("/sync", exported);
        console.log("[sync] rutas /sync habilitadas (router exportado)");
        return;
      }

      // Si es fábrica, la invocamos para obtener el Router
      if (typeof exported === "function") {
        try {
          const built = exported(); // debe devolver express.Router()
          if (built && typeof built === "function" && built.stack && Array.isArray(built.stack)) {
            app.use("/sync", built);
            console.log("[sync] rutas /sync habilitadas (router construido por fábrica)");
            return;
          }
        } catch (e) {
          console.error("[sync] error al invocar la fábrica del router:", e?.message || e);
          return;
        }
      }

      console.error("[sync] el módulo no exporta un Router válido.");
    })
    .catch((e) => {
      console.warn("[sync] no se pudo cargar ./sync/sync-router.js:", e?.message || e);
    });
}

export default { registerSyncRoutes };
