import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CountryCalendarCatalogService } from "../../../src/server/calendars/country-calendar-catalog-core";
import { WorkCalendarService } from "../../../src/server/calendars/work-calendar-service-core";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";

const NOW=new Date("2026-09-30T03:00:00.000Z");
const MIGRATIONS=join(process.cwd(),"db","migrations");

describe("Issue #342 country catalog scheduling integration",()=>{
  it("keeps existing materialized calendars stable and uses a new OFFICIAL override on explicit preview/save",async()=>{
    const database=openDatabase({filename:":memory:",migrationsDirectory:MIGRATIONS}).database;
    try{
      const projects=new ProjectService(database,{
        clock:()=>NOW,
        hashPassword:async()=>({algorithm:"scrypt",salt:Buffer.alloc(16,1),hash:Buffer.alloc(32,2),n:32768,r:8,p:3,keyLength:32}),
      });
      const created=await projects.create({name:"2030 calendar project",description:"",editPassword:"Pass123!"});
      const auth=projects.authorize(created.response.data.project.publicId,created.rawSessionToken);
      if(auth.kind!=="authorized")throw new Error("Expected authorization");

      const calendars=new WorkCalendarService(database,{clock:()=>NOW});
      const storedBefore=calendars.get(created.response.data.project.publicId)!;
      expect(storedBefore.data.rules).toContainEqual(expect.objectContaining({
        countryCode:"KR",sourceVersion:"KR-2026-law-2026-05-11",
      }));

      const catalog=new CountryCalendarCatalogService(database,()=>NOW);
      const envelope={
        format:"json" as const,
        content:JSON.stringify({
          countryCode:"KR",year:2030,sourceVersion:"KR-2030-official-1",sourceUrl:"https://example.go.kr/2030",
          dates:[{date:"2030-01-02",name:"2030 공식 휴일",dayType:"NON_WORKING",sourceKey:"official-day"}],
        }),
      };
      const importPreview=catalog.previewImport(envelope);
      const imported=catalog.applyImport(1,importPreview.data.previewToken,envelope);
      expect(imported.data.revision).toBe(2);

      // Catalog mutation alone must not rewrite a Project snapshot.
      expect(calendars.get(created.response.data.project.publicId)).toEqual(storedBefore);

      const projectId=auth.authorization.projectId;
      database.prepare(`
        INSERT INTO tasks (
          project_id,external_id,public_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,
          progress,parent_id,sort_order,created_at,updated_at
        ) VALUES (?, ?, ?, '2030 task', 'task', 'auto', '2030-01-01', '2030-01-01', '2030-01-01', 1, 0, NULL, 0, ?, ?)
      `).run(projectId,randomUUID(),randomUUID(),NOW.toISOString(),NOW.toISOString());

      const input={countryRules:[{countryCode:"KR" as const,scope:"FULL_PROJECT" as const}],customDates:[]};
      const preview=calendars.preview(created.response.data.project.publicId,input);
      expect(preview.data.calendar.projectDates).toContainEqual(expect.objectContaining({
        date:"2030-01-02",name:"2030 공식 휴일",
      }));
      expect(preview.data.calendar.rules).toContainEqual(expect.objectContaining({
        countryCode:"KR",sourceVersion:"KR-2030-official-1",
      }));

      const saved=calendars.replace(auth.authorization,auth.authorization.projectRevision,input);
      expect(saved.data.calendar.projectDates).toContainEqual(expect.objectContaining({date:"2030-01-02"}));
      expect(calendars.get(created.response.data.project.publicId)?.data.rules)
        .toContainEqual(expect.objectContaining({sourceVersion:"KR-2030-official-1"}));
    }finally{database.close();}
  });

  it("keeps project creation available while the current KR override awaits reapproval",async()=>{
    const database=openDatabase({filename:":memory:",migrationsDirectory:MIGRATIONS}).database;
    try{
      const catalog=new CountryCalendarCatalogService(database,()=>NOW);
      const initial=catalog.getAdminDataset("KR",2026);
      const invalidated=catalog.addDate("KR",2026,initial.data.revision,{
        date:"2026-12-31",name:"재검증 대기일",dayType:"NON_WORKING",sourceKey:"manual-review",
      });
      expect(invalidated.data.dataset).toMatchObject({
        status:"UNAVAILABLE",sourceVersion:null,sourceUrl:null,
      });
      expect(catalog.getEffectiveDataset("KR",2026)).toBeUndefined();

      const projects=new ProjectService(database,{
        clock:()=>NOW,
        hashPassword:async()=>({algorithm:"scrypt",salt:Buffer.alloc(16,1),hash:Buffer.alloc(32,2),n:32768,r:8,p:3,keyLength:32}),
      });
      const created=await projects.create({name:"재승인 대기 중 생성",description:"",editPassword:"Pass123!"});
      const calendars=new WorkCalendarService(database,{clock:()=>NOW});
      expect(calendars.get(created.response.data.project.publicId)?.data.rules).toContainEqual(expect.objectContaining({
        countryCode:"KR",sourceVersion:"KR-2026-law-2026-05-11",
      }));
      expect(calendars.get(created.response.data.project.publicId)?.data.projectDates)
        .not.toContainEqual(expect.objectContaining({sourceKey:"manual-review"}));
    }finally{database.close();}
  });
});
