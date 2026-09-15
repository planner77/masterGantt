import "server-only";

import { getDatabase } from "../db";
import { ResourceCatalogService } from "./resource-catalog-service-core";

export function getResourceCatalogService(): ResourceCatalogService {
  return new ResourceCatalogService(getDatabase());
}
