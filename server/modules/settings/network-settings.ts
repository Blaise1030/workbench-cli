import type { NetworkSettings } from "../../schemas/api.js";
import type { LanManager } from "./lan.js";
import {
  configDiffersFromRunning,
  hostsFileLine,
  loadNetworkConfig,
  nonProdPort,
  saveNetworkConfig,
  type NetworkConfig,
  type PatchNetworkConfig,
} from "./network-config.js";

export function getRunningNetworkConfig(lan: LanManager): NetworkConfig {
  return { host: lan.getLocalHost(), port: lan.port };
}

export function buildNetworkSettings(lan: LanManager): NetworkSettings {
  const running = getRunningNetworkConfig(lan);
  const saved = loadNetworkConfig();
  return {
    host: saved.host,
    port: saved.port,
    prodPort: saved.port,
    nonProdPort: nonProdPort(saved.port),
    localUrl: lan.getLocalUrl(),
    scheme: lan.getUrlScheme(),
    hostsFileLine: hostsFileLine(saved.host),
    pendingRestart: configDiffersFromRunning(saved, running),
  };
}

export function patchNetworkSettings(
  lan: LanManager,
  patch: PatchNetworkConfig,
): NetworkSettings {
  saveNetworkConfig(patch);
  return buildNetworkSettings(lan);
}
