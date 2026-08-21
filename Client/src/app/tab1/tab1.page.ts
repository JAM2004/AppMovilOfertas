import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertController } from '@ionic/angular';
import { ApiService } from '../services/api.service';
import { Product } from '../models/product';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {
  products: Product[] = [];
  // El input de ngModel devuelve strings; el número se parsea al enviar.
  url = '';
  targetPrice = '';
  loading = false;

storeConfig: Record<string, {
  color: string;
  label: string;
}> = {

  amazon: {
    // #FF9900 (naranja Amazon) con texto blanco falla contraste 4.5:1;
    // usamos un ámbar más oscuro que conserva la identidad y cumple AA.
    color: '#B45309',
    label: 'Amazon'
  },

  steam: {
    color: '#003c86',
    label: 'Steam'
  }

};
  constructor(
    private api: ApiService,
    private alertCtrl: AlertController
  ) { }

  // ionViewWillEnter se ejecuta cada vez que entras a la pestaña, así la lista
  // se refresca aunque vengas de otra pestaña o de agregar un producto.
  ionViewWillEnter() {
    this.load();
  }

  load() {
    this.api.getProducts('want').subscribe((p) => (this.products = p));
  }

  async addProduct() {
    if (!this.url.trim() || this.loading) return;
    this.loading = true;
    try {
      // El servidor raspea el link (Amazon/Steam) y guarda el producto.
      // firstValueFrom convierte el Observable en un await manejable.
      await firstValueFrom(
        this.api.registerProduct(
          this.url.trim(),
          'want',
          this.targetPrice ? Number(this.targetPrice) : undefined
        )
      );
      this.url = '';
      this.targetPrice = '';
      this.load();
    } catch (err) {
      // El servidor responde { error: "..." } (ej: link no soportado,
      // Amazon bloqueó, ASIN inválido) -> lo mostramos en una alerta.
      const msg =
        (err as { error?: { error?: string } })?.error?.error ||
        'No se pudo registrar el producto';
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: msg,
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      this.loading = false;
    }
  }

  async remove(p: Product) {
    await firstValueFrom(this.api.deleteProduct(p.id));
    this.load();
  }
}
