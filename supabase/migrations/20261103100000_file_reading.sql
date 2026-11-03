-- Fields the document reader extracted from a company file, as the owner
-- confirmed them: { type, label, fields: [{ key, label, value, state }] }.
alter table public.company_files add column extracted jsonb, add column read_at timestamptz;
