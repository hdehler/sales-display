import tplink from "tplink-smarthome-api";
import { config } from "./config.js";
import {
  getKasaPythonBin,
  probePythonKasa,
  setPowerViaPythonKasa,
} from "./kasaPython.js";

const { Client } = tplink;
const client = new Client();
const discoveredPlugs = new Map<
  string,
  { setPowerState: (s: boolean) => Promise<void>; alias?: string }
>();

/** Hosts where tplink failed (e.g. ECONNREFUSED :9999) — we drive via python-kasa. */
const pythonKasaHosts = new Set<string>();

export async function initPlugs(): Promise<void> {
  if (config.homeAssistant.plugsViaHomeAssistantOnly) {
    console.log(
      "[Plugs] HOME_ASSISTANT_PLUGS_ONLY=true — skipping local Kasa (tplink + python-kasa).",
    );
    return;
  }

  for (const host of config.plugs.hosts) {
    try {
      const device = await client.getDevice({ host });
      const info = await device.getSysInfo();
      discoveredPlugs.set(host, device as never);
      console.log(
        `[Plugs] Connected to ${(info as Record<string, unknown>).alias || "unknown"} at ${host}`,
      );
    } catch {
      console.warn(
        `[Plugs] Legacy TP-Link API unavailable at ${host} (port 9999). Using python-kasa fallback.`,
      );
      pythonKasaHosts.add(host);
    }
  }

  if (pythonKasaHosts.size > 0) {
    const ok = await probePythonKasa();
    if (ok) {
      console.log(
        `[Plugs] python-kasa ready (${getKasaPythonBin()}) for: ${[...pythonKasaHosts].join(", ")}`,
      );
    } else {
      console.warn(
        `[Plugs] python-kasa not importable. Install on this machine: pip3 install -r requirements-kasa.txt`,
      );
    }
  }

  if (config.plugs.autoDiscover) {
    console.log("[Plugs] Starting auto-discovery...");
    client
      .startDiscovery({ discoveryInterval: 10000 })
      .on("device-new", (device) => {
        const host = device.host;
        if (!discoveredPlugs.has(host) && !pythonKasaHosts.has(host)) {
          discoveredPlugs.set(host, device as never);
          console.log(
            `[Plugs] Discovered: ${device.alias || "unknown"} at ${host}`,
          );
        }
      });
  }

  if (
    config.plugs.hosts.length === 0 &&
    !config.plugs.autoDiscover
  ) {
    console.warn(
      "[Plugs] No plug hosts configured and auto-discover is off. Smart plugs disabled.",
    );
  }
}

export async function setAllPlugs(state: boolean): Promise<void> {
  const label = state ? "ON" : "OFF";
  const total = discoveredPlugs.size + pythonKasaHosts.size;
  if (total === 0) {
    console.warn(
      `[Plugs] No Kasa devices in memory — cannot turn ${label}. Set KASA_PLUG_HOSTS in .env and/or ensure discovery sees the plug (same LAN as this server). GET /api/plugs/status`,
    );
    return;
  }
  for (const [host, device] of discoveredPlugs) {
    try {
      await device.setPowerState(state);
      console.log(`[Plugs] ${host} → ${label} (tplink)`);
    } catch (err) {
      console.warn(`[Plugs] Failed to set ${host} ${label}:`, err);
    }
  }
  for (const host of pythonKasaHosts) {
    try {
      await setPowerViaPythonKasa(host, state);
      console.log(`[Plugs] ${host} → ${label} (python-kasa)`);
    } catch (err) {
      console.warn(`[Plugs] python-kasa failed ${host} ${label}:`, err);
    }
  }
}

export function getDiscoveredPlugs(): string[] {
  const merged = new Set<string>([
    ...discoveredPlugs.keys(),
    ...pythonKasaHosts,
  ]);
  return [...merged];
}

/** For `/api/plugs/status` and ops — verify LAN discovery without reading raw logs only. */
export function getPlugsStatus(): {
  kasaAutoDiscover: boolean;
  kasaHostsConfigured: string[];
  kasaDiscoveredHosts: string[];
  kasaDiscoveredCount: number;
  kasaTplinkHosts: string[];
  kasaPythonFallbackHosts: string[];
  kasaPythonBin: string;
  homeAssistantCelebrationWebhookConfigured: boolean;
  homeAssistantPlugsOnly: boolean;
} {
  const tplinkHosts = [...discoveredPlugs.keys()];
  const pythonHosts = [...pythonKasaHosts];
  return {
    kasaAutoDiscover: config.plugs.autoDiscover,
    kasaHostsConfigured: config.plugs.hosts,
    kasaDiscoveredHosts: getDiscoveredPlugs(),
    kasaDiscoveredCount: tplinkHosts.length + pythonHosts.length,
    kasaTplinkHosts: tplinkHosts,
    kasaPythonFallbackHosts: pythonHosts,
    kasaPythonBin: getKasaPythonBin(),
    homeAssistantCelebrationWebhookConfigured: Boolean(
      config.homeAssistant.celebrationWebhookUrl,
    ),
    homeAssistantPlugsOnly: config.homeAssistant.plugsViaHomeAssistantOnly,
  };
}
