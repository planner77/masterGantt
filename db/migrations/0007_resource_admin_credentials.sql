CREATE TABLE resource_catalog_admin_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_kdf TEXT NOT NULL CHECK (password_kdf = 'scrypt'),
  password_salt BLOB NOT NULL CHECK (length(password_salt) >= 16),
  password_hash BLOB NOT NULL CHECK (length(password_hash) = 32),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;
