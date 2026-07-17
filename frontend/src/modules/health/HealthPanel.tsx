"use client";

import { useEffect, useState } from "react";
import { API_URL, getHealthStatus } from "./health.service";
import type { HealthResponse } from "./health.types";
import styles from "./health-panel.module.css";

export function HealthPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getHealthStatus(controller.signal)
      .then((data) => {
        setHealth(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setHealth(null);
        setError(
          err instanceof Error
            ? err.message
            : "Không thể kết nối tới backend API",
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [refreshKey]);

  const overallStatus = error
    ? "offline"
    : health?.status === "ok"
      ? "ok"
      : health
        ? "degraded"
        : "unknown";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>TaskMng SME</p>
        <h1>Next.js + Express + PostgreSQL</h1>
        <p className={styles.lead}>
          Full-stack được tổ chức theo feature module và service. Frontend gọi
          backend để kiểm tra database <code>taskmng</code>.
        </p>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Trạng thái hệ thống</h2>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setRefreshKey((value) => value + 1);
              }}
            >
              Kiểm tra lại
            </button>
          </div>

          {loading && <p className={styles.muted}>Đang kiểm tra API...</p>}

          {!loading && error && (
            <div className={`${styles.badge} ${styles.offline}`}>
              Backend offline: {error}
            </div>
          )}

          {!loading && health && (
            <div className={styles.statusGrid}>
              <div>
                <span className={styles.label}>Overall</span>
                <strong className={`${styles.badge} ${styles[overallStatus]}`}>
                  {overallStatus}
                </strong>
              </div>
              <div>
                <span className={styles.label}>Service</span>
                <strong>{health.service}</strong>
              </div>
              <div>
                <span className={styles.label}>API URL</span>
                <strong>{API_URL}/api/health</strong>
              </div>
              <div>
                <span className={styles.label}>Database</span>
                <strong
                  className={`${styles.badge} ${
                    health.database.connected ? styles.ok : styles.degraded
                  }`}
                >
                  {health.database.connected ? "connected" : "disconnected"}
                </strong>
              </div>
              <div className={styles.full}>
                <span className={styles.label}>Message</span>
                <p>{health.database.message}</p>
              </div>
              <div className={styles.full}>
                <span className={styles.label}>Timestamp</span>
                <p>{health.timestamp}</p>
              </div>
            </div>
          )}
        </section>

        <section className={styles.stack}>
          <h2>Module-services architecture</h2>
          <ul>
            <li>Frontend module: component, service và type</li>
            <li>Backend module: route, controller, service và type</li>
            <li>Infrastructure dùng chung: Prisma, env và middleware</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
