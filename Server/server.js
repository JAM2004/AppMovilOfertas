import "dotenv/config";
import { app } from "./src/app.js";
import { startMonitor, runMonitoring } from "./src/monitor.js";

const port = process.env.PORTWEB || 3000;

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);

  // El monitor (Fase 2) se programa para correr periódicamente.
  startMonitor();

  // Un barrido inicial poco después de arrancar captura de inmediato cualquier
  // bajada que haya ocurrido desde el registro; es seguro porque el dedupe
  // compara contra el último estado guardado.
  setTimeout(() => {
    runMonitoring().catch((err) => console.error("[monitor] error inicial:", err.message));
  }, 5000);
});
