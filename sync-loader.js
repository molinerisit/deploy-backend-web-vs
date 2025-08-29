export function registerSyncRoutes(app) {
  const enabled = String(process.env.SYNC_API_ENABLED || "0").toLowerCase();
  if (!["1","true","yes","on"].includes(enabled)) {
    console.log("[sync] deshabilitado (define SYNC_API_ENABLED=1 para habilitar)");
    return;
  }

  import("./sync/sync-router.js")
    .then((mod) => {
      const router = mod.default || mod.syncRouter;
      if (!router) {
        console.warn("[sync] no se encontró export default ni syncRouter en ./sync/sync-router.js");
        return;
      }
      app.use("/sync", router);
      console.log("[sync] rutas /sync habilitadas");
    })
    .catch((e) => {
      console.warn("[sync] no se pudo cargar ./sync/sync-router.js:", e?.message || e);
    });
}

export default { registerSyncRoutes };
