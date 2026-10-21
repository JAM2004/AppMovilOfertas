import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import {
  Product,
  ProductDetail,
  AppNotification,
} from '../models/product';

interface ChartLabel {
  x: number;
  y: number;
  value: string;
}
// Tramo entre dos mediciones consecutivas, coloreado por dirección.
interface ChartSegment {
  points: string; // "x1,y1 x2,y2"
  color: string;
  title: string; // tooltip: dirección + precio + fecha
}

// Punto ya geolocalizado dentro del área útil del SVG.
interface Dot {
  x: number;
  y: number;
  color: string; // verde=bajó, rojo=subió, gris=igual
  title: string;
}

interface GridLine {
  y: number;
  value: string;
}

interface GridCol {
  x: number;
  value: string;
}

// Colores de la paleta del design system (marca azul + slate). Los tonos se
// eligen con contraste suficiente sobre fondo claro y oscuro.
const DOWN = '#16a34a'; // = --ion-color-success: bajó de precio
const UP = '#dc2626'; // = --ion-color-danger: subió de precio
const FLAT = '#94a3b8';  // slate-400, sin token equivalente: punto neutro sobre fondo claro
// Área dibujable del SVG (coordenadas abstractas, se escala con viewBox).
const W = 340;
const H = 210;
const PAD_L = 62;
const PAD_R = 10;
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
  segments: ChartSegment[] = [];
  minLabel: ChartLabel | null = null;
  maxLabel: ChartLabel | null = null;

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
  areaPoints = '';
  dots: Dot[] = [];
  gridH: GridLine[] = [];
  gridV: GridCol[] = [];
  hasData = false;
  loading = false;

  // Resumen del periodo: primer vs último precio y su variación.
  summary = { first: 0, last: 0, pct: 0, dir: 'flat' as 'up' | 'down' | 'flat' };

  constructor(private api: ApiService) { }

  ionViewWillEnter() {
    this.loadProducts();
  }

  async loadProducts() {
    try {
      this.products = await this.api.cached('products', () => this.api.getProducts());
    } catch {
      this.products = []; // Ignorar error: la lista de productos puede estar vacía.
    }
    if (!this.selectedId && this.products.length > 0) this.selectedId = this.products[0].id;
    if (this.selectedId != null) this.selectProduct(this.selectedId);
  }

  selectProduct(id: number) {
    this.selectedId = id;
    this.loadChart();
  }

  async loadChart() {
    if (this.selectedId == null) return;
    const id = this.selectedId;
    this.loading = true;
    try {
      // Detalle con historial de precios + notificaciones (estas últimas
      // alimentan la lista "Cambios detectados" bajo la gráfica).
      const [detail, notes] = await Promise.all([
       this.api.cached(`detail-${this.selectedId}`, () => this.api.getProductDetail(id)),
       this.api.cached(`notes-${this.selectedId}`, () => this.api.getNotifications()),
      ]);
      this.detail = detail;
      this.notes = notes.filter((n) => n.product_id === detail.id);
      this.buildChart();
    } finally {
      this.loading = false;
    }
  }

  // Fecha+hora local para tooltips. Mismo fix UTC que fmtNoteDate.
  fmtDateTime(iso: string): string {
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  // Eje X compacto ("02/10"): año y hora viven en tooltips y en la lista.
  // Se conserva el fix UTC para no mover el día en el borde de medianoche.
  fmtAxisDate(iso: string): string {
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  private buildChart() {
    const hist = this.detail?.history ?? [];
    const pts = hist.filter((h) => h.price != null)
      .sort((a, b) => +new Date(a.checked_at) - +new Date(b.checked_at));

    if (pts.length < 2) {
      this.hasData = false;
      return;
    }
    this.hasData = true;

    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;

    // Dominios con margen para que la línea no toque los bordes.
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

    const coords = pts.map((pt) => `${xOf(+new Date(pt.checked_at)).toFixed(1)},${yOf(pt.price).toFixed(1)}`);
    // Segmentos: cada par consecutivo se pinta según su dirección.
    this.segments = pts.slice(1).map((pt, i) => {
      const prev = pts[i];
      let color = FLAT;
      let dir = 'igual';
      if (pt.price < prev.price) { color = DOWN; dir = 'bajó'; }
      else if (pt.price > prev.price) { color = UP; dir = 'subió'; }
      return {
        points: `${coords[i]} ${coords[i + 1]}`,
        color,
        title: `${dir}: ${this.fmtPrice(pt.price)} (${this.fmtDateTime(pt.checked_at)})`,
      };
    });

    // Área neutra (ya no verde: la línea multicolor no se sesga).
    const xFirst = xOf(tMin);
    const xLast = xOf(tMax);
    this.areaPoints = `${coords.join(' ')} ${xLast.toFixed(1)},${H - PAD_B} ${xFirst.toFixed(1)},${H - PAD_B}`;
    // Extremos etiquetados (en táctil no hay hover: min/max visibles siempre).
    const prices = pts.map((p) => p.price);
    const iMin = prices.indexOf(Math.min(...prices));
    const iMax = prices.indexOf(Math.max(...prices));
    this.minLabel = { x: xOf(+new Date(pts[iMin].checked_at)), y: yOf(pts[iMin].price), value: this.fmtPrice(pts[iMin].price) };
    this.maxLabel = iMax === iMin ? null : { x: xOf(+new Date(pts[iMax].checked_at)), y: yOf(pts[iMax].price), value: this.fmtPrice(pts[iMax].price) };

    // Puntos solo donde hubo cambio (los grises de cada pasada del cron saturaban).
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
        title: `${title}: ${this.fmtPrice(p.price)} (${this.fmtDateTime(p.checked_at)})`,
      };
    }).filter((d) => d.color !== FLAT); // fuera grises: solo cambios llevan punto

    // Ejes con valores REALES (nada interpolado: cada etiqueta es una medición).
    const uniq = [...new Set(pts.map((p) => p.price))].sort((a, b) => a - b);
    const atPrice = (f: number) => uniq[Math.min(uniq.length - 1, Math.floor(f * (uniq.length - 1)))];
    this.gridH = [0, 0.33, 0.66, 1].map((f) => {
      const pv = atPrice(f);
      return { y: yOf(pv), value: this.fmtPrice(pv) };
    });
    const atTime = (f: number) => pts[Math.min(pts.length - 1, Math.floor(f * (pts.length - 1)))].checked_at;
    // Solo etiquetas separadas ≥44px (ancho de "02/10" + aire): las amontonadas
    // se caen solas. Se compara contra la última aceptada, no la anterior.
    const keptX: number[] = [];
    this.gridV = [0, 0.33, 0.66, 1]
      .map((f) => {
        const t = atTime(f);
        return { x: xOf(+new Date(t)), value: this.fmtAxisDate(t) };
      })
      .filter((g) => {
        if (keptX.length === 0 || g.x - keptX[keptX.length - 1] >= 44) {
          keptX.push(g.x);
          return true;
        }
        return false;
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

  // Icono de notificación (misma semántica que la pestaña Notificaciones).
  iconFor(kind: string): string {
    switch (kind) {
      case 'price_drop': return 'trending-down';
      case 'discount': return 'pricetag';
      default: return 'notifications';
    }
  }

  colorFor(kind: string): string {
    switch (kind) {
      case 'price_drop': return 'success';
      case 'discount': return 'warning';
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

  fmtNoteDate(iso: string): string {
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  fmtPrice(n: number): string {
    return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}