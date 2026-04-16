import { config } from "./config.js";

/**
 * Notify Home Assistant (or any listener) via webhook when a celebration runs.
 * Payload is JSON: `{ phase, durationSeconds, source }`.
 */
export async function notifyHomeAssistantCelebrationWebhook(
  phase: "start" | "end",
  durationSeconds: number,
): Promise<void> {
  const url = config.homeAssistant.celebrationWebhookUrl;
  if (!url) return;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase,
        durationSeconds,
        source: "sales-display",
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.warn(
        `[HA] Celebration webhook ${phase} → ${r.status}: ${t.slice(0, 160)}`,
      );
    }
  } catch (e) {
    console.warn(`[HA] Celebration webhook ${phase} failed:`, e);
  }
}
