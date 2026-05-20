-- Migration: Add recurrence_settings to tasks table
-- Created at: 2026-05-05 13:00:00
-- Purpose: Support per-task strict/flexible recurrence settings

-- Up Migration
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_settings JSONB;

-- Copy existing recurrence data to the new column to maintain continuity
UPDATE public.tasks 
SET recurrence_settings = recurrence 
WHERE recurrence IS NOT NULL;

-- Down Migration (Commented out for safety)
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS recurrence_settings;
