# Akara Connect — Windows tray agent for Tally → Akara HMAC push

Local agent that reads Tally Prime XML on `127.0.0.1:9000` and pushes vouchers to
`POST /api/v1/connectors/tally/push` with HMAC headers.

## Security model

- **Outbound HTTPS only** to the configured `AKARA_API_BASE_URL` host (staging/prod Akara API).
- **Tally XML** only to `127.0.0.1:9000` — never bind listen ports; no inbound connections.
- **Low privilege:** install and run as a standard Windows user (not Administrator).
- **Firewall:** allow outbound HTTPS to your Akara API host; block inbound to the agent process.
- **Updates:** `agent/updater.py` downloads over HTTPS and verifies signature before apply (S5). CA / private signing key ops are deferred to ops backlog.

## Layout

- `agent/main.py` — pystray tray (green / yellow / red)
- `agent/tally_reader.py` — Tally XML fetch
- `agent/tallybridge_sync.py` — optional tallybridge adapter
- `agent/push_client.py` — HMAC push + offline queue
- `agent/sync_client.py` / `scheduler.py` / `config.py` / `updater.py`
- `installer/akara-connect.spec` — PyInstaller (create before documenting pyinstaller commands)
- `installer/akara-connect.iss` — Inno Setup wrapper sketch

## Env

| Variable | Purpose |
|---|---|
| `AKARA_API_BASE_URL` | Akara API origin |
| `AKARA_CONNECTOR_API_KEY` | One-time key from connector create (X-Connector-Key) |
| `CONNECTOR_TALLY_PUSH_SECRET` | Shared HMAC secret |
| `TALLY_HOST` / `TALLY_PORT` | Must stay `127.0.0.1` / `9000` |
| `AKARA_CONNECT_UPDATE_URL` | HTTPS update base |
| `AKARA_CONNECT_UPDATE_SIGNING_KEY` | Public key PEM for verify |

## Dev

```bash
cd akara-connect
pip install -r requirements.txt
python -m agent.main
```

## Tests

```bash
cd akara-connect
python -m pytest tests/ -q
```

## TallyBridge Gate 2

`vendor/tallybridge/` is created only when Gate 2 PASS is documented. Until then,
requirements pin `tallybridge==0.2.0`. Agent falls back to direct XML if the package
API is unavailable.

## Installer

1. Build with PyInstaller using `installer/akara-connect.spec`.
2. Wrap with Inno Setup (`installer/akara-connect.iss`) or NSIS.
3. Sign the update artifact; agent verifies before apply.
