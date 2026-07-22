from pydantic import BaseModel


class ImportResult(BaseModel):
    rows_inserted: int
    rows_skipped: int
    errors: list[str]
    warnings: list[str]
