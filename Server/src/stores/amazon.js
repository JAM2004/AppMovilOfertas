import axios from "axios";
import * as cheerio from "cheerio";
import { getStoreCookie } from "../db.js";

// Resuelve la cookie de sesión con prioridad a la BD (renovable desde la app)
// y como respaldo la de .env (primera configuración). Así no hace falta
// reiniciar el server al renovarla: se lee en cada petición.
function resolveCookie() {
  return getStoreCookie("amazon")?.cookie || process.env.AMAZON_COOKIE;
}

// Huella de un navegador Chrome real. Amazon detecta bots comparando los headers
// "Sec-*" y la huella TLS: si faltan, aunque mandes cookies válidas, responde
// con la página de CAPTCHA/anti-bot en lugar del producto.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // AMAZON_COOKIE es la sesión real del usuario (DevTools > Console > document.cookie).
  // Amazon confía en peticiones con sesión iniciada; sin ella bloquea con CAPTCHA.
  Cookie: "",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  // Los "Sec-Ch-Ua" le dicen a Amazon que es un Chromium real y no un script.
  "Sec-Ch-Ua":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  // "Sec-Fetch-*" describen el contexto de la petición (navegación normal).
  // Una petición automatizada suele traer valores distintos, así que los fijamos.
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Accept-Encoding": "gzip, deflate, br, zstd",
};

export async function extractAmazon({ storeProductId }) {
  const url = `https://www.amazon.com.mx/dp/${storeProductId}`;

  const cookie = resolveCookie();
  if (!cookie) {
    throw new Error(
      "Falta AMAZON_COOKIE en .env: inicia sesión en amazon.com.mx en tu navegador, copia tus cookies (DevTools > Console > document.cookie) y pégalas ahí."
    );
  }

  const res = await axios.get(url, {
    headers: { ...HEADERS, Cookie: cookie },
    timeout: 20000,
    maxRedirects: 5,
  });

  const $ = cheerio.load(res.data);

  const title = $("#productTitle").text().trim();
  if (!title) {
    throw new Error(
      "Amazon no devolvió el producto: el ASIN no existe en amazon.com.mx o las cookies expiraron (vuelve a copiarlas del navegador)."
    );
  }

  // Precio actual: el primer bloque "a-price" con "a-offscreen".
  const priceText = $("span.a-price span.a-offscreen").first().text().trim();
  // Precio tachado (original): vive en el bloque con clase "a-text-price".
  const originalText = $("span.a-price.a-text-price span.a-offscreen")
    .first()
    .text()
    .trim();

  const price = parsePrice(priceText);
  let originalPrice = parsePrice(originalText);
  // Si el "original" es menor o igual al actual, no es un precio tachado real.
  if (originalPrice == null || originalPrice <= price) originalPrice = null;
  const discountPercent =
    price && originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;

  // La imagen principal cambia de atributo según el diseño de la página;
  // por eso probamos varios selectores.
  const image =
    $("#landingImage").attr("src") ||
    $("#landingImage").attr("data-old-hires") ||
    $("#imgBlkFront").attr("src") ||
    null;

  return {
    title,
    image,
    price,
    originalPrice,
    discountPercent,
    currency: priceText.includes("$") ? "MXN" : null,
  };
}

// Convierte "MX$1,299.00" o "$ 1,234.56" a número. Maneja el separador
// de miles y decimales según el formato regional (coma o punto).
function parsePrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  let s = cleaned;
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(".") > s.lastIndexOf(",")) s = s.replace(/,/g, "");
    else s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    if (/,\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Ofertas de "Today's Deals" de Amazon (página /deals). La página embebe un
// JSON interno (`productSearchResponse.products`) con el catálogo de ofertas,
// por lo que NO hace falta raspar el DOM por producto: un solo request nos da
// título, imagen, precio, precio anterior y % de descuento de todas las ofertas.
export async function fetchDeals() {
  const cookie = resolveCookie();
  if (!cookie) return []; // Sin sesión no pedimos la página de ofertas.

  const res = await axios.get("https://www.amazon.com.mx/deals", {
    headers: { ...HEADERS, Cookie: cookie },
    timeout: 20000,
    maxRedirects: 5,
  });

  // Extraemos el objeto JSON de productos balanceando llaves a partir de la
  // clave "productSearchResponse"; así no dependemos de un selector de HTML.
  const start = res.data.indexOf('"productSearchResponse"');
  if (start === -1) throw new Error("La página de ofertas de Amazon no trajo datos");
  const open = res.data.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < res.data.length; i++) {
    const ch = res.data[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const blob = JSON.parse(res.data.slice(open, end + 1));
  const products = blob.products || [];

  return products
    .filter((p) => p.dealDetails?.state === "AVAILABLE")
    .map((p) => {
      // La URL canónica es /dp/{ASIN} (misma forma que el extractor).
      const url = `https://www.amazon.com.mx/dp/${p.asin}`;
      const current = parsePrice(p.price?.priceToPay?.price);
      const original = parsePrice(p.price?.basisPrice?.price);
      // El descuento viene en el badge ("-17%"); Math.abs por si el signo viene
      // incluido. Si no está, lo calculamos de la diferencia de precios.
      const badgeText = p.dealBadge?.label?.content?.fragments
        ?.map((f) => f.text)
        .join("");
      let discount = Math.abs(parseInt(badgeText || "", 10)) || 0;
      if (!discount && current && original) {
        discount = Math.round((1 - current / original) * 100);
      }
      return {
        store: "amazon",
        title: p.title,
        url,
        image: p.image?.hiRes
          ? `${p.image.hiRes.baseUrl}.${p.image.hiRes.extension}`
          : null,
        price: current,
        originalPrice: original,
        discountPercent: discount,
        currency: "MXN",
      };
    });
}
