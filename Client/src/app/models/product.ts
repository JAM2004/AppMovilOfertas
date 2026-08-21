// Interfaz espejo del JSON que devuelve el servidor (Server/src/db.js -> products).
// Los nombres en snake_case coinciden con las columnas de SQLite para poder
// consumir la API sin transformaciones.
export interface Product {
  id: number;
  store: string;
  store_product_id: string;
  url: string;
  title: string;
  image: string | null;
  price: number | null;
  original_price: number | null;
  discount_percent: number;
  currency: string | null;
  status: 'want' | 'bought';
  target_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: number;
  product_id: number | null;
  kind: string;
  message: string;
  created_at: string;
}

// Recomendación devuelta por GET /api/recommendations (Fase 4).
export interface Recommendation {
  id: number;
  store: string;
  title: string;
  url: string;
  image: string | null;
  price: number | null;
  original_price: number | null;
  discount_percent: number;
  score: number;
}

export interface RecommendationsResponse {
  items: Recommendation[];
  reason: string | null;
}

export interface RefreshResult {
  productsEmbedded: number;
  offersSaved: number;
}

// Estado de sesión de una tienda para la pantalla de Ajustes (Fase "settings").
export interface StoreSetting {
  id: string;
  name: string;
  requiresCookie: boolean;
  hasCookie: boolean | null;
  updatedAt: string | null;
}

// Punto del historial de precios devuelto por GET /api/products/:id.
export interface PricePoint {
  price: number;
  checked_at: string;
}

// Detalle de producto con su historial de precios (para la gráfica de estadísticas).
export interface ProductDetail extends Product {
  history: PricePoint[];
}
