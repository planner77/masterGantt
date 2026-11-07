-- Issue #885: historical descriptions remain plain; never rewrite stored text.
ALTER TABLE tasks ADD COLUMN description_format TEXT NOT NULL DEFAULT 'plain' CHECK (description_format IN ('plain', 'markdown'));
ALTER TABLE project_issues ADD COLUMN description_format TEXT NOT NULL DEFAULT 'plain' CHECK (description_format IN ('plain', 'markdown'));
