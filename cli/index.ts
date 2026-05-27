import { parseCliArgs, printCliHelp } from "./args.js";
import { promptMkcertInstall } from "./mkcert-prompt.js";
import { startServer } from "@workbench/server";

async function main(): Promise<void> {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    if (args.showHelp) {
      printCliHelp();
      return;
    }

    console.log("\n  workbench-cli starting...");
    await startServer(
      { port: args.port, host: args.host },
      {
        forceHttp: args.forceHttp,
        confirmMkcertInstall: args.assumeYes ? async () => true : promptMkcertInstall,
      },
    );
  } catch (err) {
    console.error("\n  Startup failed:", (err as Error).message);
    process.exit(1);
  }
}

main();
