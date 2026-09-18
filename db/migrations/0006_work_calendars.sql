CREATE TABLE work_calendar_rules (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('COUNTRY', 'CUSTOM')),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  country_code TEXT CHECK (country_code IS NULL OR country_code IN ('KR','CN','VN','PH','TH','MX','US')),
  target_type TEXT NOT NULL CHECK (target_type IN ('PROJECT','RESOURCE_GROUP','RESOURCE')),
  target_public_id TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('FULL_PROJECT','DATE_RANGE')),
  effective_from TEXT,
  effective_to TEXT,
  source_version TEXT,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CHECK (
    (kind = 'COUNTRY' AND country_code IS NOT NULL AND target_type = 'PROJECT' AND target_public_id IS NULL)
    OR
    (kind = 'CUSTOM' AND country_code IS NULL)
  ),
  CHECK (
    (target_type = 'PROJECT' AND target_public_id IS NULL)
    OR
    (target_type IN ('RESOURCE_GROUP','RESOURCE') AND target_public_id IS NOT NULL AND length(trim(target_public_id)) > 0)
  ),
  CHECK (
    (scope = 'FULL_PROJECT' AND effective_from IS NULL AND effective_to IS NULL)
    OR
    (scope = 'DATE_RANGE' AND effective_from IS NOT NULL AND effective_to IS NOT NULL AND effective_from <= effective_to)
  )
) STRICT;

CREATE TABLE work_calendar_dates (
  id INTEGER PRIMARY KEY,
  calendar_rule_id INTEGER NOT NULL,
  date TEXT NOT NULL CHECK (length(date) = 10),
  day_type TEXT NOT NULL CHECK (day_type IN ('NON_WORKING','WORKING')),
  name TEXT,
  source_key TEXT,
  source_version TEXT,
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  FOREIGN KEY (calendar_rule_id) REFERENCES work_calendar_rules(id) ON DELETE CASCADE,
  UNIQUE (calendar_rule_id, date)
) STRICT;

CREATE INDEX work_calendar_rules_project_idx
  ON work_calendar_rules(project_id, target_type, target_public_id);
CREATE INDEX work_calendar_dates_rule_date_idx
  ON work_calendar_dates(calendar_rule_id, date);

-- Existing project_holidays are preserved as one custom project rule per project.
INSERT INTO work_calendar_rules (
  public_id, project_id, kind, name, country_code, target_type,
  target_public_id, scope, effective_from, effective_to, source_version,
  created_at, updated_at
)
SELECT
  'legacy-project-' || project_id,
  project_id,
  'CUSTOM',
  '기존 프로젝트 휴일',
  NULL,
  'PROJECT',
  NULL,
  'FULL_PROJECT',
  NULL,
  NULL,
  'legacy-project-holidays-v1',
  MIN(created_at),
  MIN(created_at)
FROM project_holidays
GROUP BY project_id;

INSERT INTO work_calendar_dates (
  calendar_rule_id, date, day_type, name, source_key, source_version, created_at
)
SELECT
  r.id,
  h.holiday_date,
  'NON_WORKING',
  h.name,
  'legacy-project-holiday',
  'legacy-project-holidays-v1',
  h.created_at
FROM project_holidays h
JOIN work_calendar_rules r
  ON r.public_id = 'legacy-project-' || h.project_id;

DROP TABLE project_holidays;

-- Compatibility projection for legacy scheduling/service code and focused tests.
-- Overlapping NON_WORKING sources are collapsed to one date per project.
CREATE VIEW project_holidays AS
SELECT
  MIN(d.id) AS id,
  r.project_id AS project_id,
  d.date AS holiday_date,
  MIN(d.name) AS name,
  MIN(d.created_at) AS created_at
FROM work_calendar_rules r
JOIN work_calendar_dates d ON d.calendar_rule_id = r.id
WHERE r.target_type = 'PROJECT'
  AND d.day_type = 'NON_WORKING'
GROUP BY r.project_id, d.date;

CREATE TRIGGER project_holidays_insert
INSTEAD OF INSERT ON project_holidays
BEGIN
  INSERT OR IGNORE INTO work_calendar_rules (
    public_id, project_id, kind, name, country_code, target_type,
    target_public_id, scope, effective_from, effective_to, source_version,
    created_at, updated_at
  ) VALUES (
    'legacy-project-' || NEW.project_id,
    NEW.project_id,
    'CUSTOM',
    '기존 프로젝트 휴일',
    NULL,
    'PROJECT',
    NULL,
    'FULL_PROJECT',
    NULL,
    NULL,
    'legacy-project-holidays-v1',
    NEW.created_at,
    NEW.created_at
  );

  INSERT OR IGNORE INTO work_calendar_dates (
    calendar_rule_id, date, day_type, name, source_key, source_version, created_at
  )
  SELECT
    id,
    NEW.holiday_date,
    'NON_WORKING',
    NEW.name,
    'legacy-project-holiday',
    'legacy-project-holidays-v1',
    NEW.created_at
  FROM work_calendar_rules
  WHERE public_id = 'legacy-project-' || NEW.project_id;
END;
