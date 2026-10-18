import type { ReactNode } from "react";
import styles from "./admin-auth.module.css";

/** Presentation only: each administrator keeps its own form and session logic. */
export function AdminAuth({ title, description, titleId, children }: {
  title: string; description: string; titleId: string; children: ReactNode;
}) {
  return <section className={`admin-auth ${styles.card}`} aria-labelledby={titleId}>
    <div className={styles.heading}>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
    </div>
    {children}
  </section>;
}

export { styles as adminAuthStyles };
