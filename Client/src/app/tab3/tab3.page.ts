import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular';
import { ApiService } from '../services/api.service';
import { Recommendation } from '../models/product';

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

  storeConfig: Record<string, {
    color: string;
    label: string;
  }> = {
    amazon: {
      color: '#B45309',
      label: 'Amazon',
    },
    steam: {
      color: '#003c86',
      label: 'Steam',
    },
  };

  constructor(
    private api: ApiService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() {
    this.load();
  }

  load() {
    this.api.getRecommendations(20).subscribe((res) => {
      this.items = res.items;
      this.reason = res.reason;
    });
  }

  // Refresca el motor: embebe tus productos y trae ofertas nuevas. Puede
  // tardar unos segundos porque llama a la API de OpenAI.
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
