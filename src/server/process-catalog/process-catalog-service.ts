import "server-only";
import { getDatabase } from "../db";
import { ProcessCatalogService } from "./process-catalog-service-core";
export function getProcessCatalogService(): ProcessCatalogService {
  return new ProcessCatalogService(getDatabase());
}
