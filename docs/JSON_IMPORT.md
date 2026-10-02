# JSON 파일 가져오기 (JSON Import)

## 1. 목적과 지원 대상
masterGantt는 다른 시스템이나 LLM(AI Agent)이 생성한 JSON 데이터를 읽어 새로운 프로젝트 일정으로 구성하는 기능을 제공합니다.

## 2. 지원 format / schemaVersion
- `schemaVersion`: `"1.0"`

## 3. 사용자 진입 경로
Project Workspace에서 `더보기 → 가져오기 (JSON)`을 선택합니다. 편집기 또는 다른 mutation이 진행 중인 동안에는 Import 진입을 비활성화하여 동시에 여러 Project mutation이 시작되지 않도록 합니다.

## 4. 구조
자세한 스키마는 `docs/schemas/project-import.schema.json`을 참고하세요.

## 5. LLM/Agent 권장 생성 순서
format/schemaVersion 확인
→ project/source metadata 작성
→ externalId를 안정적으로 부여
→ parentExternalId로 WBS 구성
→ sibling order 확인
→ dependency endpoint 연결
→ JSON Schema validation
→ masterGantt Preview
→ 오류 0건 확인 후 Commit
