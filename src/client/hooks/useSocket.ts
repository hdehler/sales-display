import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { DashboardData, CelebrationEvent } from "../../shared/types";

function socketIoUrl(): string {
  if (import.meta.env.DEV) return "http://localhost:3000";
  if (typeof window !== "undefined" && window.location?.origin)
    return window.location.origin;
  return "";
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/dashboard");
        if (!r.ok) return;
        const data = (await r.json()) as DashboardData;
        if (!cancelled) setDashboard(data);
      } catch {
        /* server down or dev without proxy */
      }
    })();

    const s = io(socketIoUrl(), {
      transports: ["websocket", "polling"],
    });
    setSocket(s);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => setConnected(false));

    s.on("dashboard:update", (data: DashboardData) => {
      setDashboard(data);
    });

    s.on("celebration:start", (event: CelebrationEvent) => {
      setCelebration(event);
    });

    s.on("celebration:walkup", (event: CelebrationEvent) => {
      setCelebration(event);
    });

    s.on("celebration:end", () => {
      setCelebration(null);
    });

    return () => {
      cancelled = true;
      s.disconnect();
    };
  }, []);

  function dismissCelebration() {
    setCelebration(null);
  }

  return {
    socket,
    dashboard,
    celebration,
    connected,
    dismissCelebration,
  };
}
