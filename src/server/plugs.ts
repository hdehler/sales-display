import tplink from "tplink-smarthome-api";
import { config } from "./config.js";

const { Client } = tplink;
const client = new Client();
const discoveredPlugs = new Map<string, { setPowerState: (s: boolean) => Promise<void>; alias?: string }>();

export async function initPlugs(): Promise<void> {
  for (const host of config.plugs.hosts) {
    try {
      const device = await client.getDevice({ host });
      const info = await device.getSysInfo();
      discoveredPlugs.set(host, device as never);
      console.log(
        `[Plugs] Connected to ${(info as Record<string, unknown>).alias || "unknown"} at ${host}`,
      );
    } catch (err) {
      console.warn(`[Plugs] Failed to connect to ${host}:`, err);
    }
  }

  if (config.plugs.autoDiscover) {
    console.log("[Plugs] Starting auto-discovery...");
    client
      .startDiscovery({ discoveryInterval: 10000 })
      .on("device-new", (device) => {
        const host = device.host;
        if (!discoveredPlugs.has(host)) {
          discoveredPlugs.set(host, device as never);
          console.log(
            `[Plugs] Discovered: ${device.alias || "unknown"} at ${host}`,
          );
        }
      });
  }

  if (config.plugs.hosts.length === 0 && !config.plugs.autoDiscover) {
    console.warn(
      "[Plugs] No plug hosts configured and auto-discover is off. Smart plugs disabled.",
    );
  }
}

export async function setAllPlugs(state: boolean): Promise<void> {
  const label = state ? "ON" : "OFF";
  for (const [host, device] of discoveredPlugs) {
    try {
      await device.setPowerState(state);
      console.log(`[Plugs] ${host} → ${label}`);
    } catch (err) {
      console.warn(`[Plugs] Failed to set ${host} ${label}:`, err);
    }
  }
}

export function getDiscoveredPlugs(): string[] {
  return Array.from(discoveredPlugs.keys());
}

/** For `/api/plugs/status` and ops — verify LAN discovery without reading raw logs only. */
export function getPlugsStatus(): {
  kasaAutoDiscover: boolean;
  kasaHostsConfigured: string[];
  kasaDiscoveredHosts: string[];
  kasaDiscoveredCount: number;
  homeAssistantCelebrationWebhookConfigured: boolean;
  homeAssistantPlugsOnly: boolean;
} {
  return {
    kasaAutoDiscover: config.plugs.autoDiscover,
    kasaHostsConfigured: config.plugs.hosts,
    kasaDiscoveredHosts: getDiscoveredPlugs(),
    kasaDiscoveredCount: discoveredPlugs.size,
    homeAssistantCelebrationWebhookConfigured: Boolean(
      config.homeAssistant.celebrationWebhookUrl,
    ),
    homeAssistantPlugsOnly: config.homeAssistant.plugsViaHomeAssistantOnly,
  };
}
