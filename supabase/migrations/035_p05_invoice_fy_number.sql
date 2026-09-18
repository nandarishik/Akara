-- Phase 5 FY invoice numbers AKR-FYYYNN-NNNNN
CREATE TABLE IF NOT EXISTS invoice_fy_sequence (
    fy TEXT PRIMARY KEY,
    last_n INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_invoice_number() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
    fy TEXT;
    n INTEGER;
    yy1 TEXT;
    yy2 TEXT;
BEGIN
    IF EXTRACT(MONTH FROM now()) >= 4 THEN
        yy1 := to_char(now(), 'YY');
        yy2 := to_char(now() + interval '1 year', 'YY');
    ELSE
        yy1 := to_char(now() - interval '1 year', 'YY');
        yy2 := to_char(now(), 'YY');
    END IF;
    fy := yy1 || yy2;
    INSERT INTO invoice_fy_sequence (fy, last_n) VALUES (fy, 1)
    ON CONFLICT (fy) DO UPDATE SET last_n = invoice_fy_sequence.last_n + 1
    RETURNING last_n INTO n;
    RETURN 'AKR-FY' || fy || '-' || lpad(n::text, 5, '0');
END;
$$;
