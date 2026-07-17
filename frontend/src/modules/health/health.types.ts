export type HealthResponse = {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  database: {
    connected: boolean;
    message: string;
  };
};
