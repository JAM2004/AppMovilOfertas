import express from "express";
import cors from "cors";
import { productsRouter } from "./routes/products.js";
import { recommenderRouter } from "./routes/recommendations.js";
import { settingsRouter } from "./routes/settings.js";
import { registerDeviceToken, listNotifications } from "./db.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "AppMovilOfertas API",
    endpoints: {
      "POST /api/products": "Registrar producto por link (body: url, status, targetPrice)",
      "GET /api/products": "Listar productos (?status=want|bought)",
      "GET /api/products/:id": "Detalle con historial de precios",
      "PATCH /api/products/:id": "Actualizar status o targetPrice",
      "DELETE /api/products/:id": "Eliminar producto",
      "POST /api/device-token": "Registrar token de push (body: token)",
      "GET /api/notifications": "Historial de notificaciones",
      "GET /api/settings/stores": "Lista de tiendas y su estado de sesión",
      "PUT /api/settings/stores/:store/cookie": "Guardar cookie de sesión de una tienda",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/device-token", (req, res) => {
  const { token } = req.body ?? {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Falta el campo token" });
  }
  registerDeviceToken(token);
  res.status(201).json({ ok: true });
});

app.use("/api/products", productsRouter);
app.use("/api", recommenderRouter);
app.use("/api", settingsRouter);

app.get("/api/notifications", (req, res) => {
  res.json(listNotifications());
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
