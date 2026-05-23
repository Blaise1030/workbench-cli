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
      "mkcert not found. Install it manually: https://github.com/FiloSottile/mkcert#installation"
    );
  }
}

export async function ensureTLS(...hosts: string[]): Promise<TLSCredentials> {
  if (hosts.length === 0) {
    throw new Error("ensureTLS requires at least one host");
  }

  if (!isMkcertInstalled()) {
    installMkcert();
  }

  // Install local CA (idempotent)
  execSync("mkcert -install", { stdio: "inherit" });

  const cacheDir = join(homedir(), ".lan-terminal", "certs");
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
