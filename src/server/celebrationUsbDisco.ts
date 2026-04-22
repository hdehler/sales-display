import { exec } from "child_process";
import { config } from "./config.js";

let offTimer: ReturnType<typeof setTimeout> | null = null;

function runCmd(cmd: string, label: string): void {
  exec(cmd, { timeout: 25_000 }, (err, _stdout, stderr) => {
    if (err) {
      console.warn(
        `[Celebration/USB] ${label} failed:`,
        err.message,
        stderr ? String(stderr).trim() : "",
      );
    }
  });
}

export function celebrationUsbConfigured(): boolean {
  return Boolean(
    config.celebration.usbDiscoOnCmd && config.celebration.usbDiscoOffCmd,
  );
}

export function celebrationUsbLightOn(): void {
  if (!celebrationUsbConfigured()) return;
  runCmd(config.celebration.usbDiscoOnCmd, "ON");
}

export function celebrationUsbLightOff(): void {
  if (!celebrationUsbConfigured()) return;
  runCmd(config.celebration.usbDiscoOffCmd, "OFF");
}

/**
 * Ensure the disco port is off when the process starts (boot usually leaves USB powered on).
 * Repeats OFF at staggered delays — the first exec often runs before uhubctl/USB is ready on Pi.
 * No-op unless both ON/OFF cmds are set and `usbDiscoOffOnStart` is true.
 */
export function celebrationUsbOffAtStartup(): void {
  if (!celebrationUsbConfigured()) return;
  if (!config.celebration.usbDiscoOffOnStart) return;

  const delays = config.celebration.usbStartupOffDelaysMs;
  console.log(
    `[Celebration/USB] Startup: ${delays.length} off attempt(s) at ms offsets [${delays.join(", ")}] (until one sticks).`,
  );

  for (let i = 0; i < delays.length; i++) {
    const ms = delays[i];
    const n = i + 1;
    setTimeout(() => {
      console.log(`[Celebration/USB] Startup off ${n}/${delays.length} (t+${ms}ms)`);
      celebrationUsbLightOff();
    }, ms);
  }
}

/**
 * Turn light on and schedule off after `durationMs` (aligned with celebration overlay).
 * Cancels any pending off timer from a previous celebration.
 */
export function celebrationUsbScheduleForDuration(durationMs: number): void {
  if (!celebrationUsbConfigured()) return;
  celebrationUsbCancelScheduled(false);
  celebrationUsbLightOn();
  offTimer = setTimeout(() => {
    offTimer = null;
    celebrationUsbLightOff();
  }, durationMs);
}

/** Clear scheduled off; optionally run OFF immediately (early Stop from UI). */
export function celebrationUsbCancelScheduled(runOffImmediately: boolean): void {
  if (offTimer) {
    clearTimeout(offTimer);
    offTimer = null;
  }
  if (runOffImmediately) celebrationUsbLightOff();
}
