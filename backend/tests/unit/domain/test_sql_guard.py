import pytest

from app.sql.guard import SQLGuardError, validate_sql


def test_select_allowed() -> None:
    validate_sql("SELECT * FROM public.sales_data")  # no exception


def test_delete_blocked() -> None:
    with pytest.raises(SQLGuardError, match="permitted"):
        validate_sql("DELETE FROM public.sales_data WHERE id = 1")


def test_drop_blocked() -> None:
    with pytest.raises(SQLGuardError):
        validate_sql("DROP TABLE sales_data")


def test_insert_blocked() -> None:
    with pytest.raises(SQLGuardError):
        validate_sql("INSERT INTO sales_data VALUES (1, 2)")


def test_pg_catalog_blocked() -> None:
    with pytest.raises(SQLGuardError, match="forbidden"):
        validate_sql("SELECT * FROM pg_catalog.pg_tables")


def test_information_schema_blocked() -> None:
    with pytest.raises(SQLGuardError, match="forbidden"):
        validate_sql("SELECT * FROM information_schema.tables")


def test_update_blocked() -> None:
    with pytest.raises(SQLGuardError):
        validate_sql("UPDATE sales_data SET total_amount = 0")
