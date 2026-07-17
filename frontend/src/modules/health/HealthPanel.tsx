"use client";

import { useEffect, useState } from "react";
import {
  API_URL,
  getLiveStatus,
  getReadyStatus,
  getSwaggerUrl,
  type HealthLiveResponse,
  type HealthReadyResponse,
} from "./health.service";
import styles from "./health-panel.module.css";

export function HealthPanel() {
  const [live, setLive] = useState<HealthLiveResponse | null>(null);
  const [ready, setReady] = useState<HealthReadyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([getLiveStatus(controller.signal), getReadyStatus(controller.signal)])
      .then(([liveStatus, readyStatus]) => {
        setLive(liveStatus);
        setReady(readyStatus);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setLive(null);
        setReady(null);
        setError(
          err instanceof Error ? err.message : "Không thể kết nối tới backend API",
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [refreshKey]);

  const overallStatus = error
    ? "offline"
    : ready?.status === "ok"
      ? "ok"
      : ready
        ? "degraded"
        : "unknown";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>TaskMng SME · Phase 0</p>
        <h1>Development Status</h1>
        <p className={styles.lead}>
          Trang trạng thái kỹ thuật cho foundation. Không có UI nghiệp vụ end-user ở Phase
          0. API versioned tại <code>/api/v1</code>.
        </p>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Health checks</h2>
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

          {!loading && live && ready && (
            <div className={styles.statusGrid}>
              <div>
                <span className={styles.label}>Overall</span>
                <strong className={`${styles.badge} ${styles[overallStatus]}`}>
                  {overallStatus}
                </strong>
              </div>
              <div>
                <span className={styles.label}>Liveness</span>
                <strong className={`${styles.badge} ${styles.ok}`}>{live.status}</strong>
              </div>
              <div>
                <span className={styles.label}>Readiness</span>
                <strong
                  className={`${styles.badge} ${
                    ready.status === "ok" ? styles.ok : styles.degraded
                  }`}
                >
                  {ready.status}
                </strong>
              </div>
              <div>
                <span className={styles.label}>Database</span>
                <strong
                  className={`${styles.badge} ${
                    ready.checks.database.status === "up" ? styles.ok : styles.degraded
                  }`}
                >
                  {ready.checks.database.status} · {ready.checks.database.latencyMs}ms
                </strong>
              </div>
              <div className={styles.full}>
                <span className={styles.label}>API base</span>
                <p>{API_URL}/api/v1</p>
              </div>
            </div>
          )}
        </section>

        <section className={styles.stack}>
          <h2>Developer tools</h2>
          <ul>
            <li>
              Swagger UI:{" "}
              <a href={getSwaggerUrl()} target="_blank" rel="noreferrer">
                {getSwaggerUrl()}
              </a>
            </li>
            <li>OpenAPI JSON: {API_URL}/api/openapi.json</li>
            <li>Architecture: feature modules + services</li>
            <li>Auth: Bearer access token + HttpOnly refresh cookie</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
