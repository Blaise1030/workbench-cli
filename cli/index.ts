#!/usr/bin/env node
import { ensureTLS } from "../server/tls.js";
import { getLanIP, startServer } from "../server/index.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function main(): Promise<void> {
  const lanIP = getLanIP();
  console.log("\n  lan-terminal starting...");
  console.log(`  Detected LAN IP: ${lanIP}`);

  let tls;
  try {
    tls = await ensureTLS(lanIP);
  } catch (err) {
    console.error("\n  TLS setup failed:", (err as Error).message);
    process.exit(1);
  }

  startServer(tls, PORT);
}

main();
