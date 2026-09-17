import type Database from "better-sqlite3";

import type { CopyProjectRequest } from "../../contracts/projects";
import { ProjectOwnerRepository } from "../repositories/project-owner-repository-core";
import {
  ProjectCopyService,
  type CopiedProject,
  type ProjectCopyServiceOptions,
} from "./project-copy-service-core";
import type { AuthorizedEditSession } from "./project-service-core";

/** Adds Issue #54 owner metadata to the application copy path. */
export class ProjectOwnerCopyService extends ProjectCopyService {
  private readonly owners: ProjectOwnerRepository;

  constructor(
    private readonly ownerDatabase: Database.Database,
    options: ProjectCopyServiceOptions = {},
  ) {
    super(ownerDatabase, options);
    this.owners = new ProjectOwnerRepository(ownerDatabase);
  }

  override async copy(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CopyProjectRequest,
  ): Promise<CopiedProject> {
    const copied = await super.copy(authorization, expectedRevision, input);
    const publicId = copied.response.data.project.publicId;
    const ownerName = input.ownerName ?? this.owners.findById(authorization.projectId) ?? null;
    if (!this.owners.setByPublicId(publicId, ownerName)) {
      throw new Error("Copied project owner metadata could not be persisted.");
    }
    return {
      ...copied,
      response: {
        ...copied.response,
        data: {
          ...copied.response.data,
          project: {
            ...copied.response.data.project,
            ownerName,
          },
        },
      },
    };
  }
}
