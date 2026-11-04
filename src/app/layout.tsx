import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { WorkspaceShell } from "@/components/workspace-shell";
import { I18nProvider } from "@/lib/i18n/provider";

export const metadata: Metadata = {
  title: "masterGantt",
  description: "프로젝트 일정과 진행 상황을 관리하는 작업 공간입니다.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <I18nProvider><WorkspaceShell>{children}</WorkspaceShell></I18nProvider>
      </body>
    </html>
  );
}
