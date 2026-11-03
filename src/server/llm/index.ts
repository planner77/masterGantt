import "server-only";

import { createLlmClient } from "./client-core";

/**
 * Explicit, Node.js server-only text call. No startup discovery or public endpoint.
 * Future business callers must first enforce the user's explicit request, Project
 * read authorization and minimum data scope; this module does not grant them.
 */
export const invokeLLM = createLlmClient(() => process.env);
export type { InvokeLlmInput, LlmMessage, LlmResult, LlmErrorCode } from "./types";
