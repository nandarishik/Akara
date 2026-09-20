"""Tally XML voucher fetch — localhost:9000 only."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from agent.tallybridge_sync import fetch_via_tallybridge


_REQUEST_XML = """\
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>AkaraVouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
  </DESC>
 </BODY>
</ENVELOPE>
"""


def fetch_vouchers(host: str = "127.0.0.1", port: int = 9000) -> list[dict[str, Any]]:
    """
    Fetch vouchers from Tally Prime XML API.
    Outbound to 127.0.0.1:9000 only — no inbound listen ports on the agent.
    """
    if host not in ("127.0.0.1", "localhost"):
        raise ValueError("Tally host must be 127.0.0.1")

    try:
        return fetch_via_tallybridge(host, port)
    except RuntimeError:
        pass

    url = f"http://{host}:{port}"
    req = Request(url, data=_REQUEST_XML.encode("utf-8"), method="POST")
    req.add_header("Content-Type", "application/xml")
    try:
        with urlopen(req, timeout=30) as resp:  # noqa: S310 — localhost only
            raw = resp.read()
    except URLError as exc:
        raise ConnectionError(f"Tally XML unreachable at {host}:{port}") from exc

    return _parse_vouchers(raw)


def _parse_vouchers(raw: bytes) -> list[dict[str, Any]]:
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []
    out: list[dict[str, Any]] = []
    for node in root.iter():
        tag = node.tag.upper() if isinstance(node.tag, str) else ""
        if "VOUCHER" not in tag:
            continue
        amount_text = (node.findtext(".//AMOUNT") or node.findtext("AMOUNT") or "0").strip()
        try:
            amount = float(amount_text.replace(",", ""))
        except ValueError:
            amount = 0.0
        out.append(
            {
                "voucher_type": (node.findtext(".//VOUCHERTYPENAME") or "sales").strip().lower(),
                "date": (node.findtext(".//DATE") or "").strip(),
                "amount": amount,
                "party_name": (node.findtext(".//PARTYLEDGERNAME") or "").strip(),
                "narration": (node.findtext(".//NARRATION") or "").strip(),
                "gst_number": (node.findtext(".//PARTYGSTIN") or "").strip(),
                "external_id": (node.findtext(".//MASTERID") or node.findtext(".//GUID") or "").strip(),
            }
        )
    return out
