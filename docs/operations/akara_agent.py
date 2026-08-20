"""
AKARA Overnight Sync Agent
Runs nightly on the customer's Tally machine via Windows Task Scheduler.
Reads today's Tally invoices and pushes them to AKARA /data/sync.

Configure once:
  AKARA_API_URL   = https://api.akara.ai
  AKARA_API_KEY   = <tenant API key from AKARA settings>
  TALLY_URL       = http://localhost:9000  (default Tally HTTP port)

Installation (one-time, ~10 minutes):
  1. Install Python 3.11+  →  python.org/downloads (silent installer)
  2. pip install requests
  3. Save this file to  C:\\akara\\akara_agent.py
  4. Create C:\\akara\\run.bat:
         @echo off
         set AKARA_API_URL=https://api.akara.ai
         set AKARA_API_KEY=<key from AKARA dashboard>
         python C:\\akara\\akara_agent.py
  5. Task Scheduler → Create Basic Task
         Name:    AKARA Nightly Sync
         Trigger: Daily at 11:00 PM
         Action:  Start a program → C:\\akara\\run.bat
  6. Test: run C:\\akara\\run.bat manually, check C:\\akara_agent.log
"""

import json
import logging
import os
import sys
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────────────────────────
AKARA_API_URL = os.environ.get("AKARA_API_URL", "https://api.akara.ai")
AKARA_API_KEY = os.environ.get("AKARA_API_KEY", "")
TALLY_URL     = os.environ.get("TALLY_URL", "http://localhost:9000")
LOG_FILE      = Path(os.environ.get("AKARA_LOG", "C:/akara_agent.log"))
SYNC_DAYS     = int(os.environ.get("AKARA_SYNC_DAYS", "1"))  # 1 = yesterday only

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("akara_agent")


# ── Tally XML Request ──────────────────────────────────────────────────────────
TALLY_VOUCHER_XML = """
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Voucher Register</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE>{from_date}</SVFROMDATE>
          <SVTODATE>{to_date}</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
""".strip()


def fetch_tally_invoices(from_date: date, to_date: date) -> list[dict]:
    """Pull sales vouchers from local Tally HTTP API and return list of row dicts."""
    xml_body = TALLY_VOUCHER_XML.format(
        from_date=from_date.strftime("%Y%m%d"),
        to_date=to_date.strftime("%Y%m%d"),
    )
    try:
        resp = requests.post(TALLY_URL, data=xml_body, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Tally HTTP error: %s", exc)
        return []

    root = ET.fromstring(resp.text)
    rows: list[dict] = []

    for voucher in root.iter("VOUCHER"):
        v_type = (voucher.findtext("VOUCHERTYPENAME") or "").upper()
        if v_type != "SALES":
            continue

        invoice_date   = voucher.findtext("DATE") or ""
        invoice_number = voucher.findtext("VOUCHERNUMBER") or ""
        party_name     = voucher.findtext("PARTYNAME") or ""

        for item in voucher.iter("ALLINVENTORYENTRIES.LIST"):
            product_name = item.findtext("STOCKITEMNAME") or ""
            quantity     = _safe_float(item.findtext("ACTUALQTY"))
            amount       = _safe_float(item.findtext("AMOUNT"))

            if not product_name:
                continue

            rows.append({
                "invoice_date":    _fmt_date(invoice_date),
                "invoice_number":  invoice_number,
                "party_name":      party_name,
                "party_city":      "",
                "party_zone":      "",
                "route":           "",
                "product_name":    product_name,
                "product_group":   "",
                "quantity":        abs(quantity),
                "gross_amount":    abs(amount),
                "discount_amount": 0,
                "net_amount":      abs(amount),
                "tax_amount":      0,
                "total_amount":    abs(amount),
            })

    logger.info("Tally returned %d line items for %s–%s", len(rows), from_date, to_date)
    return rows


def _safe_float(text: str | None) -> float:
    try:
        return float((text or "0").replace(",", "").strip())
    except ValueError:
        return 0.0


def _fmt_date(tally_date: str) -> str:
    """Convert Tally YYYYMMDD → ISO YYYY-MM-DD."""
    if len(tally_date) == 8:
        return f"{tally_date[:4]}-{tally_date[4:6]}-{tally_date[6:]}"
    return tally_date


# ── Push to AKARA ──────────────────────────────────────────────────────────────

def push_to_akara(rows: list[dict], source_type: str = "primary") -> bool:
    if not rows:
        logger.info("No rows to push, skipping.")
        return True

    payload = {"source_type": source_type, "rows": rows}
    try:
        resp = requests.post(
            f"{AKARA_API_URL}/data/sync",
            json=payload,
            headers={"X-API-Key": AKARA_API_KEY},
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info(
            "AKARA sync OK: %d inserted, %d skipped",
            result.get("rows_inserted", 0),
            result.get("rows_skipped", 0),
        )
        return True
    except requests.RequestException as exc:
        logger.error("AKARA push failed: %s", exc)
        return False


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    if not AKARA_API_KEY:
        logger.error("AKARA_API_KEY not set. Aborting.")
        sys.exit(1)

    today     = date.today()
    from_date = today - timedelta(days=SYNC_DAYS)
    to_date   = today - timedelta(days=1)

    logger.info("Starting sync for %s–%s", from_date, to_date)
    rows = fetch_tally_invoices(from_date, to_date)
    ok   = push_to_akara(rows, source_type="primary")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
