import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";
import type { ResourceKpiInput } from "../../src/domain/resources/resource-kpi";

/** F0 specification fixtures only; these are not persisted DTOs or a production Target engine. */
export interface F0Member { id: string; kind: "equipment" | "system"; entityId: string }
export interface F0Target { id: string; projectId: string; occurrenceId: string | null; workAreaId: string | null; scope: "process" | "project_common"; members: F0Member[] }
export interface F0Binding { id: string; taskId: string; targetId: string; selection: "whole" | "subset"; memberIds: string[]; scope: "self" | "subtree"; coverageByMember?: Array<{ memberId: string; coverage: number | null }> }
export interface F0Provenance { bindingId: string; sourceTaskId: string; targetId: string; memberId: string; selection: "whole" | "subset"; scope: "self" | "subtree"; inherited: boolean }
export interface F0EffectiveMember { kind: "equipment" | "system"; entityId: string; provenance: F0Provenance[] }
export interface F0LegacyLink { taskId: string; kind: "equipment" | "system"; entityId: string; scope: "self" | "subtree" }
export interface F0LegacySource { sourceKind: "legacy_direct"; sourceTaskId: string; kind: "equipment" | "system"; entityId: string; scope: "self" | "subtree"; inherited: boolean }
export interface F0LinkCase {
  id: string;
  taskId: string;
  bindings: F0Binding[];
  legacy: F0LegacyLink[];
  expected: { members: F0EffectiveMember[]; legacyEntityIds: string[]; legacySources: F0LegacySource[] } | { error: string };
}

export const logisticsTargetBase = {
  projectId: "PROJECT-A",
  siteProductTriples: [
    { businessUnitId: "BU-A", productId: "PRODUCT-P", siteId: "SITE-A" },
    { businessUnitId: "BU-A", productId: "PRODUCT-P", siteId: "SITE-B" },
    { businessUnitId: "BU-A", productId: "PRODUCT-Q", siteId: "SITE-A" },
    { businessUnitId: "BU-B", productId: "PRODUCT-P", siteId: "SITE-A" },
  ],
  productStandards: [
    { id: "STANDARD-ASSEMBLY", productId: "PRODUCT-P", processTypeId: "TYPE-ASSEMBLY" },
    { id: "STANDARD-INSPECTION", productId: "PRODUCT-P", processTypeId: "TYPE-INSPECTION" },
  ],
  occurrences: [
    { id: "OCC-A-ASSEMBLY", businessUnitId: "BU-A", siteId: "SITE-A", productId: "PRODUCT-P", standardId: "STANDARD-ASSEMBLY", processTypeId: "TYPE-ASSEMBLY", code: "ASSEMBLY" },
    { id: "OCC-A-INSPECTION", businessUnitId: "BU-A", siteId: "SITE-A", productId: "PRODUCT-P", standardId: "STANDARD-INSPECTION", processTypeId: "TYPE-INSPECTION", code: "INSPECTION" },
    { id: "OCC-B-ASSEMBLY", businessUnitId: "BU-A", siteId: "SITE-B", productId: "PRODUCT-P", standardId: "STANDARD-ASSEMBLY", processTypeId: "TYPE-ASSEMBLY", code: "ASSEMBLY" },
    { id: "OCC-B-INSPECTION", businessUnitId: "BU-A", siteId: "SITE-B", productId: "PRODUCT-P", standardId: "STANDARD-INSPECTION", processTypeId: "TYPE-INSPECTION", code: "INSPECTION" },
    { id: "OCC-B-SPECIAL", businessUnitId: "BU-A", siteId: "SITE-B", productId: "PRODUCT-P", standardId: null, processTypeId: "TYPE-SPECIAL", code: "SPECIAL" },
    { id: "OCC-A-OTHER-PRODUCT", businessUnitId: "BU-A", siteId: "SITE-A", productId: "PRODUCT-Q", standardId: null, processTypeId: "TYPE-ASSEMBLY", code: "ASSEMBLY" },
    { id: "OCC-A-OTHER-BU", businessUnitId: "BU-B", siteId: "SITE-A", productId: "PRODUCT-P", standardId: "STANDARD-ASSEMBLY", processTypeId: "TYPE-ASSEMBLY", code: "ASSEMBLY" },
  ],
  workAreas: [
    { id: "WA-A", occurrenceId: "OCC-A-ASSEMBLY", name: "A" },
    { id: "WA-B", occurrenceId: "OCC-A-ASSEMBLY", name: "B" },
  ],
  equipment: [
    { id: "AMR-A", equipmentType: "amr", managementUnit: "fleet", quantity: 10 },
    { id: "AMR-B", equipmentType: "amr", managementUnit: "fleet", quantity: 5 },
  ],
  systems: [
    { id: "ACS-A", systemType: "acs" }, { id: "ACS-B", systemType: "acs" }, { id: "MCS-1", systemType: "mcs" },
  ],
  tasks: [
    { id: "S", parentId: null, type: "summary" },
    { id: "S-CHILD", parentId: "S", type: "summary" },
    { id: "T", parentId: "S-CHILD", type: "task" },
    { id: "M", parentId: null, type: "milestone" },
  ],
  targets: [
    { id: "TARGET-A", projectId: "PROJECT-A", occurrenceId: "OCC-A-ASSEMBLY", workAreaId: "WA-A", scope: "process", members: [
      { id: "MEM-A-AMR", kind: "equipment", entityId: "AMR-A" },
      { id: "MEM-A-ACS", kind: "system", entityId: "ACS-A" },
      { id: "MEM-A-MCS", kind: "system", entityId: "MCS-1" },
    ] },
    { id: "TARGET-B", projectId: "PROJECT-A", occurrenceId: "OCC-A-ASSEMBLY", workAreaId: "WA-B", scope: "process", members: [
      { id: "MEM-B-AMR", kind: "equipment", entityId: "AMR-B" },
      { id: "MEM-B-ACS", kind: "system", entityId: "ACS-B" },
      { id: "MEM-B-MCS", kind: "system", entityId: "MCS-1" },
    ] },
  ] satisfies F0Target[],
};

const whole = (id: string, taskId: string, targetId: string, scope: F0Binding["scope"] = "self"): F0Binding => ({ id, taskId, targetId, selection: "whole", memberIds: [], scope });
const subset = (id: string, taskId: string, memberIds: string[], scope: F0Binding["scope"] = "self"): F0Binding => ({ id, taskId, targetId: "TARGET-A", selection: "subset", memberIds, scope });
const member = (kind: F0Member["kind"], entityId: string, provenance: F0Provenance[]): F0EffectiveMember => ({ kind, entityId, provenance });
const source = (bindingId: string, sourceTaskId: string, targetId: string, memberId: string, inherited = false, selection: F0Binding["selection"] = "subset"): F0Provenance => ({ bindingId, sourceTaskId, targetId, memberId, selection, scope: inherited ? "subtree" : "self", inherited });

export const logisticsTargetLinkCases: F0LinkCase[] = [
  { id: "F0-L01", taskId: "T", bindings: [whole("B1", "T", "TARGET-A")], legacy: [], expected: { members: [
    member("equipment", "AMR-A", [source("B1", "T", "TARGET-A", "MEM-A-AMR", false, "whole")]),
    member("system", "ACS-A", [source("B1", "T", "TARGET-A", "MEM-A-ACS", false, "whole")]),
    member("system", "MCS-1", [source("B1", "T", "TARGET-A", "MEM-A-MCS", false, "whole")]),
  ], legacyEntityIds: [], legacySources: [] } },
  { id: "F0-L02", taskId: "T", bindings: [subset("B2", "T", ["MEM-A-ACS"])], legacy: [], expected: { members: [
    member("system", "ACS-A", [source("B2", "T", "TARGET-A", "MEM-A-ACS")]),
  ], legacyEntityIds: [], legacySources: [] } },
  { id: "F0-L03", taskId: "T", bindings: [whole("B3", "S", "TARGET-A")], legacy: [], expected: { members: [], legacyEntityIds: [], legacySources: [] } },
  { id: "F0-L04", taskId: "T", bindings: [subset("B4", "S", ["MEM-A-AMR"], "subtree"), subset("B5", "S-CHILD", ["MEM-A-ACS"], "subtree"), subset("B6", "T", ["MEM-A-ACS"])], legacy: [], expected: { members: [
    member("equipment", "AMR-A", [source("B4", "S", "TARGET-A", "MEM-A-AMR", true)]),
    member("system", "ACS-A", [source("B5", "S-CHILD", "TARGET-A", "MEM-A-ACS", true), source("B6", "T", "TARGET-A", "MEM-A-ACS")]),
  ], legacyEntityIds: [], legacySources: [] } },
  { id: "F0-L05", taskId: "T", bindings: [subset("B7", "T", ["MEM-A-MCS"]), { ...whole("B8", "T", "TARGET-B"), selection: "subset", memberIds: ["MEM-B-MCS"] }], legacy: [], expected: { members: [
    member("system", "MCS-1", [source("B7", "T", "TARGET-A", "MEM-A-MCS"), source("B8", "T", "TARGET-B", "MEM-B-MCS")]),
  ], legacyEntityIds: [], legacySources: [] } },
  { id: "F0-L06", taskId: "T", bindings: [], legacy: [{ taskId: "T", kind: "system", entityId: "MCS-1", scope: "self" }], expected: { members: [], legacyEntityIds: ["MCS-1"], legacySources: [{ sourceKind: "legacy_direct", sourceTaskId: "T", kind: "system", entityId: "MCS-1", scope: "self", inherited: false }] } },
  { id: "F0-L07", taskId: "T", bindings: [subset("B9", "T", ["REMOVED-MEMBER"])], legacy: [], expected: { error: "SUBSET_MEMBER_UNAVAILABLE" } },
  { id: "F0-L08", taskId: "T", bindings: [subset("B10", "T", [])], legacy: [], expected: { error: "EMPTY_SUBSET" } },
  { id: "F0-L09", taskId: "M", bindings: [whole("B11", "M", "TARGET-A", "subtree")], legacy: [], expected: { error: "SUBTREE_REQUIRES_SUMMARY" } },
  { id: "F0-L10", taskId: "T", bindings: [subset("B12", "T", ["MEM-B-ACS"])], legacy: [], expected: { error: "SUBSET_MEMBER_UNAVAILABLE" } },
  { id: "F0-L11", taskId: "T", bindings: [subset("B13", "T", ["MEM-A-ACS"])], legacy: [{ taskId: "T", kind: "equipment", entityId: "AMR-B", scope: "self" }], expected: { members: [member("system", "ACS-A", [source("B13", "T", "TARGET-A", "MEM-A-ACS")])], legacyEntityIds: ["AMR-B"], legacySources: [{ sourceKind: "legacy_direct", sourceTaskId: "T", kind: "equipment", entityId: "AMR-B", scope: "self", inherited: false }] } },
  { id: "F0-L13", taskId: "T", bindings: [{ ...whole("B14", "T", "TARGET-A"), memberIds: ["MEM-A-ACS"] }], legacy: [], expected: { error: "WHOLE_MEMBERS_MUST_BE_EMPTY" } },
  { id: "F0-L14", taskId: "T", bindings: [subset("B15", "T", ["MEM-A-ACS"])], legacy: [{ taskId: "T", kind: "system", entityId: "ACS-A", scope: "self" }], expected: { members: [member("system", "ACS-A", [source("B15", "T", "TARGET-A", "MEM-A-ACS")])], legacyEntityIds: ["ACS-A"], legacySources: [{ sourceKind: "legacy_direct", sourceTaskId: "T", kind: "system", entityId: "ACS-A", scope: "self", inherited: false }] } },
  { id: "F0-L16", taskId: "T", bindings: [subset("B16", "T", ["MEM-A-ACS"])], legacy: [{ taskId: "S", kind: "system", entityId: "ACS-A", scope: "subtree" }], expected: { members: [member("system", "ACS-A", [source("B16", "T", "TARGET-A", "MEM-A-ACS")])], legacyEntityIds: ["ACS-A"], legacySources: [{ sourceKind: "legacy_direct", sourceTaskId: "S", kind: "system", entityId: "ACS-A", scope: "subtree", inherited: true }] } },
  { id: "F0-L17", taskId: "T", bindings: [], legacy: [{ taskId: "S", kind: "system", entityId: "ACS-A", scope: "self" }], expected: { members: [], legacyEntityIds: [], legacySources: [] } },
  { id: "F0-L18", taskId: "T", bindings: [], legacy: [{ taskId: "T", kind: "system", entityId: "ACS-A", scope: "subtree" }], expected: { error: "LEGACY_SUBTREE_REQUIRES_SUMMARY" } },
];

export const logisticsTargetRemapCase: F0LinkCase = { id: "F0-L19", taskId: "T", bindings: [subset("B9", "T", ["MEM-A-ACS"])], legacy: [], expected: { members: [member("system", "ACS-A", [source("B9", "T", "TARGET-A", "MEM-A-ACS")])], legacyEntityIds: [], legacySources: [] } };

const locationContext = { projectBusinessUnitId: "BU-A", projectProductId: "PRODUCT-P", projectSiteId: "SITE-A" } as const;

export const logisticsTargetLocationCases = [
  { id: "F0-P01", ...locationContext, occurrenceId: "OCC-A-ASSEMBLY", workAreaId: "WA-A", scope: "process", expected: "VALID" },
  { id: "F0-P02", ...locationContext, occurrenceId: "OCC-A-INSPECTION", workAreaId: null, scope: "process", expected: "VALID" },
  { id: "F0-P03", ...locationContext, occurrenceId: "OCC-A-INSPECTION", workAreaId: "WA-A", scope: "process", expected: "WORK_AREA_OCCURRENCE_MISMATCH" },
  { id: "F0-P04", ...locationContext, occurrenceId: "OCC-B-ASSEMBLY", workAreaId: null, scope: "process", expected: "PROJECT_SITE_PRODUCT_MISMATCH" },
  { id: "F0-P05", ...locationContext, occurrenceId: null, workAreaId: null, scope: "project_common", expected: "VALID" },
  { id: "F0-P06", ...locationContext, occurrenceId: null, workAreaId: null, scope: "process", expected: "PROCESS_REQUIRED" },
  { id: "F0-P07", ...locationContext, occurrenceId: "OCC-A-ASSEMBLY", workAreaId: null, scope: "project_common", expected: "PROJECT_COMMON_LOCATION_FORBIDDEN" },
  { id: "F0-P09", ...locationContext, occurrenceId: "OCC-A-OTHER-PRODUCT", workAreaId: null, scope: "process", expected: "PROJECT_SITE_PRODUCT_MISMATCH" },
  { id: "F0-P10", ...locationContext, occurrenceId: "OCC-A-OTHER-BU", workAreaId: null, scope: "process", expected: "PROJECT_SITE_PRODUCT_MISMATCH" },
  { id: "F0-P11", ...locationContext, projectBusinessUnitId: "BU-B", occurrenceId: "OCC-A-OTHER-BU", workAreaId: null, scope: "process", expected: "VALID" },
  { id: "F0-P13", ...locationContext, projectBusinessUnitId: "BU-UNLINKED", occurrenceId: "OCC-A-ASSEMBLY", workAreaId: null, scope: "process", expected: "PROJECT_TRIPLE_UNLINKED" },
] as const;

/** Same five valid working days for every MD case; Group references never expand into people. */
export function logisticsTargetResourceFixture(): ResourceKpiInput {
  return {
    projectPublicId: "PROJECT-A", timezone: "Asia/Seoul", asOfDate: "2026-10-12", from: "2026-10-05", to: "2026-10-11", mdPerMm: 20,
    projectCalendar: createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0] }), memberships: [], links: [],
    tasks: ["INTEGRATED", "GROUP-ONLY", "UNASSIGNED", "UNSET", "PARTIAL", "ZERO", "OVER-SELECTED", "OVER-OUTSIDE"].map((taskId) => ({ taskId, parentTaskId: null, type: "task", duration: 5, progress: 0, status: "not_started", start: "2026-10-05", end: "2026-10-11" })),
    resources: [
      { resourceId: "R1", groupIds: ["G1", "G2"], roles: ["DEVELOPER", "PI"], developerGrade: "ADVANCED" },
      { resourceId: "R2", groupIds: ["G1"], roles: ["DEVELOPER"], developerGrade: "INTERMEDIATE" },
      { resourceId: "R3", groupIds: [], roles: [], developerGrade: null },
    ],
    assignments: [
      { assignmentId: "A1", taskId: "INTEGRATED", kind: "resource", targetId: "R1", allocationPercent: 100 },
      { assignmentId: "AG1", taskId: "GROUP-ONLY", kind: "group", targetId: "G1", allocationPercent: null },
      { assignmentId: "AU1", taskId: "UNSET", kind: "resource", targetId: "R2", allocationPercent: null },
      { assignmentId: "AP1", taskId: "PARTIAL", kind: "resource", targetId: "R2", allocationPercent: 40 },
      { assignmentId: "AP2", taskId: "PARTIAL", kind: "resource", targetId: "R3", allocationPercent: null },
      { assignmentId: "AZ1", taskId: "ZERO", kind: "resource", targetId: "R3", allocationPercent: 100, start: "2026-10-10", end: "2026-10-11" },
      { assignmentId: "AO1", taskId: "OVER-SELECTED", kind: "resource", targetId: "R1", allocationPercent: 80 },
      { assignmentId: "AO2", taskId: "OVER-OUTSIDE", kind: "resource", targetId: "R1", allocationPercent: 60 },
    ],
  };
}

export const logisticsTargetResourceCases = [
  { id: "F0-R01", taskIds: ["INTEGRATED"], expected: { knownMd: 5, plannedMd: 5, state: "configured", unsetCount: 0 } },
  { id: "F0-R02", taskIds: ["UNASSIGNED"], expected: { knownMd: 0, plannedMd: 0, state: "empty", unsetCount: 0 } },
  { id: "F0-R03", taskIds: ["GROUP-ONLY"], expected: { knownMd: 0, plannedMd: 0, state: "empty", unsetCount: 0 } },
  { id: "F0-R04", taskIds: ["UNSET"], expected: { knownMd: 0, plannedMd: null, state: "unset", unsetCount: 1 } },
  { id: "F0-R05", taskIds: ["PARTIAL"], expected: { knownMd: 2, plannedMd: 2, state: "partial", unsetCount: 1 } },
  { id: "F0-R06", taskIds: ["ZERO"], expected: { knownMd: 0, plannedMd: 0, state: "configured", unsetCount: 0 } },
] as const;

export const logisticsTargetQuantityCase = { id: "F0-Q01", targetIds: ["TARGET-A", "TARGET-B"], expected: { equipmentQuantity: 15, systemInstances: 3, acsInstances: 2, mcsInstances: 1 } };
export const logisticsTargetEffortUnionCase = { id: "F0-R07", targetTaskIds: { "TARGET-A": ["INTEGRATED"], "TARGET-B": ["INTEGRATED"] }, expected: { targetA: 5, targetB: 5, union: 5 } };
export const logisticsTargetCoAssigneeCase = { id: "F0-R08", extraAssignments: [
  { assignmentId: "A2", taskId: "INTEGRATED", kind: "resource", targetId: "R2", allocationPercent: 50 },
  { assignmentId: "AG2", taskId: "INTEGRATED", kind: "group", targetId: "G1", allocationPercent: null },
  { assignmentId: "AG3", taskId: "INTEGRATED", kind: "group", targetId: "G2", allocationPercent: null },
] as const, expected: { rawPersonalAssignmentIds: ["A1", "A2"], taskCount: 1, assignmentCount: 2, knownMd: 7.5, g1Md: 7.5, g2Md: 5 } };
export const logisticsTargetOverloadCase = { id: "F0-R09", selectedTaskIds: ["OVER-SELECTED"], projectTaskIds: ["OVER-SELECTED", "OVER-OUTSIDE"], expected: { selectedLoadPercent: 80, projectLoadPercent: 140, projectExcessMd: 2 } };
export const logisticsTargetCoverageCase = { id: "F0-Q02", equipmentId: "AMR-A", bindings: [
  { ...subset("C1", "S", ["MEM-A-AMR"], "subtree"), coverageByMember: [{ memberId: "MEM-A-AMR", coverage: 2 }] },
  { ...subset("C2", "T", ["MEM-A-AMR"]), coverageByMember: [{ memberId: "MEM-A-AMR", coverage: 3 }] },
], expected: { equipmentQuantity: 10, coverageState: "multiple", coverageByBinding: [{ bindingId: "C1", coverage: 2 }, { bindingId: "C2", coverage: 3 }] } };
export const logisticsTargetFilterBindings: F0Binding[] = [subset("FILTER-A", "T", ["MEM-A-ACS"]), whole("FILTER-B", "T", "TARGET-B")];
export const logisticsTargetFilterCases = [
  { id: "F0-F01", targetIds: ["TARGET-A"], workAreaIds: ["WA-B"], memberEntityIds: ["ACS-B"], expected: false },
  { id: "F0-F02", targetIds: ["TARGET-A"], workAreaIds: ["WA-A"], memberEntityIds: ["ACS-A"], expected: true },
  { id: "F0-F03", targetIds: [], workAreaIds: [], memberEntityIds: [], expected: true },
  { id: "F0-F04", targetIds: ["TARGET-A"], workAreaIds: [], memberEntityIds: ["ACS-B"], expected: false },
  { id: "F0-F05", targetIds: ["TARGET-A"], workAreaIds: [], memberEntityIds: ["AMR-A"], expected: false },
  { id: "F0-F06", targetIds: ["TARGET-A"], workAreaIds: [], memberEntityIds: ["AMR-B"], expected: false },
  { id: "F0-F07", targetIds: ["TARGET-A"], workAreaIds: [], memberEntityIds: ["MCS-1"], expected: false },
  { id: "F0-F08", targetIds: ["TARGET-B"], workAreaIds: [], memberEntityIds: ["MCS-1"], expected: true },
] as const;
export const logisticsTargetMmUnsetCase = { id: "F0-R11", taskIds: ["INTEGRATED"], conversion: { queryProvided: false, environmentProvided: false }, expected: { knownMd: 5, plannedMd: 5, plannedMm: null } };
export const logisticsTargetKindFilterCases = [
  { id: "F0-F09", targetIds: ["TARGET-A"], equipmentEntityIds: ["AMR-A"], systemEntityIds: ["ACS-A"], expected: false },
  { id: "F0-F10", targetIds: ["TARGET-B"], equipmentEntityIds: ["AMR-B"], systemEntityIds: ["ACS-B"], expected: true },
  { id: "F0-F11", targetIds: [], equipmentEntityIds: ["AMR-B"], systemEntityIds: ["ACS-A"], expected: false },
  { id: "F0-F12", targetIds: ["TARGET-B"], equipmentEntityIds: ["AMR-B"], systemEntityIds: ["MCS-1"], expected: true },
] as const;
