"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { DescriptionFormat } from "@/contracts/description-format";
import { MarkdownDescription } from "./markdown-description";
import { plainToMarkdownLiteral } from "./plain-to-markdown";
import { useI18n } from "@/lib/i18n/provider";
import { descriptionUi } from "./description-translations";
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
  const { locale } = useI18n();
  const ui = descriptionUi[locale];
  const [error, setError] = useState<string | null>(null);
  const plain = format !== "markdown";
  return <div className={styles.container} id={id} role="group" aria-label={label} data-description-format={format}>
    {plain || readOnly ? <MarkdownDescription value={value} format={format} /> : <ClientEditor
      key={identity} markdown={value} disabled={disabled} onChange={next => {
        if (Array.from(next).length > maxLength) {
          setError(ui.length);
        } else setError(null);
        onChange(next, "markdown");
      }} onError={message => setError(message)} />}
    {plain && !readOnly && !disabled ? <button type="button" className="secondary-button" onClick={() => {
      onChange(plainToMarkdownLiteral(value), "markdown");
      setError(null);
    }>{ui.convert}</button> : null}
    <div className={styles.meta}>
      <span>{format === "markdown" ? ui.markdown : ui.plain}</span>
      <span>{Array.from(value).length.toLocaleString()} / {maxLength.toLocaleString()}</span>
    </div>
    {error ? <p role="alert" className={styles.error}>{error} {ui.recover}</p> : null}
  </div>;
}
