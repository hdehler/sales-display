import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function scriptPath(): string {
  return path.join(__dirname, "../../scripts/kasa_set_power.py");
}

function pythonBin(): string {
  return (process.env.KASA_PYTHON_BIN || "python3").trim() || "python3";
}

/** True if `import kasa` works. */
export function probePythonKasa(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(pythonBin(), ["-c", "import kasa"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

export async function setPowerViaPythonKasa(
  host: string,
  state: boolean,
): Promise<void> {
  const arg = state ? "on" : "off";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pythonBin(), [scriptPath(), host, arg], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `python-kasa exited ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
    });
  });
}

/** Exposed for status endpoint */
export function getKasaPythonBin(): string {
  return pythonBin();
}
