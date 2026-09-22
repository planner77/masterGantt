import "server-only";

import { getDatabase } from "../db";
import { ProjectCopyService } from "./project-copy-service-core";
import { TaskFieldSubtreeDeleteService } from "./task-field-companion-services";
import { TaskFieldProjectService } from "./task-field-project-service";
import { TaskHierarchyService } from "./task-hierarchy-service-core";
import { LinkService } from "./link-service-core";

export function getProjectService(): TaskFieldProjectService {
  return new TaskFieldProjectService(getDatabase());
}

export function getProjectCopyService(): ProjectCopyService {
  return new ProjectCopyService(getDatabase());
}

export function getTaskSubtreeDeleteService(): TaskFieldSubtreeDeleteService {
  return new TaskFieldSubtreeDeleteService(getDatabase());
}

export function getTaskHierarchyService(): TaskHierarchyService {
  return new TaskHierarchyService(getDatabase());
}


export function getLinkService() {
  const database = getDatabase();
  const project = new TaskFieldProjectService(database);
  const links = new LinkService(database);
  return {
    authorize: project.authorize.bind(project),
    create: links.create.bind(links),
    delete: links.delete.bind(links),
  };
}
