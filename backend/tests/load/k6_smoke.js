import http from "k6/http";
import { check } from "k6";

export const options = { vus: 1, duration: "10s" };

export default function () {
  const base = __ENV.STAGING_API_URL || "http://localhost:8000";
  const res = http.get(`${base}/health`);
  check(res, { "health 200": (r) => r.status === 200 });
}
