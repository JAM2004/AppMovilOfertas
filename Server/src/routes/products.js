import { Router } from "express";
import { resolveProduct, STORES } from "../stores/index.js";
import {
  upsertProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  addPricePoint,
  getPriceHistory,
} from "../db.js";

export const productsRouter = Router();

productsRouter.post("/", async (req, res) => {
  const { url, status = "want", targetPrice } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Falta el campo url" });
  }
  if (!["want", "bought"].includes(status)) {
    return res.status(400).json({ error: 'status debe ser "want" o "bought"' });
  }
  try {
    const product = await resolveProduct(url);
    const row = upsertProduct({
      ...product,
      status,
      targetPrice: targetPrice != null ? targetPrice : null,
    });
    addPricePoint(row.id, row.price);
    res.status(201).json(row);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

productsRouter.get("/", (req, res) => {
  const { status } = req.query;
  res.json(listProducts(status));
});

productsRouter.get("/:id", (req, res) => {
  const row = getProduct(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Producto no encontrado" });
  res.json({ ...row, history: getPriceHistory(row.id) });
});

productsRouter.patch("/:id", (req, res) => {
  const { status, targetPrice } = req.body ?? {};
  const existing = getProduct(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: "Producto no encontrado" });
  const row = updateProduct(Number(req.params.id), {
    status,
    target_price: targetPrice,
  });
  res.json(row);
});

productsRouter.delete("/:id", (req, res) => {
  const ok = deleteProduct(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "Producto no encontrado" });
  res.status(204).end();
});

export { STORES };
