import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Sentry — only active in production; no-op in development.
// Set VITE_SENTRY_DSN in Vercel environment variables.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  // Only send events in production builds
  enabled: import.meta.env.PROD && Boolean(import.meta.env.VITE_SENTRY_DSN),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
