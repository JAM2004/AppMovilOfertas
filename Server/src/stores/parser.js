export function parseLink(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();

  if (host.includes("steampowered.com") || host.includes("steamcommunity.com")) {
    const m = u.pathname.match(/\/app\/(\d+)/);
    if (m) {
      return {
        store: "steam",
        storeProductId: m[1],
        canonicalUrl: `https://store.steampowered.com/app/${m[1]}`,
      };
    }
    return null;
  }

  if (host.includes("amazon")) {
    const m = u.pathname.match(
      /\/(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing)\/([A-Z0-9]{10})/i
    );
    const asin = m ? m[1] : u.searchParams.get("asin");
    if (asin) {
      return {
        store: "amazon",
        storeProductId: asin.toUpperCase(),
        canonicalUrl: `https://${host}/dp/${asin.toUpperCase()}`,
      };
    }
    return null;
  }

  return null;
}
