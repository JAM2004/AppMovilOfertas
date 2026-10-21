import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { filter, takeUntil, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ConnectionService } from '../connection.service';
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

  constructor(private http: HttpClient, private conn: ConnectionService) {}

  // Registra un producto a partir del link compartido; el servidor detecta la
  // tienda y raspea título/precio/descuento.
  registerProduct(url: string): Observable<Product> {
    return this.http.post<Product>(`${this.base}/api/products`, { url, });
  }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.base}/api/products`);
  }

  // Detalle de un producto + su historial de precios (para la gráfica).
  getProductDetail(id: number): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.base}/api/products/${id}`);
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

  registerDeviceToken(token: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/api/device-token`,
      { token }
    );
  }

  async cached<T>(key: string, fetch: () => Observable<T>): Promise<T> {
    const raw = localStorage.getItem(key);
    const local = raw ? JSON.parse(raw) : null;

    try {
      const fresh = await firstValueFrom(fetch().pipe(timeout(4000)));
      this.conn.setOnline(true);
      localStorage.setItem(key, JSON.stringify(fresh));
      return fresh;
    } catch (err: any) {
      if (!err?.status) this.conn.setOnline(false);
      if (local) return local;
      throw new Error('No hay datos en caché y la petición falló: ' + err);
    }
  }
}
