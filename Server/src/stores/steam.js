import axios from "axios";

export async function extractSteam({ storeProductId }) {
  const cc = process.env.STEAM_CC || "MX";
  const lang = process.env.STEAM_LANG || "spanish";

  const res = await axios.get("https://store.steampowered.com/api/appdetails", {
    params: { appids: storeProductId, cc, l: lang },
    timeout: 15000,
  });

  const app = res.data?.[storeProductId];
  if (!app?.success || !app.data) {
    throw new Error("Steam no encontró el juego (appid inválido)");
  }

  const d = app.data;
  const p = d.price_overview;
  const price = p ? p.final / 100 : null;
  const originalPrice = p ? p.initial / 100 : null;

  return {
    title: d.name,
    image: d.header_image,
    price,
    originalPrice,
    discountPercent: p?.discount_percent || 0,
    currency: p?.currency || null,
  };
}

// Ofertas destacadas de la tienda Steam (API pública y gratuita, no scraping).
// "/api/featured" devuelve canastas de juegos en oferta; cada item trae
// original_price EN CENTAVOS (25999 = 259.99) y discount_percent.
export async function fetchDeals() {
  const res = await axios.get("https://store.steampowered.com/api/featured/", {
    timeout: 15000,
  });
  const data = res.data || {};
  const baskets = [data.featured_win, data.featured_mac, data.featured_linux].filter(Boolean);
  const seen = new Set();
  const offers = [];
  for (const basket of baskets) {
    for (const item of basket) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      const original = item.original_price / 100;
      const discount = item.discount_percent || 0;
      offers.push({
        store: "steam",
        title: item.name,
        url: `https://store.steampowered.com/app/${item.id}`,
        image: item.header_image || null,
        price: +(original * (1 - discount / 100)).toFixed(2),
        originalPrice: +original.toFixed(2),
        discountPercent: discount,
        currency: item.currency || "MXN",
      });
    }
  }
  return offers;
}
