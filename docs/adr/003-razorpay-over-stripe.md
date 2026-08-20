# ADR 003: Razorpay over Stripe

## Status

Accepted

## Context

AKARA targets Indian SMB customers with GST invoicing and local payment rails.

## Decision

Use Razorpay for subscriptions and webhooks; generate GST invoices in-app.

## Consequences

- Better India-local payment UX
- Custom GST / ledger logic required
- Stripe paths remain legacy/optional where present
