"use client";

import { AssistantRuntimeProvider, ComposerPrimitive, useExternalStoreRuntime } from "@assistant-ui/react";
import type { ThreadMessage } from "@assistant-ui/react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AssistantComposer({ onSend, disabled }: { onSend: (text: string) => Promise<void>; disabled?: boolean }) {
  const runtime = useExternalStoreRuntime<ThreadMessage>({
    messages: [],
    isSendDisabled: disabled,
    onNew: async (message) => {
      const text = message.content.filter((part) => part.type === "text").map((part) => part.text).join("");
      if (text.trim()) await onSend(text);
    },
  });
  return <AssistantRuntimeProvider runtime={runtime}>
    <ComposerPrimitive.Root className="flex items-end gap-3 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)] p-3 shadow-sm focus-within:border-[var(--accent)]">
      <ComposerPrimitive.Input submitMode="ctrlEnter" placeholder="继续说下去……（⌘/Ctrl + Enter 发送）" rows={3} className="min-h-[70px] flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-[var(--muted)]" />
      <ComposerPrimitive.Send asChild><Button size="icon" variant="primary" aria-label="发送"><Send size={16} /></Button></ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  </AssistantRuntimeProvider>;
}
