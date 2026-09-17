"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function findProjectHeadingMetadataTarget(): HTMLElement | null {
  const heading = document.querySelector(".project-readonly-heading");
  const target = heading?.firstElementChild;
  return target instanceof HTMLElement ? target : null;
}

export function ProjectOwnerDisplay({ ownerName }: Readonly<{ ownerName: string }>) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const resolveTarget = () => {
      const next = findProjectHeadingMetadataTarget();
      setPortalTarget((current) => current === next ? current : next);
    };

    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <p className="page-description"><strong>소유자:</strong> {ownerName}</p>,
    portalTarget,
  );
}
