import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "ofertas.db"));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store TEXT NOT NULL,
    store_product_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    image TEXT,
    price REAL,
    original_price REAL,
    discount_percent INTEGER DEFAULT 0,
    currency TEXT,
    status TEXT NOT NULL DEFAULT 'want',
    target_price REAL,
    embedding TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(store, store_product_id)
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    price REAL NOT NULL,
    checked_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    image TEXT,
    price REAL,
    original_price REAL,
    discount_percent INTEGER,
    embedding TEXT,
    seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(store, url)
  );

  CREATE TABLE IF NOT EXISTS notifications_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS device_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Sesión/config por tienda (p.ej. la cookie de Amazon). Está en la BD y NO
  -- en .env para poder renovarla desde la app sin editar archivos ni reiniciar
  -- el server. Es genérica por store: así una tienda nueva que requiera
  -- sesión solo agrega su fila sin cambiar el esquema.
  CREATE TABLE IF NOT EXISTS store_settings (
    store TEXT PRIMARY KEY,
    cookie TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
`);

export function upsertProduct({ store, storeProductId, url, title, image, price, originalPrice, discountPercent, currency, status, targetPrice }) {
  const row = db.prepare(`
    INSERT INTO products
      (store, store_product_id, url, title, image, price, original_price, discount_percent, currency, status, target_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(store, store_product_id) DO UPDATE SET
      url = excluded.url,
      title = excluded.title,
      image = excluded.image,
      price = excluded.price,
      original_price = excluded.original_price,
      discount_percent = excluded.discount_percent,
      currency = excluded.currency,
      updated_at = datetime('now')
    RETURNING *
  `).get(store, storeProductId, url, title, image, price, originalPrice, discountPercent, currency, status, targetPrice);
  return row;
}

export function listProducts(status) {
  if (status) {
    return db.prepare(`SELECT * FROM products WHERE status = ? ORDER BY created_at DESC`).all(status);
  }
  return db.prepare(`SELECT * FROM products ORDER BY created_at DESC`).all();
}

export function getProduct(id) {
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
}

export function getProductByStoreRef(store, storeProductId) {
  return db.prepare(`SELECT * FROM products WHERE store = ? AND store_product_id = ?`).get(store, storeProductId);
}

export function updateProduct(id, fields) {
  const allowed = ["status", "target_price"];
  const provided = Object.entries(fields).filter(
    ([k, v]) => allowed.includes(k) && v !== undefined
  );
  if (provided.length === 0) return getProduct(id);
  const set = provided.map(([k]) => `${k} = ?`).join(", ");
  const values = provided.map(([, v]) => v);
  db.prepare(`UPDATE products SET ${set}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
  return getProduct(id);
}

export function deleteProduct(id) {
  const info = db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  db.prepare(`DELETE FROM price_history WHERE product_id = ?`).run(id);
  return info.changes > 0;
}

export function addPricePoint(productId, price) {
  if (price == null) return;
  db.prepare(`INSERT INTO price_history (product_id, price) VALUES (?, ?)`).run(productId, price);
}

export function getPriceHistory(productId) {
  return db.prepare(`SELECT price, checked_at FROM price_history WHERE product_id = ? ORDER BY checked_at DESC LIMIT 50`).all(productId);
}

export function getLastPrice(productId) {
  return db.prepare(`SELECT price FROM price_history WHERE product_id = ? ORDER BY checked_at DESC LIMIT 1`).get(productId);
}

// El monitor (Fase 2) refresca los precios sin tocar status ni target_price,
// por eso necesita un update propio que solo toca las columnas de precio.
export function updateProductPrices(id, { price, originalPrice, discountPercent }) {
  db.prepare(`
    UPDATE products
    SET price = ?, original_price = ?, discount_percent = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(price, originalPrice, discountPercent, id);
}

export function addNotification({ productId, kind, message }) {
  return db.prepare(`INSERT INTO notifications_log (product_id, kind, message) VALUES (?, ?, ?)`).run(productId, kind, message);
}

export function listNotifications() {
  return db.prepare(`SELECT * FROM notifications_log ORDER BY created_at DESC LIMIT 100`).all();
}

export function registerDeviceToken(token) {
  return db.prepare(`INSERT OR IGNORE INTO device_tokens (token) VALUES (?)`).run(token);
}

export function listDeviceTokens() {
  return db.prepare(`SELECT token FROM device_tokens`).all();
}

// ---- Sesión configurable por tienda (cookies) ----

// Guarda la cookie de sesión de una tienda. ON CONFLICT en la PK `store`,
// así repetir el mismo store actualiza la cookie y la marca de tiempo.
export function setStoreCookie(store, cookie) {
  db.prepare(`
    INSERT INTO store_settings (store, cookie) VALUES (?, ?)
    ON CONFLICT(store) DO UPDATE SET
      cookie = excluded.cookie,
      updated_at = datetime('now')
  `).run(store, cookie);
}

export function getStoreCookie(store) {
  return db.prepare(`SELECT cookie, updated_at FROM store_settings WHERE store = ?`).get(store) ?? null;
}

export function listStoreSettings() {
  return db.prepare(`SELECT store, cookie, updated_at FROM store_settings`).all();
}

// ---- Fase 4: ofertas y embeddings ----

// Guarda una oferta general de una tienda. UNIQUE(store, url): si la misma
// oferta vuelve a aparecer, se actualiza (precio/descuento nuevos) en vez de
// duplicarse. `embedding` se serializa a JSON en la columna TEXT.
export function upsertOffer({ store, title, url, image, price, originalPrice, discountPercent, embedding }) {
  db.prepare(`
    INSERT INTO offers (store, title, url, image, price, original_price, discount_percent, embedding)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(store, url) DO UPDATE SET
      title = excluded.title,
      image = excluded.image,
      price = excluded.price,
      original_price = excluded.original_price,
      discount_percent = excluded.discount_percent,
      embedding = excluded.embedding,
      seen_at = datetime('now')
  `).run(
    store,
    title,
    url,
    image,
    price,
    originalPrice,
    discountPercent,
    embedding ? JSON.stringify(embedding) : null
  );
}

export function listOffers() {
  return db.prepare(`SELECT * FROM offers ORDER BY seen_at DESC`).all();
}

// Asigna (o limpia) el embedding de un producto propio. El vector vive en la
// misma fila para poder construir el "vector de gusto" sin joins extra.
export function setProductEmbedding(id, embedding) {
  db.prepare(`UPDATE products SET embedding = ? WHERE id = ?`).run(
    embedding ? JSON.stringify(embedding) : null,
    id
  );
}
