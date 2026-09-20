from __future__ import annotations
class CredentialService:
    def encrypt(self, payload: dict) -> str:
        return "enc:" + ",".join(sorted(payload))
    def decrypt(self, blob: str) -> dict:
        return {}
