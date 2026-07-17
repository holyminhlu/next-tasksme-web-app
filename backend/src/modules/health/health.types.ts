export type HealthStatus = {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  database: {
    connected: boolean;
    message: string;
  };
};
