CREATE TABLE country_calendar_catalog_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

INSERT INTO country_calendar_catalog_state (id, revision, updated_at)
VALUES (1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE country_calendar_datasets (
  id INTEGER PRIMARY KEY,
  country_code TEXT NOT NULL CHECK (country_code IN ('KR','CN','VN','PH','TH','MX','US')),
  calendar_year INTEGER NOT NULL CHECK (calendar_year BETWEEN 2026 AND 2037),
  status TEXT NOT NULL CHECK (status IN ('OFFICIAL','UNAVAILABLE','SUPERSEDED')),
  source_version TEXT,
  source_url TEXT,
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  UNIQUE (country_code, calendar_year),
  CHECK (source_version IS NULL OR length(trim(source_version)) BETWEEN 1 AND 200),
  CHECK (source_url IS NULL OR length(trim(source_url)) BETWEEN 1 AND 2048)
) STRICT;

CREATE TABLE country_calendar_dates (
  id INTEGER PRIMARY KEY,
  dataset_id INTEGER NOT NULL REFERENCES country_calendar_datasets(id) ON DELETE CASCADE,
  holiday_date TEXT NOT NULL CHECK (length(holiday_date) = 10),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  day_type TEXT NOT NULL CHECK (day_type IN ('NON_WORKING','WORKING')),
  source_key TEXT NOT NULL CHECK (length(trim(source_key)) BETWEEN 1 AND 120),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0),
  UNIQUE (dataset_id, holiday_date)
) STRICT;

CREATE INDEX country_calendar_datasets_country_year_idx
  ON country_calendar_datasets(country_code, calendar_year);
CREATE INDEX country_calendar_dates_dataset_date_idx
  ON country_calendar_dates(dataset_id, holiday_date);
