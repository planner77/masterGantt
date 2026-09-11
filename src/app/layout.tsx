import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: {
    default: "masterGantt | 프로젝트 일정 관리",
    template: "%s | masterGantt",
  },
  description: "프로젝트 일정과 진행 상황을 관리하는 작업 공간입니다.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <WorkspaceShell>{children}</WorkspaceShell>
      </body>
    </html>
  );
}
