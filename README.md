# AppMovilOfertas — Monitoreo de ofertas (Angular + Ionic + Node)

App **personal** para monitorear ofertas de tiendas online (Amazon, Steam) y
recibir alertas cuando un producto marcado como **"Lo quiero"** baja de precio,
entra en descuento o alcanza su **precio objetivo**. Incluye un motor de
**recomendaciones** con embeddings locales (Ollama + `bge-m3`).

> ⚠️ **Proyecto personal, no comercial**: el scraping usa cookies de sesión
> reales y una frecuencia baja para no ser bloqueado. No la publiques con tus
> cookies ni la uses en producción con cuentas ajenas.

## Stack

- **Client**: Angular 20 + Ionic 8 + Capacitor 8 (módulos NgModule)
- **Server**: Node 24 + Express 5 (ESM), `axios`, `cheerio`, `node-cron`,
  `dotenv`. Base de datos **`node:sqlite`** (cero dependencias nativas)
- **Recomendaciones**: Ollama + modelo `bge-m3` en `localhost:11434`

## Estructura

```
Client/               # App móvil (Angular/Ionic/Capacitor)
  src/app/
    tab1  "Lo quiero"    # registro por link + lista con precio
    tab2  "Estadísticas" # gráfica SVG de precio por producto
    tab3  "Recomendaciones"
    tab4  "Notificaciones"
    tab5  "Ajustes"      # renueva cookie de sesión por tienda (Amazon)
Server/               # API REST + monitor
  server.js             # entry (puerto :3000)
  src/app.js            # express, CORS, rutas
  src/db.js             # node:sqlite: esquema + CRUD
  src/monitor.js        # cron de monitoreo de precios (Fase 2)
  src/recommender.js    # recomendaciones con embeddings (Fase 4)
  src/routes/           # REST de productos/ofrecimientos/settings
  src/stores/           # extractores: parser.js, steam.js, amazon.js
```

Base de datos: `Server/data/ofertas.db` (se crea sola). Tablas:
`products`, `price_history`, `offers`, `notifications_log`, `device_tokens`,
`store_settings`.

## Requisitos

- Node.js 24 (por `node:sqlite`) / npm
- (Opcional) [Ollama](https://ollama.com) con `ollama pull bge-m3` para las
  recomendaciones

## Instalación y ejecución

Server:

```powershell
cd Server
npm install
npm run dev        # (o npm start) → http://localhost:3000
```

Variables del server (`.env` o configúralas en la app por tienda):

| Variable        | Descripción                                     |
|-----------------|-------------------------------------------------|
| `PORTWEB`       | Puerto (default 3000)                           |
| `STEAM_CC`      | Código de moneda regional (ej. MX)              |
| `STEAM_LANG`    | Idioma de Steam (ej. es)                        |
| `AMAZON_COOKIE` | Cookie de sesión de Amazon (renovable desde la app) |

Client:

```powershell
cd Client
npm install
npm start          # → http://localhost:8100
```

Para correr en un teléfono real (Capacitor), apunta `environment.apiUrl` a la
IP local del PC, ej. `http://192.168.1.10:3000`.

## API (resumen)

- `POST /api/products` `{ url, status, targetPrice? }` — registra desde link (Steam/Amazon)
- `GET /api/products?status=` · `GET /api/products/:id` · `PATCH /api/products/:id` · `DELETE /api/products/:id`
- `POST /api/device-token` — token de push (para FCM, pendiente)
- `GET /api/notifications` — historial de alertas
- `GET /api/offers` · `POST /api/recommendations/refresh` · `GET /api/recommendations`
- `GET /api/settings/stores` · `PUT /api/settings/stores/:store/cookie`

## Estado

- ✅ Fase 1: registro de productos por link (Steam + Amazon)
- ✅ Fase 2: monitoreo de precios por cron con dedupe de alertas
- ✅ Fase 4 (backend + UI): recomendaciones por embeddings locales
- ⏳ Fase 5: notificaciones push (FCM) — pendiente
- ⏳ Fase 6: pestaña Recomendaciones con resultados reales

Más detalle técnico en [`CONTEXT.md`](CONTEXT.md) (handoff del proyecto).