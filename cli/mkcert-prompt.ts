import * as readline from "node:readline";
import { platform } from "node:os";

export function getMkcertInstallHint(): string {
  const os = platform();
  if (os === "darwin") return "Will install via Homebrew (brew install mkcert).";
  if (os === "linux") return "Will install via apt (sudo apt-get install -y mkcert).";
  return "Install manually: https://github.com/FiloSottile/mkcert#installation";
}

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function promptMkcertInstall(): Promise<boolean> {
  if (!isInteractiveTerminal()) {
    console.log("\n  mkcert is not installed and this session is not interactive.");
    console.log(`  ${getMkcertInstallHint()}`);
    console.log("  Use --http for HTTP-only mode, or --yes to install without prompting.\n");
    return false;
  }

  console.log("\n  mkcert is not installed.");
  console.log("  It provides trusted HTTPS certificates for localhost.");
  console.log(`  ${getMkcertInstallHint()}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await new Promise<boolean>((resolve) => {
      rl.question("  Install mkcert now? (y/N) ", (answer) => {
        const normalized = answer.trim().toLowerCase();
        resolve(normalized === "y" || normalized === "yes");
      });
    });
  } finally {
    rl.close();
  }
}
