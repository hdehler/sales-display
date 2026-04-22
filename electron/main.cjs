/**
 * Desktop shell: dedicated window (no browser tabs) for the sales dashboard.
 * Requires the Node server to be running (e.g. pm2 start sales-display).
 */
const { app, BrowserWindow } = require("electron");

const DASHBOARD_URL =
  process.env.DASHBOARD_URL || "http://127.0.0.1:3000";

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    kiosk: process.env.DASHBOARD_KIOSK !== "0",
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      /** Allow celebration / walk-up sounds without requiring a tap first (kiosk). */
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  win.loadURL(DASHBOARD_URL).catch((err) => {
    console.error("Failed to load dashboard:", err);
  });

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("Load failed:", code, desc, url);
    setTimeout(() => win.loadURL(DASHBOARD_URL).catch(() => {}), 3000);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
