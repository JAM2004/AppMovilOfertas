// Este archivo se reemplaza por environment.prod.ts en builds de producción
// (ver "fileReplacements" en angular.json).

export const environment = {
  production: false,
  // URL del servidor de ofertas. En desarrollo web apunta a localhost.
  // OJO: al correr la app en un teléfono real (Capacitor) esto debe apuntar
  // a la IP de tu PC en la red local (ej: http://192.168.1.10:3000).
  apiUrl: 'http://localhost:3000',
};
