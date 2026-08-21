import { parseLink } from "./parser.js";
import { extractSteam } from "./steam.js";
import { extractAmazon } from "./amazon.js";

const extractors = {
  steam: extractSteam,
  amazon: extractAmazon,
};

export const STORES = Object.keys(extractors);

// Catálogo público de tiendas para la pantalla de Ajustes. `requiresCookie`
// marca qué tiendas necesitan sesión manual (Amazon raspea con cookies reales;
// Steam usa su API pública y no). Al agregar una tienda nueva con cookie, solo
// se añade aquí y la UI de ajustes la muestra automáticamente.
export const STORE_INFO = {
  amazon: { name: "Amazon", requiresCookie: true },
  steam: { name: "Steam", requiresCookie: false },
};

export async function resolveProduct(url) {
  const parsed = parseLink(url);
  if (!parsed) {
    throw new Error("El link no es de una tienda soportada (steam | amazon)");
  }
  const extractor = extractors[parsed.store];
  if (!extractor) {
    throw new Error(`Tienda "${parsed.store}" reconocida pero sin extractor`);
  }
  const data = await extractor(parsed);
  return {
    store: parsed.store,
    storeProductId: parsed.storeProductId,
    url: parsed.canonicalUrl,
    ...data,
  };
}
