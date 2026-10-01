import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular';
import { ApiService } from '../services/api.service';
import { Recommendation } from '../models/product';
import { STORE_CONFIG, STORE_TEXT_CONTRAST } from '../store-config';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  items: Recommendation[] = [];
  reason: string | null = null;
  loading = false;

  storeConfig = STORE_CONFIG;
  storeTextContrast = STORE_TEXT_CONTRAST; // Color del texto para contraste adecuado

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() {
    this.load();
  }
loadError: string | null = null;
  loadingList = true; // true inicial: el primer pintado ya muestra "cargando", no "vacío"
  load() {
    this.loadError = null;
    this.loadingList = true;
    this.api.getRecommendations(20).subscribe({
      next: (res) => {
        this.items = res.items;
        this.reason = res.reason;
        this.loadingList = false;
      },
      error: () => {
        this.loadError = 'No se pudo conectar con el servidor';
        this.loadingList = false;
      }
    });
  }

  // Refresca el motor: embebe tus productos y trae ofertas nuevas. Puede
  // tardar unos segundos porque llama a Ollama local (bge-m3).
  async refresh() {
    this.loading = true;
    try {
      const res = await firstValueFrom(this.api.refreshRecommendations());
      this.load();
      const toast = await this.toastCtrl.create({
        message: `Motor listo: ${res.productsEmbedded} productos y ${res.offersSaved} ofertas procesadas`,
        duration: 2500,
      });
      await toast.present();
    } catch (err) {
      const msg =
        (err as { error?: { error?: string } })?.error?.error ||
        'No se pudo refrescar el motor';
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

  // El score ya es un % de similitud (0..1); lo mostramos como porcentaje.
  scorePct(score: number): string {
    return Math.round(score * 100) + '%';
  }
}
