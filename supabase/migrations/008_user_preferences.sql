-- ============================================================
-- AKARA: User Preferences on Profiles
-- Migration 008 — run AFTER 007
--
-- Adds preferences JSONB column to profiles for notification
-- opt-in/opt-out (morning_brief_enabled).
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"morning_brief_enabled": true}';

UPDATE public.profiles
SET preferences = '{"morning_brief_enabled": true}'
WHERE role = 'admin' AND preferences IS NULL;
