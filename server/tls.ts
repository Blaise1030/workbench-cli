import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface TLSCredentials {
  key: Buffer;
  cert: Buffer;
}

export interface CertPaths {
  certFile: string;
  keyFile: string;
} 

export function parseCertPaths(cacheDir: string, ...hosts: string[]): CertPaths {
  const base = hosts[hosts.length - 1];
  return {
    certFile: join(cacheDir, `${base}.pem`),
    keyFile: join(cacheDir, `${base}-key.pem`),
  };
}

export function buildCertArgs(cacheDir: string, ...hosts: string[]): string[] {
  const { certFile, keyFile } = parseCertPaths(cacheDir, ...hosts);
  return ["-cert-file", certFile, "-key-file", keyFile, ...hosts];
}

export function isMkcertInstalled(): boolean {
  try {
    execSync("mkcert -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export interface EnsureTlsOptions {
  /** When false, fail immediately if mkcert is not on PATH. */
  autoInstall?: boolean;
  /** When mkcert is missing, ask before running installMkcert. */
  confirmInstall?: () => Promise<boolean>;
}

function installMkcert(): void {
  const os = platform();
  if (os === "darwin") {
    console.log("  Installing mkcert via brew...");
    execSync("brew install mkcert", { stdio: "inherit" });
  } else if (os === "linux") {
    console.log("  Installing mkcert via apt...");
    execSync("sudo apt-get install -y mkcert", { stdio: "inherit" });
  } else {
    throw new Error(
      "mkcert not found. Install it manually: https://github.com/FiloSottile/mkcert#installation",
    );
  }
}

export async function ensureTLS(
  hosts: string[],
  options: EnsureTlsOptions = {},
): Promise<TLSCredentials> {
  if (hosts.length === 0) {
    throw new Error("ensureTLS requires at least one host");
  }

  const autoInstall = options.autoInstall ?? true;

  if (!isMkcertInstalled()) {
    if (!autoInstall) {
      throw new Error(
        "mkcert not found. Install it manually: https://github.com/FiloSottile/mkcert#installation",
      );
    }

    const approved = options.confirmInstall
      ? await options.confirmInstall()
      : false;

    if (!approved) {
      throw new Error(
        "mkcert is not installed. Install it manually: https://github.com/FiloSottile/mkcert#installation",
      );
    }

    installMkcert();
  }

  // Install local CA (idempotent)
  execSync("mkcert -install", { stdio: "inherit" });

  const cacheDir = join(homedir(), ".workbench", "certs");
  mkdirSync(cacheDir, { recursive: true });

  const { certFile, keyFile } = parseCertPaths(cacheDir, ...hosts);

  if (!existsSync(certFile) || !existsSync(keyFile)) {
    console.log(`  Generating cert for ${hosts.join(", ")}...`);
    execFileSync("mkcert", buildCertArgs(cacheDir, ...hosts), { stdio: "inherit" });
  }

  return {
    key: readFileSync(keyFile),
    cert: readFileSync(certFile),
  };
}
