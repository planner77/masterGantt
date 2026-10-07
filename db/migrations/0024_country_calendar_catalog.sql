CREATE TABLE country_calendar_catalog_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  preview_secret BLOB NOT NULL CHECK (length(preview_secret) = 32),
  updated_at TEXT NOT NULL
) STRICT;
INSERT INTO country_calendar_catalog_state VALUES (1, 1, randomblob(32), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE country_calendar_datasets (
  id INTEGER PRIMARY KEY,
  country_code TEXT NOT NULL CHECK (country_code IN ('KR','CN','VN','PH','TH','MX','US')),
  year INTEGER NOT NULL CHECK (year BETWEEN 2026 AND 2037),
  status TEXT NOT NULL CHECK (status IN ('OFFICIAL','UNAVAILABLE','SUPERSEDED')),
  source_version TEXT,
  source_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(country_code, year),
  CHECK (status <> 'OFFICIAL' OR (length(source_version) BETWEEN 1 AND 200 AND length(source_url) BETWEEN 1 AND 2048 AND source_version IS NOT NULL AND source_url IS NOT NULL))
) STRICT;

CREATE TABLE country_calendar_dates (
  dataset_id INTEGER NOT NULL REFERENCES country_calendar_datasets(id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (length(date) = 10),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  day_type TEXT NOT NULL CHECK (day_type IN ('NON_WORKING','WORKING')),
  source_key TEXT NOT NULL CHECK (length(source_key) BETWEEN 1 AND 120),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (dataset_id, date)
) STRICT;
