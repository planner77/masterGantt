import "server-only";
import { getDatabase } from "../db";
import { LogisticsTypeCatalogService } from "./logistics-type-catalog-service-core";
export function getLogisticsTypeCatalogService():LogisticsTypeCatalogService{return new LogisticsTypeCatalogService(getDatabase());}
