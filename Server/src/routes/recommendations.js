import { Router } from "express";
import { refreshAll, recommend, hasEmbedder } from "../recommender.js";
import { listOffers } from "../db.js";

export const recommenderRouter = Router();

// Devuelve las ofertas guardadas (Steam + Amazon) tal como están en la BD.
// Útil para inspeccionar el catálogo y para el cliente mientras se refresca.
recommenderRouter.get("/offers", (req, res) => {
  res.json(listOffers());
});

// Refresca todo el material: embeddings de productos propios + ofertas nuevas
// de cada tienda con sus embeddings. Puede tardar (varias llamadas a OpenAI).
recommenderRouter.post("/recommendations/refresh", async (req, res) => {
  try {
    if (!(await hasEmbedder())) {
      return res.status(400).json({
        error:
          "Ollama no está disponible o falta el modelo bge-m3: el motor de recomendaciones necesita el embeder local (ejecuta: ollama serve y ollama pull bge-m3).",
      });
    }
    const result = await refreshAll();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recomendaciones rankeadas por similitud con tu "vector de gusto".
// Opcional: ?limit= para cuántas traer y ?minScore= para el umbral mínimo.
recommenderRouter.get("/recommendations", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const minScore = Number(req.query.minScore) || 0;
  res.json(recommend(limit, minScore));
});
