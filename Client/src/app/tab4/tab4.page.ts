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

  constructor(private api: ApiService) {}

  ionViewWillEnter() {
    this.load();
  }

  load() {
    this.api.getNotifications().subscribe((n) => (this.notifications = n));
  }

  // Cada tipo de notificación (definido en el servidor, Fase 2) tiene su icono
  // y color para que el historial se entienda de un vistazo.
  iconFor(kind: string): string {
    switch (kind) {
      case 'price_drop':
        return 'trending-down';
      case 'discount':
        return 'pricetag';
      case 'target_hit':
        return 'flag';
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
      case 'target_hit':
        return 'primary';
      case 'recommendation':
        return 'tertiary';
      default:
        return 'medium';
    }
  }
}
