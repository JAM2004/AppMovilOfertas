import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// Inicialización perezosa: el server arranca aunque FCM no esté configurado;
// solo truena al intentar enviar sin credenciales.
let app = null;

function getApp() {
  if (app) return app;
  const { FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY } = process.env;
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    throw new Error("FCM no configurado: faltan FCM_* en .env");
  }
  app = initializeApp({
    credential: cert({
      projectId: FCM_PROJECT_ID,
      clientEmail: FCM_CLIENT_EMAIL,
      // La llave viaja con \n literales; aquí se vuelven saltos reales.
      privateKey: FCM_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

// Envía a varios tokens. Un token muerto (app desinstalada) se reporta
// y NO tumba el resto del lote.
export async function sendPush(tokens, { title, body }) {
  const list = [...new Set((tokens ?? []).filter(Boolean))];
  if (list.length === 0) return { sent: 0, failed: 0 };
  const messaging = getMessaging(getApp());
  let sent = 0;
  const failed = [];
  for (const token of list) {
    try {
      await messaging.send({ token, notification: { title, body } });
      sent++;
    } catch (err) {
      failed.push({ token: token.slice(0, 12) + "…", error: err.message });
    }
  }
  if (failed.length > 0) console.error("[push] fallos:", failed);
  return { sent, failed: failed.length };
}