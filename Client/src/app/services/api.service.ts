import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Product,
  AppNotification,
  RecommendationsResponse,
  RefreshResult,
  StoreSetting,
  ProductDetail,
} from '../models/product';

// Servicio único para hablar con el servidor de ofertas. Centralizar las
// llamadas aquí evita repetir la URL y facilita cambiar el host (teléfono vs PC).
@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Registra un producto a partir del link compartido; el servidor detecta la
  // tienda y raspea título/precio/descuento.
  registerProduct(
    url: string,
    status: 'want' | 'bought',
    targetPrice?: number
  ): Observable<Product> {
    const body: Record<string, unknown> = { url, status };
    if (targetPrice != null) body['targetPrice'] = targetPrice;
    return this.http.post<Product>(`${this.base}/api/products`, body);
  }

  getProducts(status?: 'want' | 'bought'): Observable<Product[]> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<Product[]>(`${this.base}/api/products${params}`);
  }

  // Detalle de un producto + su historial de precios (para la gráfica).
  getProductDetail(id: number): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.base}/api/products/${id}`);
  }

  // Cambia status (want <-> bought) o actualiza el precio objetivo.
  updateProduct(
    id: number,
    changes: { status?: 'want' | 'bought'; targetPrice?: number | null }
  ): Observable<Product> {
    return this.http.patch<Product>(`${this.base}/api/products/${id}`, changes);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/products/${id}`);
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${this.base}/api/notifications`);
  }

  // Fase 4: recomendaciones rankeadas por el motor de embeddings.
  getRecommendations(limit = 20): Observable<RecommendationsResponse> {
    return this.http.get<RecommendationsResponse>(
      `${this.base}/api/recommendations?limit=${limit}`
    );
  }

  // Reconstruye embeddings de tus productos + ofertas nuevas de las tiendas.
  refreshRecommendations(): Observable<RefreshResult> {
    return this.http.post<RefreshResult>(
      `${this.base}/api/recommendations/refresh`,
      {}
    );
  }

  // Estado de sesión de las tiendas (¿requiere cookie? ¿ya está puesta?).
  getStoreSettings(): Observable<StoreSetting[]> {
    return this.http.get<StoreSetting[]>(`${this.base}/api/settings/stores`);
  }

  // Renueva la cookie de sesión de una tienda (Amazon) desde el teléfono.
  saveStoreCookie(store: string, cookie: string): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(
      `${this.base}/api/settings/stores/${store}/cookie`,
      { cookie }
    );
  }
}
