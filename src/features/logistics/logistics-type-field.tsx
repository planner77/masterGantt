import { useId } from "react";
import styles from "./project-logistics-management.module.css";

type CatalogState = "loading" | "ready" | "error";

/** Project instance types are selected here; creating common types requires separate admin authority. */
export function LogisticsTypeField({ kind, value, existingValue, options, state, busy, onChange, onRetry }: {
  kind: "설비" | "시스템";
  value: string;
  existingValue?: string;
  options: { code: string; name: string }[];
  state: CatalogState;
  busy: boolean;
  onChange: (value: string) => void;
  onRetry: () => void;
}) {
  const id = useId();
  const preserved = existingValue && !options.some(option => option.code === existingValue);
  return <div className={styles.typeField}>
    <label className={styles.fieldLabel} htmlFor={id}>{kind} 유형 *
      <select id={id} className={styles.fieldSelect} required value={value} disabled={busy || state !== "ready"} aria-describedby={`${id}-status`} onChange={event => onChange(event.target.value)}>
        <option value="">유형 선택</option>
        {preserved ? <option value={existingValue}>{existingValue} (비활성 기존 유형)</option> : null}
        {options.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}
      </select>
    </label>
    <div id={`${id}-status`} className={styles.workAreaHint}>
      {state === "loading" ? <p role="status">{kind} 유형 목록을 불러오는 중…</p> : state === "error" ? <p role="alert">{kind} 유형 조회에 실패해 저장할 수 없습니다. 입력한 초안은 유지됩니다.</p> : !options.length ? <p role="status">활성 {kind} 유형이 없습니다. 공통 기준정보 관리자가 유형을 등록·활성화한 뒤 다시 조회해 주세요.{preserved ? " 기존 비활성 유형은 유지할 수 있습니다." : ""}</p> : !value ? <p>{kind} 유형을 선택해 주세요.</p> : null}
      {state !== "loading" && (state === "error" || !options.length) ? <button type="button" className="secondary-button" disabled={busy} onClick={onRetry}>유형 목록 다시 시도</button> : null}
    </div>
  </div>;
}
