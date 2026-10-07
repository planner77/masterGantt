import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import {
  ProjectMasterItemInactiveError,
  ProjectMasterItemInUseError,
  ProjectMasterRelationInvalidError,
  ProjectMasterRelationInUseError,
  ProjectMasterService,
} from "../../../src/server/project-master/project-master-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import type { PasswordHashRecord } from "../../../src/server/security/password-core";
import { hashSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const NOW = new Date("2026-09-30T00:00:00.000Z");

function fixedPasswordHash(): PasswordHashRecord {
  return {
    algorithm: "scrypt",
    salt: Buffer.alloc(16, 1),
    hash: Buffer.alloc(32, 2),
    n: 32_768,
    r: 8,
    p: 3,
    keyLength: 32,
  };
}

describe("Issue #289 project master catalog", () => {
  it("persists nullable global master references and preserves inactive selections", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    const ids = [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
      "10000000-0000-4000-8000-000000000003",
    ];
    let itemIndex = 0;
    const adminToken = "A".repeat(43);
    const master = new ProjectMasterService(database, {
      clock: () => NOW,
      generatePublicId: () => ids[itemIndex++]!,
      generateSessionToken: () => ({ rawToken: adminToken, tokenHash: hashSessionToken(adminToken) }),
    });

    const unlocked = master.unlockAdmin("Admin123!", "Admin123!");
    expect(unlocked?.rawToken).toBe(adminToken);

    let catalog = master.createItem(adminToken, 1, {
      category: "BUSINESS_UNIT", code: "BU01", name: "스마트팩토리사업부", sortOrder: 10,
    });
    catalog = master.createItem(adminToken, catalog.data.revision, {
      category: "PRODUCT", code: "MCS", name: "MCS", sortOrder: 10,
    });
    catalog = master.createItem(adminToken, catalog.data.revision, {
      category: "SITE_ENTITY", code: "VN", name: "베트남 법인", sortOrder: 10,
    });

    catalog = master.mutateRelation(adminToken,catalog.data.revision,{businessUnitId:ids[0]!,productId:ids[1]!},false);
    catalog = master.mutateRelation(adminToken,catalog.data.revision,{businessUnitId:ids[0]!,productId:ids[1]!,siteEntityId:ids[2]!},false);

    const projectToken = "B".repeat(43);
    const projects = new TaskFieldProjectService(database, {
      clock: () => NOW,
      generatePublicId: () => "20000000-0000-4000-8000-000000000001",
      hashPassword: async () => fixedPasswordHash(),
      generateSessionToken: () => ({ rawToken: projectToken, tokenHash: hashSessionToken(projectToken) }),
    });

    const created = await projects.create({
      name: "Project master test",
      description: "",
      ownerName: "QA",
      editPassword: "pw",
      businessUnitId: ids[0],
      productId: ids[1],
      siteEntityId: ids[2],
    });
    expect(created.response.data.project).toMatchObject({
      businessUnit: { id: ids[0], code: "BU01", name: "스마트팩토리사업부", active: true },
      product: { id: ids[1], code: "MCS", active: true },
      siteEntity: { id: ids[2], code: "VN", active: true },
    });
    expect(projects.listProjects().data.projects).toContainEqual(expect.objectContaining({
      publicId: created.response.data.project.publicId,
      businessUnit: expect.objectContaining({ name: "스마트팩토리사업부", active: true }),
      product: expect.objectContaining({ name: "MCS", active: true }),
      siteEntity: expect.objectContaining({ name: "베트남 법인", active: true }),
    }));

    catalog = master.updateItem(ids[0]!, adminToken, catalog.data.revision, { active: false });
    expect(projects.listProjects().data.projects).toContainEqual(expect.objectContaining({
      publicId: created.response.data.project.publicId,
      businessUnit: expect.objectContaining({ name: "스마트팩토리사업부", active: false }),
    }));
    expect(master.getSelectionCatalog().data.businessUnits).toEqual([]);

    const auth = projects.authorize(created.response.data.project.publicId, projectToken);
    expect(auth.kind).toBe("authorized");
    if (auth.kind !== "authorized") throw new Error("Expected edit authorization.");

    const renamed = projects.updateMetadata(auth.authorization, created.response.data.project.revision, {
      name: "Project master test renamed",
    });
    expect(renamed.data.project.businessUnit).toMatchObject({
      id: ids[0], code: "BU01", active: false,
    });

    expect(() => master.updateItem(ids[0]!, adminToken, catalog.data.revision, { code: "BU02" }))
      .toThrow(ProjectMasterItemInUseError);

    const secondProjects = new TaskFieldProjectService(database, {
      clock: () => NOW,
      generatePublicId: () => "20000000-0000-4000-8000-000000000002",
      hashPassword: async () => fixedPasswordHash(),
      generateSessionToken: () => {
        const token = "C".repeat(43);
        return { rawToken: token, tokenHash: hashSessionToken(token) };
      },
    });
    await expect(secondProjects.create({
      name: "Inactive selection rejected",
      description: "",
      ownerName: "QA",
      editPassword: "pw",
      businessUnitId: ids[0],
    })).rejects.toBeInstanceOf(ProjectMasterItemInactiveError);
  });

  it("links reusable items, validates combinations, and blocks removing referenced relations", async () => {
    const {database}=openDatabase({filename:":memory:",migrationsDirectory});
    const ids=Array.from({length:5},(_,i)=>`30000000-0000-4000-8000-00000000000${i+1}`);
    let i=0;
    const token="R".repeat(43);
    const master=new ProjectMasterService(database,{
      clock:()=>NOW,generatePublicId:()=>ids[i++]!,
      generateSessionToken:()=>({rawToken:token,tokenHash:hashSessionToken(token)}),
    });
    master.unlockAdmin("Admin123!","Admin123!");
    let c=master.createItem(token,1,{category:"BUSINESS_UNIT",code:"A",name:"사업부 A"});
    c=master.createItem(token,c.data.revision,{category:"BUSINESS_UNIT",code:"B",name:"사업부 B"});
    c=master.createItem(token,c.data.revision,{category:"PRODUCT",code:"MCS",name:"제품"});
    c=master.createItem(token,c.data.revision,{category:"SITE_ENTITY",code:"S1",name:"법인 1"});
    c=master.createItem(token,c.data.revision,{category:"SITE_ENTITY",code:"S2",name:"법인 2"});
    c=master.mutateRelation(token,c.data.revision,{businessUnitId:ids[0]!,productId:ids[2]!},false);
    c=master.mutateRelation(token,c.data.revision,{businessUnitId:ids[0]!,productId:ids[2]!,siteEntityId:ids[3]!},false);
    expect(c.data.relations).toEqual(expect.arrayContaining([
      {businessUnitId:ids[0],productId:ids[2],siteEntityId:null},
      {businessUnitId:ids[0],productId:ids[2],siteEntityId:ids[3]},
    ]));
    expect(()=>master.resolveProjectSelection({businessUnitId:ids[1],productId:ids[2]},{allowInactive:false}))
      .toThrow(ProjectMasterRelationInvalidError);
    expect(()=>master.resolveProjectSelection({businessUnitId:ids[0],productId:ids[2],siteEntityId:ids[4]},{allowInactive:false}))
      .toThrow(ProjectMasterRelationInvalidError);
    expect(()=>master.resolveProjectSelection({productId:ids[2]},{allowInactive:false}))
      .toThrow(ProjectMasterRelationInvalidError);
    expect(()=>master.mutateRelation(token,c.data.revision,{businessUnitId:ids[0]!,productId:ids[3]!},false))
      .toThrow(ProjectMasterRelationInvalidError);

    const unchanged=master.mutateRelation(token,c.data.revision,{businessUnitId:ids[0]!,productId:ids[2]!},false);
    expect(unchanged.data.revision).toBe(c.data.revision);
    const ptoken="S".repeat(43);
    const projects=new TaskFieldProjectService(database,{
      clock:()=>NOW,generatePublicId:()=>"40000000-0000-4000-8000-000000000001",
      hashPassword:async()=>fixedPasswordHash(),
      generateSessionToken:()=>({rawToken:ptoken,tokenHash:hashSessionToken(ptoken)}),
    });
    const created=await projects.create({
      name:"Hierarchy",description:"",ownerName:"QA",editPassword:"pw",
      businessUnitId:ids[0],productId:ids[2],siteEntityId:ids[3],
    });
    expect(()=>master.mutateRelation(token,c.data.revision,{businessUnitId:ids[0]!,productId:ids[2]!,siteEntityId:ids[3]!},true))
      .toThrow(ProjectMasterRelationInUseError);
    expect(()=>master.mutateRelation(token,c.data.revision,{businessUnitId:ids[0]!,productId:ids[2]!},true))
      .toThrow(ProjectMasterRelationInUseError);
    const auth=projects.authorize(created.response.data.project.publicId,ptoken);
    if(auth.kind!=="authorized") throw new Error("missing authorization");
    expect(()=>projects.updateMetadata(auth.authorization,created.response.data.project.revision,{businessUnitId:ids[1]}))
      .toThrow(ProjectMasterRelationInvalidError);
    expect(projects.listProjects().data.projects.find((row) => row.publicId === created.response.data.project.publicId)?.businessUnit?.id).toBe(ids[0]);
  });

  it("keeps existing projects unassigned after migration", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    const columns = database.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "business_unit_id", "product_id", "site_entity_id",
    ]));
    expect(database.prepare("SELECT count(*) AS count FROM project_master_items").get()).toEqual({ count: 0 });
  });
});
