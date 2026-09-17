import type Database from "better-sqlite3";

interface ProjectOwnerRow {
  public_id: string;
  owner_name: string | null;
}

/**
 * Project owner is display metadata entered by a user, not an authorization identity.
 * NULL is reserved for projects created before Issue #54 introduced this field.
 */
export class ProjectOwnerRepository {
  constructor(private readonly database: Database.Database) {}

  setByPublicId(publicId: string, ownerName: string | null): boolean {
    const result = this.database
      .prepare("UPDATE projects SET owner_name = ? WHERE public_id = ?")
      .run(ownerName, publicId);
    return result.changes === 1;
  }

  findByPublicId(publicId: string): string | null | undefined {
    const row = this.database
      .prepare("SELECT owner_name FROM projects WHERE public_id = ?")
      .get(publicId) as Pick<ProjectOwnerRow, "owner_name"> | undefined;
    return row ? row.owner_name : undefined;
  }

  findById(projectId: number): string | null | undefined {
    const row = this.database
      .prepare("SELECT owner_name FROM projects WHERE id = ?")
      .get(projectId) as Pick<ProjectOwnerRow, "owner_name"> | undefined;
    return row ? row.owner_name : undefined;
  }

  list(): Map<string, string | null> {
    const rows = this.database
      .prepare("SELECT public_id, owner_name FROM projects")
      .all() as ProjectOwnerRow[];
    return new Map(rows.map((row) => [row.public_id, row.owner_name]));
  }
}
