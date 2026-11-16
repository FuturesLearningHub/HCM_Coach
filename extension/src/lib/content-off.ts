// Builds without live content use this file, so no network code is bundled.
import type { ContentPack } from "./data";
export const LIVE = false;
export type SyncResult = { status: "ok" | "unauthorized" | "offline" | "error"; pack?: ContentPack; message?: string };
export async function fetchContent(_code: string): Promise<SyncResult> { return { status: "error", message: "Live content is not part of this build." }; }
