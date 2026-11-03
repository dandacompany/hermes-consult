import { createApp } from "./app.ts";
const port = Number(process.env.PORT ?? 4317),
  host = process.env.HOST ?? "127.0.0.1";
const origin = process.env.PUBLIC_ORIGIN ?? `http://127.0.0.1:${port}`;
const service = createApp({
  dbPath: process.env.DB_PATH ?? ".runtime/consult.sqlite",
  origin,
  turnstileSecret: process.env.HERMES_CONSULT_TURNSTILE_SECRET,
  desktopToken: process.env.CONSULT_DESKTOP_TOKEN,
});
const server = service.app.listen(port, host, () =>
  console.log(`Hermes Consult: ${origin}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    service.close();
    server.close(() => process.exit(0));
  });

// A gateway crash must not leave a public consultation listener orphaned.
if (process.env.CONSULT_PARENT_PID) {
  const parent = Number(process.env.CONSULT_PARENT_PID);
  setInterval(() => {
    try {
      process.kill(parent, 0);
    } catch {
      service.close();
      server.close(() => process.exit(0));
    }
  }, 5000).unref();
}
