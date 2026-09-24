-- Lunar festival dates (Eid, Diwali, Ugadi, …) need an annual ops update.
CREATE TABLE IF NOT EXISTS public.festival_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_name TEXT NOT NULL,
    festival_date DATE NOT NULL,
    country TEXT NOT NULL DEFAULT 'IN',
    region TEXT,
    playbook_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.festival_calendar TO service_role;

INSERT INTO public.festival_calendar (festival_name, festival_date, country, region, playbook_type) VALUES
    ('Diwali',           '2026-10-19', 'IN', NULL, 'pre_festival'),
    ('Diwali',           '2026-10-20', 'IN', NULL, 'festival_day'),
    ('Diwali',           '2026-10-21', 'IN', NULL, 'festival_day'),
    ('Christmas',        '2026-12-25', 'IN', NULL, 'festival_day'),
    ('Christmas Eve',    '2026-12-24', 'IN', NULL, 'pre_festival'),
    ('New Year',         '2027-01-01', 'IN', NULL, 'festival_day'),
    ('New Year Eve',     '2026-12-31', 'IN', NULL, 'pre_festival'),
    ('Valentine Day',    '2027-02-14', 'IN', NULL, 'festival_day'),
    ('Eid al-Fitr',      '2027-03-30', 'IN', NULL, 'festival_day'),
    ('Onam',             '2026-09-05', 'IN', 'KL', 'festival_day'),
    ('Ugadi',            '2027-03-30', 'IN', 'KA', 'festival_day'),
    ('Gudi Padwa',       '2027-03-30', 'IN', 'MH', 'festival_day');
