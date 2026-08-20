# ADR 002: Copilot plan → execute → synthesize

## Status

Accepted

## Context

Users ask natural-language analytics questions over tenant sales data. Direct free-form SQL from the LLM is unsafe and hard to debug.

## Decision

Use a three-stage pipeline: **Planner** emits structured SQL steps, **SQLTool** validates and executes, **Synthesizer** narrates results. Guardrails and PII redaction wrap the flow.

## Consequences

- Safer than unconstrained SQL generation
- Clear observability per stage
- Schema context quality heavily affects answer quality
