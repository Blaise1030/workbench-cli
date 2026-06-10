/**
 * Builds an agent-ready prompt instructing an assistant to install mkcert
 * and generate the PEM files workbench-cli expects for HTTPS.
 */
export function tlsCertPaths(host: string): {
  certFile: string;
  keyFile: string;
  mkcertHosts: string[];
} {
  const trimmedHost = host.trim();
  const mkcertHosts = [trimmedHost, "localhost", "127.0.0.1"];
  const base = mkcertHosts[mkcertHosts.length - 1]!;
  const certDir = "~/.workbench/certs";
  return {
    certFile: `${certDir}/${base}.pem`,
    keyFile: `${certDir}/${base}-key.pem`,
    mkcertHosts,
  };
}

export function buildTlsSetupPrompt(host: string): string {
  const { certFile, keyFile, mkcertHosts } = tlsCertPaths(host);
  const mkcertArgs = mkcertHosts.join(" ");
  return [
    "Set up local HTTPS certificates so workbench-cli can serve over https.",
    "Install mkcert if it is not already available (macOS: `brew install mkcert`).",
    "Run `mkcert -install` to trust the local CA (idempotent).",
    `Create \`~/.workbench/certs\` if needed, then generate the PEM files only if they do not already exist:`,
    `\`mkcert -cert-file ${certFile} -key-file ${keyFile} ${mkcertArgs}\`.`,
    "After setup, confirm both PEM files exist, then tell me to restart workbench-cli without `--http`.",
  ].join(" ");
}
