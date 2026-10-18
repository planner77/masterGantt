-- Issue #725: additive typed contexts. Existing tasks remain legacy-null.
CREATE TABLE equipment_work_areas (
 project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 equipment_id INTEGER NOT NULL, process_id INTEGER NOT NULL,
 occurrence_id INTEGER NOT NULL, work_area_id INTEGER NOT NULL,
 PRIMARY KEY(project_id,equipment_id,work_area_id),
 FOREIGN KEY(project_id,equipment_id) REFERENCES project_equipment(project_id,id) ON DELETE CASCADE,
 FOREIGN KEY(project_id,process_id,occurrence_id) REFERENCES project_process_occurrence_mappings(project_id,project_process_id,occurrence_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY(occurrence_id,work_area_id) REFERENCES work_areas(occurrence_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;
CREATE INDEX equipment_work_areas_owner_idx ON equipment_work_areas(project_id,process_id,occurrence_id);
CREATE INDEX equipment_work_areas_area_idx ON equipment_work_areas(work_area_id);
CREATE TABLE task_process_contexts (
 project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 task_id INTEGER NOT NULL,
 PRIMARY KEY(project_id,task_id),
 FOREIGN KEY(project_id,task_id) REFERENCES tasks(project_id,id) ON DELETE CASCADE
) STRICT;
CREATE TABLE task_process_links (
 project_id INTEGER NOT NULL, task_id INTEGER NOT NULL, process_id INTEGER NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN('self','subtree')),
 PRIMARY KEY(project_id,task_id,process_id),
 FOREIGN KEY(project_id,task_id) REFERENCES task_process_contexts(project_id,task_id) ON DELETE CASCADE,
 FOREIGN KEY(project_id,process_id) REFERENCES project_processes(project_id,id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX task_process_links_process_idx ON task_process_links(project_id,process_id);
CREATE TABLE task_work_area_links (
 project_id INTEGER NOT NULL, task_id INTEGER NOT NULL, process_id INTEGER NOT NULL,
 occurrence_id INTEGER NOT NULL, work_area_id INTEGER NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN('self','subtree')),
 PRIMARY KEY(project_id,task_id,work_area_id),
 FOREIGN KEY(project_id,task_id,process_id) REFERENCES task_process_links(project_id,task_id,process_id) ON DELETE CASCADE,
 FOREIGN KEY(project_id,process_id,occurrence_id) REFERENCES project_process_occurrence_mappings(project_id,project_process_id,occurrence_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY(occurrence_id,work_area_id) REFERENCES work_areas(occurrence_id,id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;
CREATE INDEX task_work_area_links_area_idx ON task_work_area_links(work_area_id);
CREATE INDEX task_work_area_links_owner_idx ON task_work_area_links(project_id,process_id,occurrence_id);
CREATE TRIGGER task_process_links_scope_insert BEFORE INSERT ON task_process_links
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=NEW.project_id AND id=NEW.task_id AND type='summary')
BEGIN SELECT RAISE(ABORT,'PROCESS_CONTEXT_SUBTREE_REQUIRES_SUMMARY'); END;
CREATE TRIGGER task_work_area_links_scope_insert BEFORE INSERT ON task_work_area_links
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=NEW.project_id AND id=NEW.task_id AND type='summary')
BEGIN SELECT RAISE(ABORT,'PROCESS_CONTEXT_SUBTREE_REQUIRES_SUMMARY'); END;
CREATE TRIGGER tasks_process_context_type_guard BEFORE UPDATE OF type ON tasks
WHEN NEW.type<>'summary' AND (EXISTS(SELECT 1 FROM task_process_links WHERE project_id=OLD.project_id AND task_id=OLD.id AND scope='subtree') OR EXISTS(SELECT 1 FROM task_work_area_links WHERE project_id=OLD.project_id AND task_id=OLD.id AND scope='subtree'))
BEGIN SELECT RAISE(ABORT,'PROCESS_CONTEXT_SUBTREE_REQUIRES_SUMMARY'); END;
-- Remove the new edges first so project-wide cascades never depend on FK visitation order.
CREATE TRIGGER projects_process_context_delete BEFORE DELETE ON projects
BEGIN
 DELETE FROM equipment_work_areas WHERE project_id=OLD.id;
 DELETE FROM task_work_area_links WHERE project_id=OLD.id;
 DELETE FROM task_process_links WHERE project_id=OLD.id;
 DELETE FROM task_process_contexts WHERE project_id=OLD.id;
END;
CREATE TRIGGER task_process_links_scope_update BEFORE UPDATE ON task_process_links
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=NEW.project_id AND id=NEW.task_id AND type='summary')
BEGIN SELECT RAISE(ABORT,'PROCESS_CONTEXT_SUBTREE_REQUIRES_SUMMARY'); END;
CREATE TRIGGER task_work_area_links_scope_update BEFORE UPDATE ON task_work_area_links
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=NEW.project_id AND id=NEW.task_id AND type='summary')
BEGIN SELECT RAISE(ABORT,'PROCESS_CONTEXT_SUBTREE_REQUIRES_SUMMARY'); END;
CREATE TRIGGER task_work_area_links_process_scope_insert BEFORE INSERT ON task_work_area_links
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM task_process_links WHERE project_id=NEW.project_id AND task_id=NEW.task_id AND process_id=NEW.process_id AND scope='subtree')
BEGIN SELECT RAISE(ABORT,'WORK_AREA_PROCESS_SCOPE_MISMATCH'); END;
CREATE TRIGGER task_work_area_links_process_scope_update BEFORE UPDATE ON task_work_area_links
WHEN NEW.scope='subtree' AND NOT EXISTS(SELECT 1 FROM task_process_links WHERE project_id=NEW.project_id AND task_id=NEW.task_id AND process_id=NEW.process_id AND scope='subtree')
BEGIN SELECT RAISE(ABORT,'WORK_AREA_PROCESS_SCOPE_MISMATCH'); END;
CREATE TRIGGER task_process_links_work_area_scope_guard BEFORE UPDATE OF scope ON task_process_links
WHEN NEW.scope='self' AND EXISTS(SELECT 1 FROM task_work_area_links WHERE project_id=OLD.project_id AND task_id=OLD.task_id AND process_id=OLD.process_id AND scope='subtree')
BEGIN SELECT RAISE(ABORT,'WORK_AREA_PROCESS_SCOPE_MISMATCH'); END;
CREATE TRIGGER task_process_links_milestone_insert BEFORE INSERT ON task_process_links
WHEN EXISTS(SELECT 1 FROM tasks WHERE project_id=NEW.project_id AND id=NEW.task_id AND type='milestone')
BEGIN SELECT RAISE(ABORT,'PROCESS_CONTEXT_MILESTONE_FORBIDDEN'); END;
CREATE TRIGGER task_process_links_milestone_update BEFORE UPDATE ON task_process_links
WHEN EXISTS(SELECT 1 FROM tasks WHERE project_id=NEW.project_id AND id=NEW.task_id AND type='milestone')
BEGIN SELECT RAISE(ABORT,'PROCESS_CONTEXT_MILESTONE_FORBIDDEN'); END;
CREATE TRIGGER tasks_process_context_milestone_guard BEFORE UPDATE OF type ON tasks
WHEN NEW.type='milestone' AND EXISTS(SELECT 1 FROM task_process_links WHERE project_id=OLD.project_id AND task_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'PROCESS_CONTEXT_MILESTONE_FORBIDDEN'); END;
