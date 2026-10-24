-- Issue #479: existing projects retain public access; explicit private opt-in.
ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private'));
