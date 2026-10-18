import "server-only";
import { getDatabase } from "../db";
import { ProjectResourceMembershipService } from "./project-resource-membership-service-core";
export function getProjectResourceMembershipService(): ProjectResourceMembershipService { return new ProjectResourceMembershipService(getDatabase()); }
