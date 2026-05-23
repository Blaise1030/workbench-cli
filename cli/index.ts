#!/usr/bin/env node
import { startServer } from "../server/index.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function main(): Promise<void> {
  console.log("\n  lan-terminal starting...");
  try {
    await startServer(PORT);
  } catch (err) {
    console.error("\n  Startup failed:", (err as Error).message);
    process.exit(1);
  }
}

main();
