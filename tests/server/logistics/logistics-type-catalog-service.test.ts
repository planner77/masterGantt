import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import {
  LogisticsCatalogRevisionMismatchError,
  LogisticsCatalogTypeInactiveError,
  LogisticsTypeCatalogService,
} from "../../../src/server/logistics/logistics-type-catalog-service-core";

const migrationsDirectory=join(process.cwd(),"db","migrations");

describe("LogisticsTypeCatalogService",()=>{
  it("seeds canonical defaults and persists custom active/inactive types with optimistic concurrency",()=>{
    const {database}=openDatabase({filename:":memory:",migrationsDirectory});
    try{
      const service=new LogisticsTypeCatalogService(database,{clock:()=>new Date("2026-09-29T12:00:00.000Z")});
      const publicCatalog=service.getActiveCatalog();
      expect(publicCatalog.data.equipmentTypes.map(x=>x.code)).toEqual(["stocker","agv","amr","oht","conveyor","other"]);
      expect(publicCatalog.data.systemTypes.map(x=>x.code)).toEqual(["mcs","acs","scs","ocs","lcs","other"]);

      const admin=service.unlockAdmin("LogiAdmin123!","LogiAdmin123!");
      expect(admin).toBeDefined();
      if(!admin)throw new Error("admin session missing");

      let catalog=service.create("equipment",admin.rawToken,1,{code:"shuttle",name:"Shuttle",sortOrder:25});
      expect(catalog.data.revision).toBe(2);
      expect(catalog.data.equipmentTypes.find(x=>x.code==="shuttle")).toMatchObject({name:"Shuttle",active:true,usageCount:0});

      catalog=service.update("equipment","shuttle",admin.rawToken,2,{active:false});
      expect(catalog.data.revision).toBe(3);
      expect(service.getActiveCatalog().data.equipmentTypes.some(x=>x.code==="shuttle")).toBe(false);
      expect(()=>service.assertActiveType("equipment","shuttle")).toThrow(LogisticsCatalogTypeInactiveError);
      expect(()=>service.update("equipment","shuttle",admin.rawToken,2,{name:"stale"})).toThrow(LogisticsCatalogRevisionMismatchError);
    }finally{database.close();}
  });

  it("uses env only for bootstrap and rotates the stored credential while revoking the old session",()=>{
    const {database}=openDatabase({filename:":memory:",migrationsDirectory});
    try{
      const service=new LogisticsTypeCatalogService(database,{clock:()=>new Date("2026-09-29T12:00:00.000Z")});
      const first=service.unlockAdmin("Bootstrap123456!","Bootstrap123456!");
      expect(first).toBeDefined();
      if(!first)throw new Error("admin session missing");
      expect(service.unlockAdmin("ChangedEnv123456!","ChangedEnv123456!")).toBeUndefined();

      const rotated=service.changeAdminPassword(first.rawToken,"NewPass123!");
      expect(service.authorizeAdmin(first.rawToken)).toBe(false);
      expect(service.authorizeAdmin(rotated.rawToken)).toBe(true);
      expect(service.unlockAdmin("Bootstrap123456!","Bootstrap123456!")).toBeUndefined();
      expect(service.unlockAdmin("NewPass123!","Bootstrap123456!")).toBeDefined();
    }finally{database.close();}
  });
});
