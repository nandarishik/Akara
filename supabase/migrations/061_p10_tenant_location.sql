-- Phase 10: tenant_profiles + city_coordinates seed (10 cities)

CREATE TABLE IF NOT EXISTS public.tenant_profiles (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    city_slug TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    alert_prefs JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.tenant_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_profiles_isolation ON public.tenant_profiles;
CREATE POLICY tenant_profiles_isolation ON public.tenant_profiles
    USING (tenant_id = public.get_my_tenant_id());
GRANT ALL ON public.tenant_profiles TO service_role;

CREATE TABLE IF NOT EXISTS public.city_coordinates (
    city_slug TEXT PRIMARY KEY,
    city_name TEXT NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL
);
GRANT ALL ON public.city_coordinates TO service_role;

INSERT INTO public.city_coordinates (city_slug, city_name, latitude, longitude) VALUES
    ('mumbai', 'Mumbai', 19.076000, 72.877700),
    ('delhi', 'Delhi', 28.613900, 77.209000),
    ('bengaluru', 'Bengaluru', 12.971600, 77.594600),
    ('hyderabad', 'Hyderabad', 17.385000, 78.486700),
    ('chennai', 'Chennai', 13.082700, 80.270700),
    ('kolkata', 'Kolkata', 22.572600, 88.363900),
    ('pune', 'Pune', 18.520400, 73.856700),
    ('ahmedabad', 'Ahmedabad', 23.022500, 72.571400),
    ('jaipur', 'Jaipur', 26.912400, 75.787300),
    ('kochi', 'Kochi', 9.931200, 76.267300)
ON CONFLICT (city_slug) DO NOTHING;
