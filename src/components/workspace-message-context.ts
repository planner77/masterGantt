"use client";

import { createContext } from "react";

// Native modal이 열리면 바깥 live region은 inert가 된다. 같은 안전한 안내를
// top layer 안에서 전달하되 알림 API 객체와 Gantt 수명에는 영향을 주지 않는다.
export const WorkspaceMessageContext = createContext("");
