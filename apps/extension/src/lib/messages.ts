import { ParsedPostingSchema, type ParsedPosting } from "@real-role/shared";
import { z } from "zod";

/** Messages the background worker accepts, validated (Chrome: treat content scripts as untrusted). */
export type ValidMessage =
  | { type: "posting-found"; tabId: number; posting: ParsedPosting }
  | { type: "no-posting"; tabId: number; url: string }
  | { type: "open-panel"; tabId: number }
  | { type: "check-tab"; tabId: number };

const MessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("posting-found"), posting: ParsedPostingSchema }),
  z.object({ type: z.literal("no-posting") }),
  z.object({ type: z.literal("open-panel") }),
  z.object({ type: z.literal("check-tab"), tabId: z.number().int().nonnegative() }),
]);

export interface SenderInfo {
  id?: string;
  url?: string;
  frameId?: number;
  tab?: { id?: number; url?: string };
}

/**
 * Who may send what:
 * - only this extension (other extensions and web pages are rejected);
 * - content scripts (top frame only) may report the posting on their own tab or open the panel,
 *   and the posting's URL must be the page they're running on;
 * - extension pages (the side panel) may ask to check a tab.
 */
export function validateMessage(
  raw: unknown,
  sender: SenderInfo,
  extensionId: string,
): ValidMessage | null {
  if (sender.id !== extensionId) return null;
  const parsed = MessageSchema.safeParse(raw);
  if (!parsed.success) return null;
  const message = parsed.data;

  const fromExtensionPage = sender.url?.startsWith(`chrome-extension://${extensionId}/`) ?? false;
  if (fromExtensionPage) {
    return message.type === "check-tab" ? message : null;
  }

  const tabId = sender.tab?.id;
  if (tabId === undefined || sender.frameId !== 0 || !sender.url) return null;
  // Chrome keeps sender.url at document creation after pushState. The browser-supplied
  // top-frame tab URL tracks SPA navigation; never accept a different document origin.
  const pageUrl = sender.tab?.url ?? sender.url;
  try {
    if (new URL(pageUrl).origin !== new URL(sender.url).origin) return null;
  } catch {
    return null;
  }
  switch (message.type) {
    case "posting-found":
      return message.posting.sourceUrl === pageUrl
        ? { type: "posting-found", tabId, posting: message.posting }
        : null;
    case "no-posting":
      return { type: "no-posting", tabId, url: pageUrl };
    case "open-panel":
      return { type: "open-panel", tabId };
    case "check-tab":
      return null; // content scripts can't steer the extension at other tabs
  }
}
