-- Day 10 finish: placement seeds, hero CMS normalize, legal metadata, contract fields

BEGIN;

ALTER TABLE public.document_versions
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.plan_assignments
    ADD COLUMN IF NOT EXISTS contract_metadata JSONB NOT NULL DEFAULT '{}';

-- Normalize hero CMS shape for LandingPage consumers
UPDATE public.content_entries
SET
    draft_value = '{"eyebrow":"AI Analytics for FMCG Distributors","headline":"Know your business","headlineAccent":"in 30 seconds."}'::jsonb,
    published_value = '{"eyebrow":"AI Analytics for FMCG Distributors","headline":"Know your business","headlineAccent":"in 30 seconds."}'::jsonb
WHERE key = 'landing.hero.title' AND locale = 'en-IN';

UPDATE public.content_entries
SET
    draft_value = '{"text":"Ask in Hindi or English. Get a weekly brief on WhatsApp. Free to start."}'::jsonb,
    published_value = '{"text":"Ask in Hindi or English. Get a weekly brief on WhatsApp. Free to start."}'::jsonb
WHERE key = 'landing.hero.subtitle' AND locale = 'en-IN';

INSERT INTO public.content_entries (key, locale, draft_value, published_value, published_at) VALUES
('landing.seo.description', 'en-IN',
 '{"text":"Import Tally data, ask AI questions, and get weekly debriefs. Built for Indian FMCG distributors and brands."}'::jsonb,
 '{"text":"Import Tally data, ask AI questions, and get weekly debriefs. Built for Indian FMCG distributors and brands."}'::jsonb,
 NOW())
ON CONFLICT (key, locale) DO UPDATE SET
    draft_value = EXCLUDED.draft_value,
    published_value = EXCLUDED.published_value;

-- Seed placement slots (semantic keys matching PLACEMENT_KEYS in frontend)
INSERT INTO public.placement_slots (key, kind, draft_content, published_content, is_active, published_at) VALUES
('landing.banner.a', 'promotion',
 '{"title":"Launch promo","body":"Launching WhatsApp weekly briefs — get your data every Monday.","cta_label":"Be the first →","cta_link":"/signup"}'::jsonb,
 '{"title":"Launch promo","body":"Launching WhatsApp weekly briefs — get your data every Monday.","cta_label":"Be the first →","cta_link":"/signup"}'::jsonb,
 true, NOW()),
('landing.banner.b', 'promotion',
 '{"title":"Sticky CTA","body":"Start free — no credit card required.","cta_label":"Sign up →","cta_link":"/signup"}'::jsonb,
 '{"title":"Sticky CTA","body":"Start free — no credit card required.","cta_label":"Sign up →","cta_link":"/signup"}'::jsonb,
 true, NOW()),
('landing.banner.c', 'promotion',
 '{"title":"Pricing nudge","body":"Pro plans include secondary sales and simulator.","cta_label":"See pricing →","cta_link":"/#pricing"}'::jsonb,
 '{"title":"Pricing nudge","body":"Pro plans include secondary sales and simulator.","cta_label":"See pricing →","cta_link":"/#pricing"}'::jsonb,
 true, NOW()),
('dashboard.welcome', 'promotion',
 '{"title":"Welcome to AKARA Mission Control","body":"Import your first file to unlock KPIs, zone charts, and weekly debriefs.","cta_label":"Import data →","cta_link":"/data"}'::jsonb,
 '{"title":"Welcome to AKARA Mission Control","body":"Import your first file to unlock KPIs, zone charts, and weekly debriefs.","cta_label":"Import data →","cta_link":"/data"}'::jsonb,
 true, NOW()),
('copilot.demo', 'demo',
 '{"title":"See Copilot in action","body":"Watch a 2-minute demo of revenue questions, route analysis, and debrief follow-ups.","cta_label":"View demo →","cta_link":"/reports","video_url":"","duration_sec":120}'::jsonb,
 '{"title":"See Copilot in action","body":"Watch a 2-minute demo of revenue questions, route analysis, and debrief follow-ups.","cta_label":"View demo →","cta_link":"/reports","video_url":"","duration_sec":120}'::jsonb,
 true, NOW()),
('data.pro_upsell', 'promotion',
 '{"title":"Unlock secondary sales & scheme analysis","body":"Pro plan adds DMS offtake imports and scheme leakage detection.","cta_label":"Upgrade to Pro →","cta_link":"/upgrade"}'::jsonb,
 '{"title":"Unlock secondary sales & scheme analysis","body":"Pro plan adds DMS offtake imports and scheme leakage detection.","cta_label":"Upgrade to Pro →","cta_link":"/upgrade"}'::jsonb,
 true, NOW()),
('billing.quota_nudge', 'promotion',
 '{"title":"You''re approaching your plan limits","body":"Upgrade to Pro for more Copilot questions, row storage, and secondary sales imports.","cta_label":"View plans →","cta_link":"/upgrade"}'::jsonb,
 '{"title":"You''re approaching your plan limits","body":"Upgrade to Pro for more Copilot questions, row storage, and secondary sales imports.","cta_label":"View plans →","cta_link":"/upgrade"}'::jsonb,
 true, NOW()),
('copilot.quota_blocked', 'promotion',
 '{"title":"Monthly Copilot quota reached","body":"Upgrade to Pro for 500 questions/month and unlock scheme leakage reports.","cta_label":"Upgrade plan →","cta_link":"/upgrade"}'::jsonb,
 '{"title":"Monthly Copilot quota reached","body":"Upgrade to Pro for 500 questions/month and unlock scheme leakage reports.","cta_label":"Upgrade plan →","cta_link":"/upgrade"}'::jsonb,
 true, NOW())
ON CONFLICT (key) DO UPDATE SET
    draft_content = EXCLUDED.draft_content,
    published_content = EXCLUDED.published_content,
    is_active = EXCLUDED.is_active,
    published_at = EXCLUDED.published_at;

COMMIT;
