import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { networkInterfaces } from "os";
import { createToken } from "./token.js";

const isDev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT ?? (isDev ? "3001" : "3000"), 10);

const sessionToken = createToken();

function getLanIP(): string {
  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

const app = new Hono();

if (!isDev) {
  app.use("/*", serveStatic({ root: "./dist" }));
}

const server = serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" });

const lanIP = getLanIP();
const openURL = `http://${lanIP}:${PORT}/?token=${sessionToken.value}`;
console.log(`\n  Access token: ${sessionToken.value}`);
console.log(`  Open: ${openURL}\n`);
