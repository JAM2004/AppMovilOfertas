import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ApiService } from '../services/api.service';
import { StoreSetting } from '../models/product';

// Tab de ajustes: permite gestionar la configuración por tienda (p.ej. renovar
// la cookie de sesión de Amazon desde el teléfono). Es genérico: recorre lo que
// devuelva el servidor (/api/settings/stores), así una tienda nueva que exija
// cookie aparece aquí sin tocar el cliente.
@Component({
  selector: 'app-tab5',
  templateUrl: 'tab5.page.html',
  styleUrls: ['tab5.page.scss'],
  standalone: false,
})
export class Tab5Page {
  settings: StoreSetting[] = [];

  // Texto escrito por el usuario para cada tienda (staging antes de guardar).
  cookieInput: Record<string, string> = {};
  // Almacena qué tienda está guardando para deshabilitar su botón mientras dura.
  saving: Record<string, boolean> = {};

  constructor(private api: ApiService, private toast: ToastController) {}

  ionViewWillEnter() {
    this.load();
  }

  load() {
    // La API no expone la cookie guardada (solo si existe y cuándo se renovó),
    // así el input siempre sale vacío y solo mostramos el estado de cada tienda.
    this.api.getStoreSettings().subscribe((s) => {
      this.settings = s;
    });
  }

  save(store: StoreSetting) {
    const value = (this.cookieInput[store.id] || '').trim();
    // Guardar una cookie de una tienda que no la necesita sería un error; la UI
    // solo muestra el formulario en las que la requieren, pero igual se valida.
    if (!store.requiresCookie) return;
    if (!value) {
      this.toast
        .create({ message: `Pega la cookie de ${store.name} primero`, duration: 2000 })
        .then((t) => t.present());
      return;
    }
    this.saving[store.id] = true;
    this.api.saveStoreCookie(store.id, value).subscribe({
      next: () => {
        this.saving[store.id] = false;
        this.cookieInput[store.id] = '';
        this.toast
          .create({ message: `Sesión de ${store.name} renovada`, duration: 2000, color: 'success' })
          .then((t) => t.present());
        this.load();
      },
      error: (err) => {
        this.saving[store.id] = false;
        const msg = err?.error?.error || 'No se pudo guardar';
        this.toast.create({ message: msg, duration: 3000, color: 'danger' }).then((t) => t.present());
      },
    });
  }
}