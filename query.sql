-- List all public tables
select table_name from information_schema.tables where table_schema='public' order by table_name;

-- ── Run this once in your Supabase SQL editor to add sender names ──────────
alter table messages add column if not exists sender_name text;
