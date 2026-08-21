import axios from "axios";

// Modelo de embeddings (decisión del proyecto): corre LOCALMENTE en Ollama con
// bge-m3 (multilingüe, 1024 dims) en lugar de la API de OpenAI, que exige
// cuota/crédito. Configurable por env: EMBED_MODEL y OLLAMA_URL.
export const EMBED_MODEL = process.env.EMBED_MODEL || "bge-m3";
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");

// Cache breve del "estado" de Ollama (modelos disponibles) para no consultar
// /api/tags en cada GET de recomendaciones; se invalida en pocos segundos.
let tagsCache = { at: 0, ok: false };

async function fetchTags() {
  const now = Date.now();
  if (now - tagsCache.at < 15000) return tagsCache.ok;
  tagsCache = { at: now, ok: false };
  try {
    const res = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });
    tagsCache.ok = (res.data?.models || []).some(
      (m) => m.name.startsWith(EMBED_MODEL)
    );
  } catch {
    tagsCache.ok = false;
  }
  return tagsCache.ok;
}

// Indica si el motor local está listo (Ollama corriendo y modelo descargado).
// Sustituye al antiguo hasEmbeddingKey() de OpenAI.
export async function hasEmbedder() {
  return fetchTags();
}

// Llama a Ollama en un solo request para MUCHOS textos a la vez. El endpoint
// /api/embed acepta `input` como array y devuelve un vector por índice, alineado
// con la entrada (equivalente a embedMany de OpenAI pero sin costo).
export async function embedMany(texts) {
  if (!texts.length) return [];
  if (!(await hasEmbedder())) {
    throw new Error(
      `Ollama no está disponible o falta el modelo ${EMBED_MODEL}. Ejecuta: ollama serve` +
        (process.env.EMBED_MODEL ? "" : ` y luego: ollama pull ${EMBED_MODEL}`)
    );
  }
  let res;
  try {
    res = await axios.post(
      `${OLLAMA_URL}/api/embed`,
      { model: EMBED_MODEL, input: texts },
      { timeout: 60000 }
    );
  } catch (err) {
    throw ollamaError(err);
  }
  // /api/embed devuelve { embeddings: [ [..], [..] ] } en el mismo orden.
  return res.data?.embeddings ?? [];
}

// Traduce errores de Ollama a mensajes accionables (modelo no encontrado,
// servidor apagado) en vez de un genérico "status 404/ECONNREFUSED".
function ollamaError(err) {
  const status = err?.response?.status;
  if (status === 404) {
    return new Error(
      `Ollama no tiene el modelo ${EMBED_MODEL}. Descárgalo con: ollama pull ${EMBED_MODEL}`
    );
  }
  if (err.code === "ECONNREFUSED") {
    return new Error(
      "No se pudo conectar a Ollama (localhost:11434). Asegúrate de que esté corriendo (ollama serve)."
    );
  }
  return err;
}

// Versión conveniente de uno solo; útil para textos aislados.
export async function embed(text) {
  const [v] = await embedMany([text]);
  return v;
}
