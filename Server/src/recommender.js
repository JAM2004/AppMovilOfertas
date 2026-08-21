import { embedMany, hasEmbedder } from "./embeddings.js";
import { fetchDeals as steamDeals } from "./stores/steam.js";
import { fetchDeals as amazonDeals } from "./stores/amazon.js";
import {
  listProducts,
  setProductEmbedding,
  upsertOffer,
  listOffers,
} from "./db.js";

// Registro de fuentes de ofertas: agregar una tienda nueva solo implica
// sumar su fetchDeals() aquí y en stores/index.js para extractor de producto.
const OFFER_SOURCES = { steam: steamDeals, amazon: amazonDeals };

// En cuántas peticiones partimos los títulos al embebirlos (límite cómodo de
// la API de OpenAI por request para arrays).
const BATCH = 100;

// (Re)construye todo el material de recomendación:
//   1. embeddings de los productos propios que no los tengan,
//   2. ofertas frescas de cada tienda,
//   3. embeddings de las ofertas y guardado en la tabla `offers`.
// Devuelve conteos para que la API informe al cliente.
export async function refreshAll() {
  const products = listProducts().filter((p) => !p.embedding);
  let productsEmbedded = 0;
  if (products.length) {
    const vectors = await embedMany(products.map((p) => p.title));
    products.forEach((p, i) => {
      if (vectors[i]) {
        setProductEmbedding(p.id, vectors[i]);
        productsEmbedded++;
      }
    });
  }

  let offersSaved = 0;
  for (const [store, source] of Object.entries(OFFER_SOURCES)) {
    let offers = [];
    try {
      offers = await source();
    } catch (err) {
      // Una tienda caída (ej. Amazon bloqueó) no debe tumbar el refresh entero.
      console.error(`[recommender] ${store}: ${err.message}`);
      continue;
    }
    // Embebemos los títulos por lotes (1 request por lote en vez de 1 por oferta).
    for (let i = 0; i < offers.length; i += BATCH) {
      const chunk = offers.slice(i, i + BATCH);
      const vectors = await embedMany(chunk.map((o) => o.title));
      chunk.forEach((o, j) => {
        upsertOffer({ ...o, embedding: vectors[j] });
        offersSaved++;
      });
    }
  }

  return { productsEmbedded, offersSaved };
}

// Vector normalizado que resume el "gusto" del usuario: el promedio de los
// embeddings de TODO lo que quiere y compra. Se normaliza para poder usar
// producto punto = similitud coseno contra las ofertas.
function tasteVector() {
  const products = listProducts().filter((p) => p.embedding);
  if (!products.length) return null;
  let sum = null;
  for (const p of products) {
    const v = JSON.parse(p.embedding);
    if (!sum) sum = [...v];
    else for (let i = 0; i < v.length; i++) sum[i] += v[i];
  }
  const norm = Math.sqrt(sum.reduce((a, x) => a + x * x, 0));
  return norm ? sum.map((x) => x / norm) : sum;
}

function magnitude(v) {
  return Math.sqrt(v.reduce((a, x) => a + x * x, 0));
}

// Rankea las ofertas guardadas por similitud coseno contra el vector de gusto.
// No hace llamadas de red: todo vive ya en la BD (embeddings precargados).
export function recommend(limit = 10, minScore = 0.85) {
  const taste = tasteVector();
  if (!taste) return { items: [], reason: "Todavía no hay productos propios con embedding. Ejecuta el refresh primero." };

  const offers = listOffers();
  const items = [];
  for (const o of offers) {
    if (!o.embedding) continue;
    const ev = JSON.parse(o.embedding);
    const evNorm = magnitude(ev);
    if (!evNorm) continue;
    // coseno = (taste · ev) / (|taste| * |ev|); |taste| = 1 por estar normalizado.
    let dot = 0;
    for (let i = 0; i < taste.length; i++) dot += taste[i] * ev[i];
    const score = dot / evNorm;
    if (score >= minScore) {
      items.push({
        id: o.id,
        store: o.store,
        title: o.title,
        url: o.url,
        image: o.image,
        price: o.price,
        original_price: o.original_price,
        discount_percent: o.discount_percent,
        score: Number(score.toFixed(4)),
      });
    }
    
  }
  items.sort((a, b) => b.score - a.score);
  return { items: items.slice(0, limit), reason: null };
}

export { hasEmbedder };
