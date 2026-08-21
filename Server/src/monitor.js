import cron from "node-cron";
import { resolveProduct } from "./stores/index.js";
import {
  listProducts,
  getLastPrice,
  addPricePoint,
  updateProductPrices,
  addNotification,
} from "./db.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Formatea un número como precio legible para los mensajes de notificación.
// Los precios guardados son números (ej. 1299), sin símbolo de moneda.
function fmt(price, currency) {
  if (price == null) return "sin precio";
  return `${currency ? currency + " " : ""}${price.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Evalúa UN producto: re-raspea su precio y genera notificaciones si hay un
// cambio relevante. La clave para no spamear es comparar contra el ESTADO
// ANTERIOR ya guardado (historial + fila del producto), no contra nada fijo:
//   - "bajó de precio"  → solo si el nuevo precio es MENOR que el último.
//   - "en oferta %"     → solo si pasó de no tener descuento a tenerlo.
//   - "objetivo"        → solo si CRUZA por debajo del precio objetivo.
// Así cada evento distinto notifica una vez, y no se repite mientras todo
// se mantiene igual entre ejecuciones del cron.
async function checkProduct(product) {
  let fresh;
  try {
    fresh = await resolveProduct(product.url);
  } catch (err) {
    // Un producto fallido (ej. Amazon bloqueó) NO debe tumbar el cron entero.
    console.error(`[monitor] fallo al re-raspar "${product.title}": ${err.message}`);
    return 0;
  }

  const newPrice = fresh.price;
  const last = getLastPrice(product.id);
  const lastPrice = last?.price;
  const oldDiscount = product.discount_percent || 0;
  const newDiscount = fresh.discountPercent || 0;
  const target = product.target_price;

  // Guarda el estado nuevo ANTES de evaluar, para que la siguiente ejecución
  // del cron compare contra este y no vuelva a avisar lo mismo.
  updateProductPrices(product.id, {
    price: newPrice,
    originalPrice: fresh.originalPrice,
    discountPercent: newDiscount,
  });
  // Cada medición queda en el historial (Fase 2 usa price_history para
  // detectar bajadas; la Fase 4 lo usará para gráficas de tendencia).
  addPricePoint(product.id, newPrice);

  const alerts = [];

  // 1) Bajó de precio: hay un precio anterior y el nuevo es estrictamente menor.
  if (lastPrice != null && newPrice != null && newPrice < lastPrice) {
    alerts.push({
      kind: "price_drop",
      message: `"${product.title}" bajó de ${fmt(lastPrice, fresh.currency)} a ${fmt(newPrice, fresh.currency)}`,
    });
  }

  // 2) Entró en oferta: antes no había descuento y ahora sí.
  if (newDiscount > 0 && oldDiscount === 0) {
    alerts.push({
      kind: "discount",
      message: `"${product.title}" está en oferta con ${newDiscount}% de descuento (${fmt(newPrice, fresh.currency)})`,
    });
  }

  // 3) Alcanzó el precio objetivo: cruza por debajo de target_price.
  // El cruce se detecta porque el precio anterior estaba por ENCIMA del objetivo.
  if (
    target != null &&
    newPrice != null &&
    newPrice <= target &&
    (lastPrice == null || lastPrice > target)
  ) {
    alerts.push({
      kind: "target_hit",
      message: `"${product.title}" alcanzó tu precio objetivo: ${fmt(newPrice, fresh.currency)} ≤ ${fmt(target, fresh.currency)}`,
    });
  }

  for (const a of alerts) {
    addNotification({ productId: product.id, kind: a.kind, message: a.message });
    console.log(`[monitor] notificación: ${a.kind} -> ${a.message}`);
  }
  return alerts.length;
}

// Barre todos los productos "Lo quiero". El delay entre productos evita
// disparar ráfagas de peticiones a Amazon (acuerdo de baja frecuencia).
export async function runMonitoring() {
  const products = listProducts("want");
  console.log(`[monitor] revisando ${products.length} productos...`);
  const delayMs = Number(process.env.MONITOR_DELAY_MS || 3000);
  let notified = 0;
  for (const p of products) {
    notified += await checkProduct(p);
    if (delayMs > 0) await delay(delayMs);
  }
  console.log(`[monitor] listo (${notified} notificaciones nuevas)`);
  return notified;
}

// Programa el cron. La expresión se configura en .env (MONITOR_CRON);
// por defecto corre cada 30 minutos, espaciable para respetar Amazon.
export function startMonitor() {
  if (process.env.MONITOR_ENABLED === "false") {
    console.log("[monitor] desactivado por MONITOR_ENABLED=false");
    return;
  }
  const expr = process.env.MONITOR_CRON || "*/30 * * * *";
  cron.schedule(expr, () => {
    runMonitoring().catch((err) => console.error("[monitor] error general:", err.message));
  });
  console.log(`[monitor] cron programado: ${expr}`);
}
