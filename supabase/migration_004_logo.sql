-- Migration 004: add a logo to the invoice letterhead.
--
-- The logo is stored as a data URL (base64-encoded image) directly in the
-- `parametres` row — no Supabase Storage bucket/policies to set up for a
-- single small image. Run this once in the Supabase SQL Editor.

alter table parametres add column if not exists logo_url text;
