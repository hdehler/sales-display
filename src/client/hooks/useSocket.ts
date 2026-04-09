import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { DashboardData, CelebrationEvent } from "../../shared/types";

const SOCKET_URL = import.meta.env.DEV ? "http://localhost:3000" : "";

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("dashboard:update", (data: DashboardData) => {
      setDashboard(data);
    });

    s.on("celebration:start", (event: CelebrationEvent) => {
      setCelebration(event);
    });

    s.on("celebration:end", () => {
      setCelebration(null);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  return { socket, dashboard, celebration, connected };
}
