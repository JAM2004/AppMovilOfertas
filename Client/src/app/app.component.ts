import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(private api: ApiService) {}

  async ngOnInit() {
    if (!Capacitor.isNativePlatform()) return;
    try{
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;
      PushNotifications.addListener('registration', async (t) => {
      await firstValueFrom(this.api.registerDeviceToken(t.value));
    });
    PushNotifications.addListener('registrationError', (err) => 
      console.error('[push] registro fallido:', err.error)
    );
    await PushNotifications.register();
    } catch (err) {
      console.error('[push] init fallido (no critico):', err);
    }
  }
}
