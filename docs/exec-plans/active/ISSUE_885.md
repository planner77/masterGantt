# Issue #885 — MDXEditor Markdown Description / Work Packet

- Primary: https://github.com/planner77/masterGantt/issues/885
- References: `AGENTS.md`, `DESIGN.md`, `docs/PROJECT_ISSUES_USER_GUIDE.md`, `docs/TASK_EDITOR.md`, `docs/ISSUE_LIFECYCLE.md`, #846/#849/#854/#869/#866/#881, SVAR React Gantt demos (Task Editor custom boundary), MDXEditor official Getting Started / Error Handling / Diff Source.
- Baseline: main `f3f8b89ef09bab35987b32f4945dac91b6fa223a` (2026-11-07), branch `feat/issue-885-mdxeditor`.
- risk_level=HIGH
- qa_method=OWNER_MANAGED
- qa_required=true
- release_required=true
- release_authorized=false
- manager_decision=NOT TESTED
- MERGE_READY=BLOCKED

## Scope / approach

1. Single `DescriptionField` for Issue + Task/Summary/Milestone. `@mdxeditor/editor@4.3.3` is dynamically imported with `ssr:false`. Toolbar permits rich-text + Source; `markdown` is initial-only, state callback updates draft and never resets editor cursor per keystroke. No images, HTML or JSX plugin. Source mode is available for error recovery.
2. `react-markdown@10.1.0` + `remark-gfm@4.0.1`, HTML skipped, element allowlist, all images blocked and link target http(s) only, `noopener noreferrer`. Server AST validation rejects HTML, MDX, image and unsafe link destinations; source input is persisted, not executable.
3. Additive SQLite migration 0038 with `description_format` default `plain` on both tables. Existing plain content is never automatically parsed/reformatted; explicit plain-to-Markdown conversion requires user click. DTO `descriptionFormat` is backward compatible; Task and Issue canonical readers preserve it. Existing write authorization, Origin, If-Match, rate limits, status, resource/Task bindings and SQLite transaction remain unchanged. Project Task Copy preserves format, JSON 1.1 / Excel refuse lossy export rather than silently discard format.
4. Issue max 4000, Task 10000 Unicode code points, null for blank Task. Plain/Markdown and Source/WYSIWYG are separate states from workflow status; no task/Gantt writer overhaul.
5. Documentation: design Delta B, schema/API/Issue/Task/export instructions, AGENTS and Changelog updated; historical migrations and safety gates untouched.

## TEST_LIFECYCLE_REVIEW

- **KEEP_UNIQUE**: `tests/e2e/project-issues.spec.ts` registration/password/revision/geometry and `tests/e2e/project-task-editor*.spec.ts` Task/Summary persistence, concurrency, focus/readonly. Preserve tests; update only obsolete `textarea` access to Source mode and new format expectation.
- **ADD**: `tests/server/projects/markdown-description-885.test.ts` AST safety positive/negative, checked migration defaults, explicit legacy conversion. No suite retire, no skipped checks or timeout relaxations.
- **PARTIAL_OVERLAP**: #869 scroll & locale/focus; #854 public Issue edit, #846 credential; #881 navigation; duplicate surface assertions kept due independent risk.
- **NOT TESTED** until actual run: npm lock/Next build/typecheck, E2E8 Chromium, Docker, Trusted QA, 390/768/1024/1440/1920px browser/ko/en/vi/keyboard/125% zoom/real screen reader, full SQLite backup+restore, import/export downstream consumers. No inferred PASS.

## AC_TEST_COVERAGE

- AC1: both Issue create and Task Editor use shared editor, WYSIWYG/Source — E2E existing suites extended, real Full CI pending.
- AC2: supported heading/quote/list/checkbox/link/table/fenced code, toolbar/keyboard undo — MDXEditor configured; interactive E2E pending.
- AC3: GFM Markdown canonical roundtrip in DB and DTO — migration/contract/service; Task persistence E2E amended; full runtime pending.
- AC4: legacy plain remains literal until explicit click — migration default & plain conversion unit, E2E edit check pending.
- AC5: HTML/JSX/images/unsafe link excluded — AST safety unit + read-only ReactMarkdown renderer; security review pending.
- AC6: no unauthorized write or cross-project escalation — existing Issue password/Task session/If-Match server checks unchanged, targeted tests preserved.
- AC7: SQLite 0038 and Project Copy preserve format; existing historical migrations untouched — unit and copy code; upgrade acceptance pending.
- AC8: JSON/Excel export cannot silently discard format, explicit unsupported for markdown; import for plain unchanged. New schema roundtrip **NOT IMPLEMENTED**, separate acceptance decision required.
- AC9: scroll, responsive widths, focus/keyboard, locale switch, dirty/stale/readonly — existing UI policies preserved, browser evidence pending.
- AC10: #711 test lifecycle mapping and docs synced, Full PR CI (not monitored), no merge/release authorization — this Work Packet.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED, canonical contract
- `DESIGN.md`: UPDATED, editor Design Delta B
- `docs/API.md`: UPDATED, optional format and backward compatibility
- `docs/DB_SCHEMA.md`: UPDATED, migration 0038
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED, WYSIWYG/Source/legacy/security
- `docs/TASK_EDITOR.md`: UPDATED, Task/Summary/Milestone
- `docs/IMPORT_EXPORT.md`: UPDATED, no lossy legacy archive
- `CHANGELOG.md`: UPDATED, unreleased
- `docs/exec-plans/active/ISSUE_885.md`: CREATED, test lifecycle & AC
- `docs/ISSUE_885_FAILURE_ANALYSIS.md`: CREATED, pre-CI and future failures
- `docs/TEST_PLAN.md`: N/A; preserve existing full test source and required workflows
- `docs/SECURITY.md`: N/A; no auth policy change, AST policy in AGENTS/API
- `docs/QA_REVIEW_POLICY.md`: N/A; maintain OWNER_MANAGED/Required3/Trusted gates
- `docs/CI_CD.md`: N/A; no workflows or trust validators changed
- `docs/GITHUB_OPERATIONS.md`: N/A; PR-only; no merge or release
- `docs/REMOTE_VALIDATION.md`: N/A; unmodified Full/Trusted validation policy
- `docs/SCHEDULING_ENGINE.md`: N/A; no Gantt or schedule logic changed
- `docs/IMPORT_SCHEMA.md`: N/A; schema 1.1 unchanged (lossy markdown export refused)
- `docs/UI_UX_GUIDELINES.md`: N/A; editor inherits existing tokens/scroll/focus
- `docs/REQUIREMENTS.md`: N/A; issue #885 is exact feature requirement

## Commands / provenance

- Work performed by GitHub commits on `feat/issue-885-mdxeditor` against snapshot `f3f8b89`; source edits are commit-provenance, **not** execution evidence.
- No local `npm ci` or Vitest/Playwright/browser/production SQLite access in current runtime. Opening the non-draft PR triggers Full PR CI; user explicitly disallowed CI monitoring.
- QA pending: review build/types, AST parser, Markdown rich-text/source data preservation, SQL migration upgrade, exact export contract. No false PASS.
