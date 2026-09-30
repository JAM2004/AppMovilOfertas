import { Component } from '@angular/core';
import { ApiService } from '../services/api.service';
import { AppNotification } from '../models/product';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page {
  notifications: AppNotification[] = [];

  constructor(private api: ApiService) { }

  ionViewWillEnter() {
    this.load();
  }
loadError: string | null = null;
loadingList = true; // true inicial: el primer pintado ya muestra "cargando", no "vacío"
load() {
  this.loadError = null;
  this.loadingList = true;
  this.api.getNotifications().subscribe({
    next: (n) => {
      this.notifications = n;
      this.loadingList = false;
    },
    error: () => {
      this.loadError = 'No se pudo conectar con el servidor';
      this.loadingList = false;
    }
  });
}

  // "2026-09-29 18:05:21" (UTC sin sufijo) → "29/09/2026 11:05" (hora local).
  fmtDate(iso: string): string {
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  // Cada tipo de notificación (definido en el servidor, Fase 2) tiene su icono
  // y color para que el historial se entienda de un vistazo.
  iconFor(kind: string): string {
    switch (kind) {
      case 'price_drop':
        return 'trending-down';
      case 'discount':
        return 'pricetag';
      case 'recommendation':
        return 'sparkles';
      default:
        return 'notifications';
    }
  }

  colorFor(kind: string): string {
    switch (kind) {
      case 'price_drop':
        return 'success';
      case 'discount':
        return 'warning';
      case 'recommendation':
        return 'tertiary';
      default:
        return 'medium';
    }
  }
}
