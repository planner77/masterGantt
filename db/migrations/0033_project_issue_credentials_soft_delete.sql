-- #846: additive Issue credentials and tombstones; legacy rows remain UNSET.
-- Project deletion continues to cascade. Deleting an Issue never deletes a row.
ALTER TABLE project_issues ADD COLUMN credential_state TEXT NOT NULL DEFAULT 'UNSET'
  CHECK (credential_state IN ('UNSET','ACTIVE'));
ALTER TABLE project_issues ADD COLUMN password_kdf TEXT CHECK (password_kdf IS NULL OR password_kdf = 'scrypt');
ALTER TABLE project_issues ADD COLUMN password_salt BLOB CHECK (password_salt IS NULL OR length(password_salt) = 16);
ALTER TABLE project_issues ADD COLUMN password_hash BLOB CHECK (password_hash IS NULL OR length(password_hash) = 32);
ALTER TABLE project_issues ADD COLUMN scrypt_n INTEGER;
ALTER TABLE project_issues ADD COLUMN scrypt_r INTEGER;
ALTER TABLE project_issues ADD COLUMN scrypt_p INTEGER;
ALTER TABLE project_issues ADD COLUMN scrypt_key_length INTEGER;
ALTER TABLE project_issues ADD COLUMN credential_version INTEGER NOT NULL DEFAULT 0 CHECK (credential_version >= 0);
ALTER TABLE project_issues ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (lifecycle_state IN ('ACTIVE','DELETED'));
ALTER TABLE project_issues ADD COLUMN deleted_at TEXT;
CREATE INDEX project_issues_visible_idx
  ON project_issues(project_id, lifecycle_state, created_at DESC, id DESC);
CREATE INDEX project_issues_visible_status_idx
  ON project_issues(project_id, lifecycle_state, completed, id DESC);
CREATE TABLE project_issue_credential_audit (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_id INTEGER NOT NULL REFERENCES project_issues(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('INITIALIZE', 'RESET')),
  edit_session_id INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX project_issue_credential_audit_issue_idx
  ON project_issue_credential_audit(issue_id, created_at DESC);

-- Do not allow inconsistent lifecycle/credential pairs, including via direct SQL.
CREATE TRIGGER project_issues_846_insert_guard BEFORE INSERT ON project_issues
WHEN (NEW.lifecycle_state = 'DELETED') != (NEW.deleted_at IS NOT NULL)
  OR (NEW.credential_state = 'ACTIVE') !=
    (NEW.password_kdf = 'scrypt' AND NEW.password_salt IS NOT NULL AND
     NEW.password_hash IS NOT NULL AND NEW.scrypt_n = 32768 AND
     NEW.scrypt_r = 8 AND NEW.scrypt_p = 3 AND NEW.scrypt_key_length = 32 AND
     NEW.credential_version >= 1)
  OR (NEW.credential_state = 'UNSET' AND
     (NEW.password_kdf IS NOT NULL OR NEW.password_salt IS NOT NULL OR
      NEW.password_hash IS NOT NULL OR NEW.scrypt_n IS NOT NULL OR
      NEW.scrypt_r IS NOT NULL OR NEW.scrypt_p IS NOT NULL OR
      NEW.scrypt_key_length IS NOT NULL OR NEW.credential_version != 0))
BEGIN SELECT RAISE(ABORT, 'invalid project issue credential/lifecycle'); END;
CREATE TRIGGER project_issues_846_update_guard BEFORE UPDATE ON project_issues
WHEN (NEW.lifecycle_state = 'DELETED') != (NEW.deleted_at IS NOT NULL)
  OR (NEW.credential_state = 'ACTIVE') !=
    (NEW.password_kdf = 'scrypt' AND NEW.password_salt IS NOT NULL AND
     NEW.password_hash IS NOT NULL AND NEW.scrypt_n = 32768 AND
     NEW.scrypt_r = 8 AND NEW.scrypt_p = 3 AND NEW.scrypt_key_length = 32 AND
     NEW.credential_version >= 1)
  OR (NEW.credential_state = 'UNSET' AND
     (NEW.password_kdf IS NOT NULL OR NEW.password_salt IS NOT NULL OR
      NEW.password_hash IS NOT NULL OR NEW.scrypt_n IS NOT NULL OR
      NEW.scrypt_r IS NOT NULL OR NEW.scrypt_p IS NOT NULL OR
      NEW.scrypt_key_length IS NOT NULL OR NEW.credential_version != 0))
BEGIN SELECT RAISE(ABORT, 'invalid project issue credential/lifecycle'); END;
