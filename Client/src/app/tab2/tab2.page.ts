import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import {
  Product,
  ProductDetail,
  AppNotification,
} from '../models/product';

// Punto ya geolocalizado dentro del área útil del SVG.
interface Dot {
  x: number;
  y: number;
  color: string; // verde=bajó, rojo=subió, gris=igual
  title: string;
}

// Línea vertical que marca un evento de notificación sobre la gráfica.
interface Marker {
  x: number;
  color: string;
  label: string;
}

interface GridLine {
  y: number;
  value: string;
}

interface GridCol {
  x: number;
  value: string;
}

// Colores de la paleta del design system (esmeralda/slate). Los tonos se
// eligen con contraste suficiente sobre fondo claro y oscuro.
const DOWN = '#16A34A'; // bajó de precio
const UP = '#DC2626'; // subió de precio
const FLAT = '#94A3B8';
const GRID = 'rgba(100,116,139,0.22)';

// Área dibujable del SVG (coordenadas abstractas, se escala con viewBox).
const W = 340;
const H = 210;
const PAD_L = 48;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {
  products: Product[] = [];
  selectedId: number | null = null;

  detail: ProductDetail | null = null;
  // Notificaciones del producto seleccionado (reutilizadas para marcar la gráfica).
  notes: AppNotification[] = [];

  // Propiedades que alimentan el <svg> del template.
  // Dimensiones expuestas al template (las constantes de módulo no son visibles
  // en el HTML de Angular, por eso se re-exponen como propiedades públicas).
  chartW = W;
  chartH = H;
  padL = PAD_L;
  padR = PAD_R;
  padT = PAD_T;
  padB = PAD_B;

  viewBox = `0 0 ${W} ${H}`;
  linePoints = '';
  areaPoints = '';
  dots: Dot[] = [];
  markers: Marker[] = [];
  gridH: GridLine[] = [];
  gridV: GridCol[] = [];
  hasData = false;
  loading = false;

  // Resumen del periodo: primer vs último precio y su variación.
  summary = { first: 0, last: 0, pct: 0, dir: 'flat' as 'up' | 'down' | 'flat' };

  constructor(private api: ApiService) {}

  ionViewWillEnter() {
    this.loadProducts();
  }

  async loadProducts() {
    // Cargamos todos los productos (want y bought): cualquiera puede tener
    // historial de precios si estuvo en monitoreo.
    this.products = await firstValueFrom(this.api.getProducts());
    if (!this.selectedId && this.products.length > 0) {
      this.selectedId = this.products[0].id;
    }
    if (this.selectedId != null) this.selectProduct(this.selectedId);
  }

  selectProduct(id: number) {
    this.selectedId = id;
    this.loadChart();
  }

  async loadChart() {
    if (this.selectedId == null) return;
    this.loading = true;
    try {
      // Detalle con historial de precios + notificaciones para reusar los
      // eventos de cambio de precio como marcadores sobre la gráfica.
      const [detail, notes] = await Promise.all([
        firstValueFrom(this.api.getProductDetail(this.selectedId)),
        firstValueFrom(this.api.getNotifications()),
      ]);
      this.detail = detail;
      this.notes = notes.filter((n) => n.product_id === detail.id);
      this.buildChart();
    } finally {
      this.loading = false;
    }
  }

  private buildChart() {
    const hist = this.detail?.history ?? [];
    // Ordenamos por fecha por si acaso, y descartamos puntos sin precio.
    const pts = hist
      .filter((h) => h.price != null)
      .sort((a, b) => +new Date(a.checked_at) - +new Date(b.checked_at));

    if (pts.length < 2) {
      this.hasData = false;
      return;
    }
    this.hasData = true;

    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;

    // Dominios de tiempo y precio con un margen para que los puntos no toquen
    // los bordes. Precio: si el mínimo == máximo se da un rango mínimo.
    const tMin = +new Date(pts[0].checked_at);
    const tMax = +new Date(pts[pts.length - 1].checked_at);
    const pMin = Math.min(...pts.map((p) => p.price));
    const pMax = Math.max(...pts.map((p) => p.price));
    const span = pMax - pMin || pMax || 1;
    const yMin = pMin - span * 0.12;
    const yMax = pMax + span * 0.12;

    const xOf = (t: number) =>
      PAD_L + ((t - tMin) / (tMax - tMin || 1)) * innerW;
    const yOf = (p: number) =>
      PAD_T + ((yMax - p) / (yMax - yMin)) * innerH;

    // Generamos la polilínea de la serie y los puntos, coloreados según si el
    // precio bajó/subió respecto del punto anterior (señal "disminuyó/aumentó").
    const coords = pts.map((pt) => `${xOf(+new Date(pt.checked_at)).toFixed(1)},${yOf(pt.price).toFixed(1)}`);
    this.linePoints = coords.join(' ');
    // Relleno degradado bajo la serie: cierra la polilínea contra la base del
    // área útil, lo que hace más visible la tendencia a simple vista.
    const xFirst = xOf(tMin);
    const xLast = xOf(tMax);
    this.areaPoints = `${this.linePoints} ${xLast.toFixed(1)},${H - PAD_B} ${xFirst.toFixed(1)},${H - PAD_B}`;

    this.dots = pts.map((p, i) => {
      const prev = pts[i - 1];
      let color = FLAT;
      let title = 'precio igual';
      if (prev) {
        if (p.price < prev.price) { color = DOWN; title = 'bajó'; }
        else if (p.price > prev.price) { color = UP; title = 'subió'; }
      } else {
        title = 'precio inicial';
      }
      return {
        x: xOf(+new Date(p.checked_at)),
        y: yOf(p.price),
        color,
        title: `${title}: ${p.price} (${this.fmtDate(p.checked_at)})`,
      };
    });

    // Notificaciones del producto como líneas verticales sobre la gráfica.
    // Cada tipo de evento tiene su color para que se lea de un vistazo.
    this.markers = this.notes
      .filter((n) => n.kind !== 'recommendation')
      .map((n) => {
        const t = +new Date(n.created_at);
        return {
          x: xOf(t),
          color: this.markerColor(n.kind),
          label: this.markerLabel(n.kind),
        };
      });

    // Ejes de referencia: 4 líneas horizontales de precio y 4 verticales de fecha.
    this.gridH = Array.from({ length: 4 }, (_, i) => {
      const pv = yMin + ((yMax - yMin) * i) / 3;
      return { y: yOf(pv), value: this.fmtPrice(pv) };
    });
    this.gridV = Array.from({ length: 4 }, (_, i) => {
      const t = tMin + ((tMax - tMin) * i) / 3;
      return { x: xOf(t), value: this.fmtDate(new Date(t)) };
    });

    // Resumen: variación del primer al último precio.
    const first = pts[0].price;
    const last = pts[pts.length - 1].price;
    const pct = last && first ? ((last - first) / first) * 100 : 0;
    this.summary = {
      first,
      last,
      pct,
      dir: pct < -0.0001 ? 'down' : pct > 0.0001 ? 'up' : 'flat',
    };
  }

  // Color/etiqueta según el tipo de evento de precio reutilizado.
  markerColor(kind: string): string {
    switch (kind) {
      case 'price_drop': return DOWN; // bajada de precio
      case 'discount': return '#D97706'; // ámbar: descuento
      case 'target_hit': return '#475569'; // slate: precio objetivo
      default: return GRID;
    }
  }

  markerLabel(kind: string): string {
    switch (kind) {
      case 'price_drop': return 'bajada';
      case 'discount': return 'descuento';
      case 'target_hit': return 'objetivo';
      default: return 'evento';
    }
  }

  // Icono de notificación (misma semántica que la pestaña Notificaciones).
  iconFor(kind: string): string {
    switch (kind) {
      case 'price_drop': return 'trending-down';
      case 'discount': return 'pricetag';
      case 'target_hit': return 'flag';
      default: return 'notifications';
    }
  }

  colorFor(kind: string): string {
    switch (kind) {
      case 'price_drop': return 'success';
      case 'discount': return 'warning';
      case 'target_hit': return 'primary';
      default: return 'medium';
    }
  }

  // Texto de resumen con su flecha y porcentaje.
  summaryText(): string {
    const arrow = this.summary.dir === 'down' ? '▼' : this.summary.dir === 'up' ? '▲' : '—';
    const pct = Math.abs(this.summary.pct).toFixed(1);
    const word = this.summary.dir === 'down' ? 'disminuió' : this.summary.dir === 'up' ? 'aumentó' : 'se mantuvo';
    return `${arrow} ${word} ${pct}% desde que se agregó`;
  }

  summaryColor(): string {
    return this.summary.dir === 'down' ? 'success' : this.summary.dir === 'up' ? 'danger' : 'medium';
  }

  fmtDate(d: Date | string): string {
    const x = d instanceof Date ? d : new Date(d);
    const dd = String(x.getDate()).padStart(2, '0');
    const mm = String(x.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  fmtPrice(n: number): string {
    return `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
  }
}