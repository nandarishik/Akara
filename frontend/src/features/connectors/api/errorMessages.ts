/** Frozen customer-facing error_code → message map. Replace [Source] with source_name. */

import type { ConnectorErrorCode } from "./types";

const MESSAGES: Record<ConnectorErrorCode, string> = {
  INVALID_CREDENTIALS:
    "We couldn't connect to [Source]. Please check your API key and try again.",
  RATE_LIMITED:
    "[Source] is temporarily limiting connections. We'll retry automatically in 1 hour.",
  SOURCE_UNREACHABLE:
    "[Source] is currently unavailable. We'll retry when it's back online.",
  NO_DATA: "No new orders to sync since your last sync.",
  SCHEMA_MISMATCH:
    "We received unexpected data from [Source]. Our team has been notified.",
  QUOTA_EXCEEDED:
    "You've reached your connector sync limit for this plan. Upgrade to sync more frequently.",
  CONNECTORS_DISABLED: "Connectors are not enabled.",
  GATED: "This connector is not available yet. Upload a CSV instead.",
};

export function customerErrorMessage(
  code: ConnectorErrorCode | string | null | undefined,
  sourceName = "your source",
): string {
  if (!code) return "Something went wrong. Please try again.";
  const template = MESSAGES[code as ConnectorErrorCode];
  if (!template) return "Something went wrong. Please try again.";
  return template.replaceAll("[Source]", sourceName);
}

export const ERROR_MESSAGE_TEMPLATES = MESSAGES;
