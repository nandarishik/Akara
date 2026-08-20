# AKARA Connect — Windows tray agent (scaffold)

Local agent that syncs ERP/POS data (starting with Tally) to Akara cloud.

## Status

Scaffold only — not production-ready. Implement tally_reader, sync_client, and
scheduler against backend `app.domain.connect` endpoints when those land.

## Layout

- `agent/config.py` — INI / env config
- `agent/tally_reader.py` — Tally XML over port 9000
- `agent/sync_client.py` — HTTPS push to Akara
- `agent/scheduler.py` — poll loop
- `agent/main.py` — tray entry point

## Dev

```bash
cd akara-connect
pip install -r requirements.txt
python -m agent.main
```
