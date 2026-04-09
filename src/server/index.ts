import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import {
  initSlack,
  setSaleCallback,
  setHistorySaleHandler,
  setBackfillCompleteHandler,
} from "./slack.js";
import { initPlugs } from "./plugs.js";
import {
  shouldCelebrate,
  triggerCelebration,
  setCelebrationCallback,
} from "./celebration.js";
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import { insertSaleIfNew, getDashboardData } from "./db.js";
=======
import { insertSaleIfNew, getDashboardData, getSalesStats } from "./db.js";
>>>>>>> Stashed changes
=======
import { insertSaleIfNew, getDashboardData, getSalesStats } from "./db.js";
>>>>>>> Stashed changes
import type { CelebrationEvent, Sale } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV !== "production"
        ? "http://localhost:5173"
        : undefined,
  },
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/stats", (_req, res) => {
  const stats = getSalesStats();
  res.json({
    ...stats,
    slackChannelConfigured: Boolean(config.slack.salesChannelId),
    backfillOnStart: config.slack.backfillOnStart,
  });
});

if (process.env.NODE_ENV === "production") {
  const clientDir = path.join(__dirname, "../../dist/client");
  app.use(express.static(clientDir));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

io.on("connection", (socket) => {
  console.log("[Socket] Client connected");
  socket.emit("dashboard:update", getDashboardData());
  socket.on("disconnect", () => console.log("[Socket] Client disconnected"));
});

function broadcastDashboard(): void {
  io.emit("dashboard:update", getDashboardData());
}

setCelebrationCallback((event: CelebrationEvent) => {
  io.emit("celebration:start", event);
  setTimeout(() => io.emit("celebration:end"), event.duration * 1000);
});

function ingestSlackSale(
  sale: Sale,
  opts: { celebrate: boolean; notifySocket: boolean },
): boolean {
  const saved = insertSaleIfNew(sale);
  if (!saved) return false;
  if (opts.notifySocket) {
    io.emit("sale:new", saved);
    broadcastDashboard();
    if (opts.celebrate) {
      const celebration = shouldCelebrate(saved);
      if (celebration) triggerCelebration(celebration);
    }
  }
  return true;
}

setSaleCallback((sale) => {
  ingestSlackSale(sale, { celebrate: true, notifySocket: true });
});

setHistorySaleHandler((sale) =>
  ingestSlackSale(sale, { celebrate: false, notifySocket: false }),
);

setBackfillCompleteHandler(() => {
  broadcastDashboard();
});

async function start(): Promise<void> {
  server.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port}`);
  });

  await initPlugs();

  try {
    await initSlack();
  } catch (err) {
    console.error("[Slack] Failed to connect:", err);
    console.warn("[Slack] Server will continue without Slack integration.");
  }

  console.log("[Server] All systems initialized");
}

start().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
