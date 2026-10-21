import { Injectable } from '@angular/core';
import { Observable, of, merge, timer, fromEvent, Subject } from 'rxjs';
import { map, switchMap, mapTo, catchError, startWith, distinctUntilChanged, shareReplay, timeout } from 'rxjs/operators';
import { fromFetch } from 'rxjs/fetch';
import { environment } from '../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ConnectionService {
    private status$ = new Subject<boolean>();
    setOnline(online: boolean) { this.status$.next(online); }

    isOnline$ = merge(
        this.status$,
        fromEvent(window, 'online').pipe(map(() => true)),
        fromEvent(window, 'offline').pipe(map(() => false)),
        of(navigator.onLine),
        timer(0, 10000).pipe(switchMap(() => fromFetch(`${environment.apiUrl}/health`, { method: 'GET' }).pipe(mapTo(true),
            timeout(5000),
            catchError(() => of(false))
        )
        ))
    ).pipe(startWith(navigator.onLine),
        distinctUntilChanged(),
        shareReplay(1));

}