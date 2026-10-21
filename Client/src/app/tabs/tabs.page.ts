import { Component } from '@angular/core';
import { ConnectionService } from '../connection.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  online$ = this.conn.isOnline$;

  constructor(private conn: ConnectionService) {}
}
