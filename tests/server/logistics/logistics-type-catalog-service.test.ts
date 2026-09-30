import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import {
  LogisticsCatalogConflictError,
  LogisticsCatalogRevisionMismatchError,
  LogisticsCatalogTypeInactiveError,
  LogisticsTypeCatalogService,
} from "../../../src/server/logistics/logistics-type-catalog-service-core";

const migrationsDirectory=join(process.cwd(),"db","migrations");

describe("LogisticsTypeCatalogService",()=>{
  it("seeds defaults and manages custom type activation with revision protection",()=>{
    const {database}=openDatabase({filename:":memory:",migrationsDirectory});
    try{
      const service=new LogisticsTypeCatalogService(database,{clock:()=>new Date("2026-09-29T12:00:00.000Z")});
      expect(service.getActiveCatalog().data.equipmentTypes.map(x=>x.code)).toEqual(["stocker","agv","amr","oht","conveyor","other"]);
      expect(service.getActiveCatalog().data.systemTypes.map(x=>x.code)).toEqual(["mcs","acs","scs","ocs","lcs","other"]);

      const bootstrap="A".repeat(16);
      const admin=service.unlockAdmin(bootstrap,bootstrap);
      expect(admin).toBeDefined();
      if(!admin)throw new Error("fixture admin session missing");

      let catalog=service.create("equipment",admin.rawToken,1,{code:"shuttle",name:"Shuttle",sortOrder:25});
      expect(()=>service.create("equipment",admin.rawToken,2,{code:"shuttle",name:"Duplicate"})).toThrow(LogisticsCatalogConflictError);
      expect(catalog.data.revision).toBe(2);
      expect(catalog.data.equipmentTypes.find(x=>x.code==="shuttle")).toMatchObject({name:"Shuttle",active:true,usageCount:0});

      catalog=service.update("equipment","shuttle",admin.rawToken,2,{active:false});
      expect(catalog.data.revision).toBe(3);
      expect(service.getActiveCatalog().data.equipmentTypes.some(x=>x.code==="shuttle")).toBe(false);
      expect(()=>service.assertActiveType("equipment","shuttle")).toThrow(LogisticsCatalogTypeInactiveError);
      expect(()=>service.update("equipment","shuttle",admin.rawToken,2,{name:"stale"})).toThrow(LogisticsCatalogRevisionMismatchError);
    }finally{database.close();}
  });

  it("uses environment input only for bootstrap and revokes the previous session on password rotation",()=>{
    const {database}=openDatabase({filename:":memory:",migrationsDirectory});
    try{
      const service=new LogisticsTypeCatalogService(database,{clock:()=>new Date("2026-09-29T12:00:00.000Z")});
      const bootstrap="B".repeat(16);
      const changedEnv="C".repeat(16);
      const rotatedPassword="Rotate1!";
      const first=service.unlockAdmin(bootstrap,bootstrap);
      expect(first).toBeDefined();
      if(!first)throw new Error("fixture admin session missing");
      expect(service.unlockAdmin(changedEnv,changedEnv)).toBeUndefined();

      const rotated=service.changeAdminPassword(first.rawToken,rotatedPassword);
      expect(service.authorizeAdmin(first.rawToken)).toBe(false);
      expect(service.authorizeAdmin(rotated.rawToken)).toBe(true);
      expect(service.unlockAdmin(bootstrap,bootstrap)).toBeUndefined();
      expect(service.unlockAdmin(rotatedPassword,bootstrap)).toBeDefined();
    }finally{database.close();}
  });
});
