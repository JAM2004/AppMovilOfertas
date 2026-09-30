import { Router } from "express";
import { resolveProduct, STORES } from "../stores/index.js";
import {
  upsertProduct,
  listProducts,
  getProduct,
  deleteProduct,
  addPricePoint,
  getPriceHistory,
} from "../db.js";

export const productsRouter = Router();

productsRouter.post("/", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Falta el campo url" });
  }

  try {
    const product = await resolveProduct(url);
    const row = upsertProduct({
      ...product,
    });
    addPricePoint(row.id, row.price);
    res.status(201).json(row);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

productsRouter.get("/", (req, res) => {
  res.json(listProducts());
});

productsRouter.get("/:id", (req, res) => {
  const row = getProduct(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Producto no encontrado" });
  res.json({ ...row, history: getPriceHistory(row.id) });
});

productsRouter.delete("/:id", (req, res) => {
  const ok = deleteProduct(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "Producto no encontrado" });
  res.status(204).end();
});

export { STORES };
