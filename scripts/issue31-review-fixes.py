from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found: {path}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


# 1) 삭제 메뉴를 기존 ProjectGantt 메뉴에 통합하여 flex/layout, 메뉴 상호배제,
#    scroll-position guard와 원래 task trigger를 그대로 재사용한다.
path = "src/features/gantt/project-gantt.tsx"
replace_once(path,
'''  readonly onTaskCommand: (command: ProjectTaskUpdateCommand) => void;\n  readonly onTaskEditorOpen: (taskId: string) => void;\n  readonly columnVisibility: ProjectGridColumnVisibility;''',
'''  readonly onTaskCommand: (command: ProjectTaskUpdateCommand) => void;\n  readonly onTaskEditorOpen: (taskId: string) => void;\n  readonly onTaskDeleteRequest: (taskId: string, trigger: HTMLElement | null) => void;\n  readonly columnVisibility: ProjectGridColumnVisibility;''')
replace_once(path,
'''  onTaskCommand,\n  onTaskEditorOpen,\n  columnVisibility,''',
'''  onTaskCommand,\n  onTaskEditorOpen,\n  onTaskDeleteRequest,\n  columnVisibility,''')
replace_once(path,
'''  const onTaskEditorOpenReference = useRef(onTaskEditorOpen);\n  const canCreateReference = useRef(editable && !mutationLocked);''',
'''  const onTaskEditorOpenReference = useRef(onTaskEditorOpen);\n  const onTaskDeleteRequestReference = useRef(onTaskDeleteRequest);\n  const canCreateReference = useRef(editable && !mutationLocked);''')
replace_once(path,
'''    onTaskEditorOpenReference.current = onTaskEditorOpen;\n    canCreateReference.current = editable && !mutationLocked;''',
'''    onTaskEditorOpenReference.current = onTaskEditorOpen;\n    onTaskDeleteRequestReference.current = onTaskDeleteRequest;\n    canCreateReference.current = editable && !mutationLocked;''')
replace_once(path,
'''  }, [editable, mutationLocked, onCanonicalSyncFailure, onTaskAddRejected, onTaskCreate, onTaskEditorOpen, tasksById]);''',
'''  }, [editable, mutationLocked, onCanonicalSyncFailure, onTaskAddRejected, onTaskCreate, onTaskDeleteRequest, onTaskEditorOpen, tasksById]);''')
replace_once(path,
'''    setTaskMenu({ taskId: match.taskId, ...clampMenuPosition(anchorX, anchorY, 192, 52) });''',
'''    setTaskMenu({ taskId: match.taskId, ...clampMenuPosition(anchorX, anchorY, 192, 92) });''')
replace_once(path,
'''  function openTaskEditorFromMenu() {\n    const api = apiReference.current;\n    if (!api || !taskMenu) return;\n    const taskId = taskMenu.taskId;\n    setTaskMenu(null);\n    void api.exec("show-editor", { id: taskId });\n  }\n\n  function handleHeaderContextMenu''',
'''  function openTaskEditorFromMenu() {\n    const api = apiReference.current;\n    if (!api || !taskMenu) return;\n    const taskId = taskMenu.taskId;\n    setTaskMenu(null);\n    void api.exec("show-editor", { id: taskId });\n  }\n\n  function requestTaskDeleteFromMenu() {\n    if (!taskMenu) return;\n    const taskId = taskMenu.taskId;\n    const trigger = taskMenuTriggerReference.current;\n    setTaskMenu(null);\n    onTaskDeleteRequestReference.current(taskId, trigger);\n  }\n\n  function handleHeaderContextMenu''')
replace_once(path,
'''  function handleTaskMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {\n    if (event.key === "Escape") {\n      event.preventDefault();\n      event.stopPropagation();\n      closeTaskMenu();\n    }\n  }\n\n  return (''',
'''  function handleTaskMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {\n    if (event.key === "Escape") {\n      event.preventDefault();\n      event.stopPropagation();\n      closeTaskMenu();\n    }\n  }\n\n  const canDelete = editable && !mutationLocked && links.length === 0;\n\n  return (''')
replace_once(path,
'''          <button onClick={openTaskEditorFromMenu} role="menuitem" type="button">\n            <span aria-hidden="true" className="project-task-context-menu-icon">i</span>\n            <span>작업 정보</span>\n          </button>\n        </div> : null}''',
'''          <button onClick={openTaskEditorFromMenu} role="menuitem" type="button">\n            <span aria-hidden="true" className="project-task-context-menu-icon">i</span>\n            <span>작업 정보</span>\n          </button>\n          <button\n            className="project-task-context-menu-danger"\n            disabled={!canDelete}\n            onClick={requestTaskDeleteFromMenu}\n            role="menuitem"\n            type="button"\n          >\n            <span aria-hidden="true" className="project-task-context-menu-icon">×</span>\n            <span>작업 삭제</span>\n          </button>\n        </div> : null}''')

# 2) ProjectWorkspace는 다시 ProjectGantt 자체를 직접 자식으로 렌더링한다.
path = "src/features/projects/project-readonly-view.tsx"
replace_once(path,
'''import type { ProjectGridColumnVisibility } from "@/features/gantt/project-gantt-with-delete";''',
'''import type { ProjectGridColumnVisibility } from "@/features/gantt/project-gantt";''')
replace_once(path,
'''  () => import("@/features/gantt/project-gantt-with-delete").then((module) => module.ProjectGanttWithDelete),''',
'''  () => import("@/features/gantt/project-gantt").then((module) => module.ProjectGantt),''')
replace_once(path,
'''  function requestTaskDelete(taskId: string) {''',
'''  function requestTaskDelete(taskId: string, trigger: HTMLElement | null) {''')
replace_once(path,
'''    deleteTriggerReference.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;''',
'''    deleteTriggerReference.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);''')

# 중간 wrapper는 레이아웃 계약을 깨므로 제거한다.
wrapper = Path("src/features/gantt/project-gantt-with-delete.tsx")
if not wrapper.exists():
    raise SystemExit("expected wrapper file is missing")
wrapper.unlink()

# 3) 기존 E2E helper의 메뉴 shape 계약을 2개 항목으로 갱신한다.
replace_once("tests/e2e/helpers/task-context-menu.ts",
'''  await expect(menu.getByRole("menuitem")).toHaveCount(1);''',
'''  await expect(menu.getByRole("menuitem")).toHaveCount(2);''')

# 4) 기존 persisted schedule validator를 subtree delete에서도 재사용한다.
replace_once("src/server/projects/project-service-core.ts",
'''function recalculatePersistedHierarchy(''',
'''export function recalculatePersistedHierarchy(''')
path = "src/server/projects/task-subtree-delete-service-core.ts"
replace_once(path,
'''  PersistedScheduleInvalidError,\n  RevisionMismatchError,''',
'''  PersistedScheduleInvalidError,\n  recalculatePersistedHierarchy,\n  RevisionMismatchError,''')
replace_once(path,
'''      const holidays = this.schedules.listHolidays(project.id);\n      if (links.length > 0) throw new UnsupportedScheduleStructureError();\n      const current = tasks.find((task) => task.publicId === taskPublicId);''',
'''      const holidays = this.schedules.listHolidays(project.id);\n      if (links.length > 0) throw new UnsupportedScheduleStructureError();\n      const calendar = workingCalendar(project, holidays);\n      recalculatePersistedHierarchy(tasks, calendar);\n      const current = tasks.find((task) => task.publicId === taskPublicId);''')
replace_once(path,
'''      const remainingTasks = this.schedules.listTasks(project.id);\n      const calendar = workingCalendar(project, holidays);\n      let derived: readonly ProjectTaskDto[];''',
'''      const remainingTasks = this.schedules.listTasks(project.id);\n      let derived: readonly ProjectTaskDto[];''')

# 5) 서버 회귀: 삭제 대상 subtree 안에 있던 기존 손상 데이터도 지우기 전에 거부해야 한다.
path = "tests/server/projects/task-subtree-delete-service.test.ts"
replace_once(path,
'''  EmptySummaryNotAllowedError,\n  ProjectService,''',
'''  EmptySummaryNotAllowedError,\n  PersistedScheduleInvalidError,\n  ProjectService,''')
replace_once(path,
'''  it("allows deleting a whole root subtree but rejects a subtree that would leave an outside summary empty", async () => {''',
'''  it("rejects deletion before mutation when the persisted subtree schedule is already invalid", async () => {\n    const value = await fixture();\n    try {\n      const root = value.service.createTask(value.authorization, 1, input("ROOT")).data.tasks[0];\n      const child = value.service.createTask(value.authorization, 2, {\n        ...input("CHILD", "2026-09-15", 1), parentTaskId: root.taskId, convertParentToSummary: true,\n      }).data.tasks.find((task) => task.externalId === "CHILD")!;\n      value.database.prepare("UPDATE tasks SET start_date = ? WHERE public_id = ?")\n        .run("2026-09-17", child.taskId);\n\n      expect(() => value.subtree.deleteTaskSubtree(value.authorization, 3, root.taskId))\n        .toThrow(PersistedScheduleInvalidError);\n      expect(value.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(2);\n      expect(value.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(3);\n    } finally {\n      value.database.close();\n    }\n  });\n\n  it("allows deleting a whole root subtree but rejects a subtree that would leave an outside summary empty", async () => {''')

# 6) 취소 시 unmount된 메뉴 버튼이 아니라 원래 Grid/Chart task target으로 focus가 복원되는지 검증한다.
replace_once("tests/e2e/project-task-delete-context.spec.ts",
'''  await expect(dialog).toHaveCount(0);\n  expect(deleteRequests).toBe(0);\n\n  await row.getByText("Delete branch", { exact: true }).click({ button: "right" });''',
'''  await expect(dialog).toHaveCount(0);\n  expect(deleteRequests).toBe(0);\n  await expect(row).toBeFocused();\n\n  await row.getByText("Delete branch", { exact: true }).click({ button: "right" });''')
