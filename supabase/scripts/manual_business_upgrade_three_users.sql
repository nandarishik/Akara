-- Manual business plan upgrade for three production users
-- Run in Supabase Dashboard → SQL Editor (project: tkkewnogqdjjkkikseaa)
--
-- Users:
--   fadenthreads@gmail.com      → tenant Bandi traders
--   meghanajhadi28@gmail.com    → tenant Faden
--   nandarishik.bandi13@gmail.com → tenant AKARA Demo

BEGIN;

UPDATE public.tenants
SET
    plan               = 'business',
    plan_status        = 'active',
    plan_overrides_at  = NOW(),
    updated_at         = NOW()
WHERE id IN (
    '20680f1e-e5b4-44c7-9238-dff311d6999b',  -- fadenthreads / Bandi traders
    '1287ace7-1a7f-4745-bdde-78e9a33f86b4',  -- meghana jhadi / Faden
    '8a6141c2-8013-4b7e-a79c-353d1348e028'   -- nandarishik / AKARA Demo
);

-- Verify
SELECT
    u.email,
    p.display_name,
    t.id   AS tenant_id,
    t.name AS tenant_name,
    t.plan,
    t.plan_status,
    t.plan_overrides_at
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.tenants t ON t.id = p.tenant_id
WHERE u.id IN (
    '18f5aa12-3b15-4d1e-ac17-84d721059c00',
    'ccb9d089-764c-4943-8fd1-db148088fab1',
    '4c0e3cb6-9fc4-4f06-be31-c5f4330f67a8'
)
ORDER BY u.email;

COMMIT;
