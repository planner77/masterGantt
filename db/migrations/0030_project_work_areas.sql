-- Issue #762: project-owned areas coexist with immutable legacy catalog identities.
CREATE TABLE project_work_areas (
 id INTEGER PRIMARY KEY,
 public_id TEXT NOT NULL UNIQUE,
 project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 process_id INTEGER NOT NULL,
 code TEXT NOT NULL CHECK(length(code) BETWEEN 1 AND 64),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
 sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 1000000),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(project_id,process_id,code),
 UNIQUE(project_id,process_id,id),
 FOREIGN KEY(project_id,process_id) REFERENCES project_processes(project_id,id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX project_work_areas_owner_idx ON project_work_areas(project_id,process_id,sort_order);
CREATE TRIGGER project_work_areas_owner_guard BEFORE UPDATE OF project_id,process_id ON project_work_areas
WHEN NEW.project_id<>OLD.project_id OR NEW.process_id<>OLD.process_id
BEGIN SELECT RAISE(ABORT,'WORK_AREA_OWNER_IMMUTABLE'); END;
CREATE TABLE equipment_project_work_areas (
 project_id INTEGER NOT NULL,
 equipment_id INTEGER NOT NULL,
 process_id INTEGER NOT NULL,
 work_area_id INTEGER NOT NULL,
 PRIMARY KEY(project_id,equipment_id,work_area_id),
 FOREIGN KEY(project_id,equipment_id) REFERENCES project_equipment(project_id,id) ON DELETE CASCADE,
 FOREIGN KEY(project_id,process_id,work_area_id) REFERENCES project_work_areas(project_id,process_id,id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX equipment_project_work_areas_area_idx ON equipment_project_work_areas(project_id,work_area_id);
CREATE TABLE task_project_work_area_links (
 project_id INTEGER NOT NULL,
 task_id INTEGER NOT NULL,
 process_id INTEGER NOT NULL,
 work_area_id INTEGER NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN('self','subtree')),
 PRIMARY KEY(project_id,task_id,work_area_id),
 FOREIGN KEY(project_id,task_id,process_id) REFERENCES task_process_links(project_id,task_id,process_id) ON DELETE CASCADE,
 FOREIGN KEY(project_id,process_id,work_area_id) REFERENCES project_work_areas(project_id,process_id,id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX task_project_work_area_links_area_idx ON task_project_work_area_links(project_id,work_area_id);
CREATE TRIGGER task_project_work_area_scope_insert BEFORE INSERT ON task_project_work_area_links
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM task_process_links WHERE project_id=NEW.project_id AND task_id=NEW.task_id AND process_id=NEW.process_id AND scope='subtree')
BEGIN SELECT RAISE(ABORT,'WORK_AREA_PROCESS_SCOPE_MISMATCH'); END;
CREATE TRIGGER task_project_work_area_scope_update BEFORE UPDATE ON task_project_work_area_links
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM task_process_links WHERE project_id=NEW.project_id AND task_id=NEW.task_id AND process_id=NEW.process_id AND scope='subtree')
BEGIN SELECT RAISE(ABORT,'WORK_AREA_PROCESS_SCOPE_MISMATCH'); END;
CREATE TRIGGER task_process_links_project_area_scope_guard BEFORE UPDATE OF scope ON task_process_links
WHEN NEW.scope='self' AND EXISTS(SELECT 1 FROM task_project_work_area_links WHERE project_id=OLD.project_id AND task_id=OLD.task_id AND process_id=OLD.process_id AND scope='subtree')
BEGIN SELECT RAISE(ABORT,'WORK_AREA_PROCESS_SCOPE_MISMATCH'); END;
CREATE TRIGGER projects_project_work_area_delete BEFORE DELETE ON projects
BEGIN
 DELETE FROM equipment_project_work_areas WHERE project_id=OLD.id;
 DELETE FROM task_project_work_area_links WHERE project_id=OLD.id;
 DELETE FROM project_work_areas WHERE project_id=OLD.id;
END;
