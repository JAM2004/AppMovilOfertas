import { Router } from "express";
import { setStoreCookie, getStoreCookie, listStoreSettings } from "../db.js";
import { STORE_INFO } from "../stores/index.js";

export const settingsRouter = Router();

// GET /api/settings/stores — devuelve qué tiendas existen, si requieren cookie
// y el estado actual de cada una (para que la app las muestre con su estado).
settingsRouter.get("/settings/stores", (req, res) => {
  const settings = listStoreSettings();
  const items = Object.entries(STORE_INFO).map(([id, info]) => {
    const stored = settings.find((s) => s.store === id);
    // La sesión está configurada si está en la BD o en .env (respaldo inicial).
    // AMAZON_COOKIE en .env se carga al arrancar (dotenv) y llega a process.env.
    const hasCookie =
      info.requiresCookie &&
      (Boolean(stored?.cookie) ||
        Boolean(process.env[`${id.toUpperCase()}_COOKIE`]));
    return {
      id,
      name: info.name,
      requiresCookie: info.requiresCookie,
      hasCookie: info.requiresCookie ? hasCookie : null,
      updatedAt: stored?.updated_at ?? null,
    };
  });
  res.json(items);
});

// PUT /api/settings/stores/:store/cookie — guarda la cookie de sesión de una
// tienda. Se guarda en la BD (no .env) para renovarla desde el teléfono.
settingsRouter.put("/settings/stores/:store/cookie", (req, res) => {
  const { store } = req.params;
  const info = STORE_INFO[store];
  if (!info) {
    return res.status(404).json({ error: `Tienda desconocida: ${store}` });
  }
  if (!info.requiresCookie) {
    return res.status(400).json({ error: `${info.name} no requiere cookie` });
  }
  const { cookie } = req.body ?? {};
  if (!cookie || typeof cookie !== "string" || cookie.trim() === "") {
    return res.status(400).json({ error: "Falta el campo cookie" });
  }
  setStoreCookie(store, cookie.trim());
  const saved = getStoreCookie(store);
  res.json({ ok: true, store, updatedAt: saved.updated_at });
});
