# AppMovilOfertas — Contexto del proyecto (handoff)

Documento para transferir el estado del proyecto a otra IA. Contiene decisiones,
arquitectura, estado actual, detalles técnicos importantes y próximos pasos.

> Actualizado al estado: **Fases 1, 2 y 4 (parcial: backend + UI lista, falta la API key) y 6 (parcial)**.
> Fase 5 pendiente.

---

## 1. Qué es

App **personal** (no se publica) para monitorear ofertas de tiendas online
(Amazon, Steam y otras que se agreguen) y recibir notificaciones cuando:

- Un producto que marqué como **"Lo quiero"** baja de precio, tiene descuento %
  o alcanza un **precio objetivo** que yo definí.
- Una **recomendación** (productos parecidos a lo que quiero/compro, rankeados
  por un motor de IA) aparece en oferta.

Los productos se registran **pegando el link** (de Amazon o Steam por ahora).

## 2. Decisiones ya tomadas (no reabrir sin preguntar)

1. **Cliente móvil**: Angular + Ionic + Capacitor (starter "photo-gallery" adaptado).
2. **Notificaciones**: FCM (Firebase Cloud Messaging) push real, **no** Telegram.
   (Fase 5 aún no implementada.)
3. **Motor de recomendaciones**: embeddings locales con **Ollama + bge-m3**
   (multilingüe, 1024 dims, corre en el PC del usuario sin costo) + vector de
   "gusto" promedio. Cambiado desde OpenAI (la cuenta no tenía cuota). El server
   necesita Ollama corriendo en localhost:11434.
4. **Amazon**: scraping con cookies de sesión del usuario + headers de Chrome
   reales. Aceptado: usar una cuenta y baja frecuencia de scraping para no ser
   bloqueado.
5. **Base de datos**: **NO compilar nada nativo**. Node 24 trae `node:sqlite`
   integrado → CERO dependencias nativas. OJO: en esta máquina NO hay Visual
   Studio Build Tools, así que módulos nativos tipo `better-sqlite3` NO se
   pueden instalar/compilar.

## 3. Stack y scripts oficiales

- **Server**: Node 24 + Express 5 (ESM, imports con `.js`), `axios`, `cheerio`,
  `node-cron`, `dotenv`. BD: `node:sqlite`.
- **Client**: Angular 20 + Ionic 8 + Capacitor 8 (módulos NgModule,
  `standalone: false`).

Scripts:
- Server: `npm run dev` (nodemon) o `npm start` → puerto :3000.
- Client: `npm run build`, `npm start` (`ng serve` en :8100).

## 4. Estructura del proyecto

```
AppMovilOfertas/
  CONTEXT.md                     # este documento
  Client/                        # App Angular/Ionic (starter photo-gallery adaptado)
    src/
      app/
        models/product.ts        # Interfaces Product & AppNotification (snake_case del server)
        services/api.service.ts  # Cliente HTTP (usa environment.apiUrl)
tab1/                    # "Lo quiero": formulario de link + lista con precio
    tab2/                    # "Estadísticas": gráfica SVG de precio por producto
    tab3/                    # "Recomendaciones": placeholder de la Fase 4
        tab4/                    # "Notificaciones": historial (carpeta nueva: module/routing/page)
    tab5/                    # "Ajustes": renovar cookie de sesión por tienda (Amazon)
        tabs/                     # 4 pestañas + routing
      environments/environment.ts # apiUrl → localhost:3000.
                                 # PENDIENTE: en teléfono real apuntar a la IP local del PC
      global.scss                # clases .strike .discount .target
  Server/                        # Node/Express
    server.js                     # entry: importa src/app.js y escucha
    .env                          # PORTWEB, STEAM_CC, STEAM_LANG, AMAZON_COOKIE (secreto)
    data/ofertas.db               # BD SQLite (se crea sola)
    src/app.js                    # express (CORS, json, rutas, monta /api/products)
    src/db.js                     # node:sqlite: esquema + helpers CRUD
    src/embeddings.js             # Fase 4: wrapper Ollama/bge-m3 (embed/embedMany, local)
    src/recommender.js            # Fase 4: refresh (embeddings+ofertas) y recommend()
    src/monitor.js                # Fase 2: cron + detección de bajadas/descuentos/objetivo
    src/routes/products.js        # REST de productos (mount en app)
    src/routes/recommendations.js # Fase 4: /api/offers, refresh, recommendations
    src/stores/parser.js          # detecta tienda por URL (Amazon ASIN / Steam appid)
    src/stores/steam.js           # extractor Steam (appdetails API pública)
    src/stores/amazon.js          # extractor Amazon (scraping con cookies + headers Chrome)
    src/stores/index.js           # registro de extractores + resolveProduct()
```

## 5. Base de datos (SQLite, archivo `Server/data/ofertas.db`)

- `products` — id, store, store_product_id, url, title, image, price,
  original_price, discount_percent, currency, status ('want'|'bought'),
  target_price, embedding (para Fase 4), created_at, updated_at.
  **UNIQUE(store, store_product_id).**
- `price_history` — product_id, price, checked_at (para detectar bajadas en Fase 2).
- `offers` — ofertas generales de tiendas (para recomendaciones, Fase 4).
- `notifications_log` — id, product_id, kind, message, created_at.
- `device_tokens` — token del celular (para Fase 5 FCM).
- `store_settings` — store, cookie, updated_at. Sesión por tienda en la BD (NO
  .env) para renovarla desde la app; genérica para futuras tiendas.

## 6. API REST (Fase 1 terminada)

- `POST /api/products` `{ url, status:'want'|'bought', targetPrice? }` — extrae
  el producto desde el link (detecta tienda: Steam/Amazon), raspea, guarda y
  registra punto de historial.
- `GET /api/products?status=` — lista productos (filtro por status).
- `GET /api/products/:id` — detalle + `price_history`.
- `PATCH /api/products/:id { status?, targetPrice? }` — cambia status o precio objetivo.
- `DELETE /api/products/:id`.
- `POST /api/device-token { token }` — registra token push (para Fase 5 FCM).
- `GET /api/notifications` — historial de notificaciones.
- `GET /api/offers` — ofertas guardadas (Steam + Amazon) de la Fase 4.
- `POST /api/recommendations/refresh` — reconstruye embeddings de productos
  propios + ofertas nuevas. Requiere `OPENAI_API_KEY`.
- `GET /api/recommendations?limit=&minScore=` — ofertas rankeadas por similitud
  coseno contra el "vector de gusto".
- `GET /api/settings/stores` — lista tiendas soportadas con su estado de sesión
  (¿requiere cookie? ¿está configurada? ¿cuándo se renovó?).
- `PUT /api/settings/stores/:store/cookie { cookie }` — guarda/renueva la cookie
  de sesión de una tienda en la BD (para Amazon; genérica por store).

## 7. Estado actual y código probado

PROBADADO y funciona:
- El server arranca y registra productos por link de **Steam** y **Amazon**.
- Steam: título, imagen, precio MXN (regional vía `cc=MX`), descuento y objetivo.
- Amazon: scraping real de la página de producto (título, precio, imagen).
- Anti-bot Amazon **RESUELTO**: NO basta con las cookies; hace falta el set
  completo de headers de un Chrome real (`Sec-Ch-Ua`, `Sec-Fetch-*`,
  User-Agent, etc.). Está implementado en `src/stores/amazon.js`.
- El cliente Ionic compila y se conecta al server: 4 pestañas funcionando,
  registro de productos por link y listado.
- **Fase 2**: cron (cada 30 min, configurable) que re-raspea cada "Lo quiero",
  guarda en `price_history` y crea notificaciones en `notifications_log` con
  dedupe (no repite la misma alerta). Probado: bajada de precio, % descuento y
  precio objetivo generan la alerta; la 2ª ejecución no genera duplicados.

## 8. Gotchas y detalles importantes

1. **Cookies de Amazon**: viven en `Server/.env` como `AMAZON_COOKIE` y se
   respaldan/renuevan en la BD (tabla `store_settings`) desde el tab **Ajustes**
   de la app: `amazon.js` lee primero la BD y cae al `.env` si no hay. Caducan
   al cambiar de sesión/navegador. Si Amazon no devuelve `title`, el error ya
   lo dice: renovar la cookie (navegador → DevTools → Console → document.cookie
   → pegarla en el tab Ajustes, sin tocar el terminal).
2. **`node:sqlite` vs `better-sqlite3`**: solo usar `node:sqlite`. better-sqlite3
   exige Visual Studio Build Tools que NO están instaladas en el equipo del
   usuario. NO reintroducir dependencias nativas.
3. **Formato de precios**: los precios vienen con símbolo de moneda y separadores
   regionales (Amazon real, Steam con `cc=MX`). Hay un parser en amazon.js que
   maneja "MX$ 1,299.00" → 1299. Usarlo como referencia.
4. **CORS**: el server usa `cors()` abierto, el cliente web funciona en
   `localhost:8100 → localhost:3000`.
5. **Ollama**: el motor de recomendaciones necesita el server local en
   `localhost:11434` con el modelo `bge-m3` descargado (`ollama pull bge-m3`).
   En Windows el ejecutable está en `X:\Ollama\ollama.exe`; se arranca con
   `ollama serve` (o el app de bandeja, que conviene dejar en autostart para no
   depender de encenderlo a mano).
5. **Cliente en teléfono real** (Capacitor): hay que apuntar `apiUrl` en
   `environment.ts` a la IP local del PC (ej. `http://192.168.1.10:3000`).

## Siguiente fase y pendientes

- **Fase 2 — Monitoreo de precios**: HECHA. Cron (`node-cron`) en `src/monitor.js`
  que re-raspea cada "Lo quiero", compara contra su último `price_history` y
  notifica si: bajó de precio, entró en oferta (% descuento), o cruza bajo su
  `target_price`. Dedupe por estado anterior (no spam). Config: `MONITOR_CRON`,
  `MONITOR_ENABLED`, `MONITOR_DELAY_MS` en `.env`. Aún SIN push (se ve en el tab
  Notificaciones).
- **Fase 4 — Recomendaciones (motor IA)**: HECHA (backend + UI del tab). Embeddings
  locales con **Ollama + bge-m3** (`http://localhost:11434`) para cada producto
  propio → "vector de gusto" (promedio de "Lo quiero" + "Lo compro"). Ofertas
  generales raspadas: Steam API `/api/featured` + Amazon "Today's Deals" (JSON
  `productSearchResponse` embebido en la página /deals) → guardadas en `offers`
  con su embedding → rankeadas por similitud coseno. **Requiere Ollama corriendo
  y el modelo `bge-m3` bajado** (`ollama serve` + `ollama pull bge-m3`); si no,
  el refresh responde 400/500 con mensaje claro. Config: `EMBED_MODEL` y
  `OLLAMA_URL` en `.env`.
- **Fase 5 — Notificaciones push FCM**: usar `firebase-admin` en el server y
  `@capacitor/push-notifications` en el cliente. Registrar el token del
  dispositivo vía `POST /api/device-token`. Cuando se genere un evento de
  Fase 2, enviar push. Verificar dedupe para no spamear.
- **Fase 6 (resto de la UI)**: rellenar pestaña Recomendaciones con los
  resultados reales.
- **Agregar una tienda nueva**: queda por crear un parser de URL + extractor de
  página + registro en `src/stores/index.js`.

## Flujo completo (experiencia del usuario)

Abre la app → pega un link en "Lo quiero" → el server lo registra y lo vigila
con el cron → cuando baja de precio / cumple objetivo / sale recomendación,
se dispara una notificación (Fase 5) y queda en el historial (tab Notificaciones).
"Lo compro" guarda lo comprado y sirve como señal para el motor de
recomendaciones (Fase 4).

---

## Notas de seguridad

El archivo `Server/.env` contiene **cookies de sesión reales** de Amazon y, en
el futuro, claves de OpenAI/Firebase. No subirlo a ningún repositorio público.

## Tips para otra IA que continúe

1. Para probar la Fase 2 sin esperar al cron: ejecutar `runMonitoring()` desde
   `src/monitor.js` (ej: `node --input-type=module -e "import { runMonitoring } from './src/monitor.js'; await runMonitoring()"`).
2. La BD vive en `Server/data/ofertas.db`; se puede borrar/inicializar sin
   apagar nada. No borrar páginas del navegador del usuario.
3. Las notificaciones de la Fase 2 no se mandan todavía por push; primero
   generarlas en `notifications_log` y mostrarlas en el tab Notificaciones.
4. Respete el acuerdo de "baja frecuencia de scraping" (no disparar cientos de
   peticiones a Amazon; espaciar el cron con `MONITOR_DELAY_MS`).