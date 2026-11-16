// Live content: downloads the current guides, contacts, rubrics and job aids from one fixed address.
// It sends only the access code. Nothing about the person or what they are doing is sent.
import { CONTENT_URL } from "../generated/content";
import type { ContentPack } from "./data";

export const LIVE = true;
export type SyncResult = { status: "ok" | "unauthorized" | "offline" | "error"; pack?: ContentPack; message?: string };

export async function fetchContent(code: string): Promise<SyncResult> {
  try {
    const res = await fetch(`${CONTENT_URL}/api/content`, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", headers: { "x-hcm-coach-code": code } });
    if (res.status === 401) return { status: "unauthorized", message: "That access code is not right." };
    if (!res.ok) return { status: "error", message: "The content service is not available right now." };
    return { status: "ok", pack: (await res.json()) as ContentPack };
  } catch {
    return { status: "offline", message: "Could not reach the content service. Using the copy already on this computer." };
  }
}
