"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { DescriptionFormat } from "@/contracts/description-format";
import { MarkdownDescription } from "./markdown-description";
import { plainToMarkdownLiteral } from "./plain-to-markdown";
import styles from "./description-field.module.css";

const ClientEditor = dynamic(() => import("./mdx-client-editor").then(module => module.MdxClientEditor), {
  ssr: false,
  loading: () => <p className={styles.loading} role="status">Markdown 편집기를 불러오는 중…</p>,
});

interface Props {
  id: string;
  label: string;
  value: string;
  format: DescriptionFormat;
  maxLength: number;
  identity: string;
  disabled: boolean;
  readOnly?: boolean;
  onChange: (value: string, format: DescriptionFormat) => void;
}

/** One editor for both Project Issue and Task; plain values stay literal until explicit conversion. */
export function DescriptionField({ id, label, value, format, maxLength, identity, disabled, readOnly = false, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const plain = format !== "markdown";
  return <div className={styles.container} id={id} role="group" aria-label={label} data-description-format={format}>
    {plain || readOnly ? <MarkdownDescription value={value} format={format} /> : <ClientEditor
      key={identity} markdown={value} disabled={disabled} onChange={next => {
        if (Array.from(next).length > maxLength) {
          setError("Description 길이 제한을 초과했습니다. 본문을 줄인 후 저장해 주세요.");
        } else setError(null);
        onChange(next, "markdown");
      }} onError={message => setError(message)} />}
    {plain && !readOnly && !disabled ? <button type="button" className="secondary-button" onClick={() => {
      onChange(plainToMarkdownLiteral(value), "markdown");
      setError(null);
    }}>Markdown 편집으로 전환</button> : null}
    <div className={styles.meta}>
      <span>{format === "markdown" ? "Markdown · 시각적 / 원문 전환" : "기존 일반 텍스트 · 원문 유지"}</span>
      <span>{Array.from(value).length.toLocaleString()} / {maxLength.toLocaleString()}</span>
    </div>
    {error ? <p role="alert" className={styles.error}>{error} 원문 모드에서 수정할 수 있습니다.</p> : null}
  </div>;
}
