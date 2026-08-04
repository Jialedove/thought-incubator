"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AssistantComposer({ onSend, onStop, disabled }: { onSend: (text: string) => Promise<void>; onStop?: () => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!text.trim() || disabled) return;
    const value = text;
    setText("");
    await onSend(value);
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void submit(); }
  }
  return <form onSubmit={(event) => void submit(event)} className="flex items-end gap-3 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)] p-3 shadow-sm focus-within:border-[var(--accent)]">
    <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown} disabled={disabled} placeholder="继续说下去……（⌘/Ctrl + Enter 发送）" rows={3} className="min-h-[70px] flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-[var(--muted)]" />
    {disabled ? <Button type="button" size="icon" variant="ghost" onClick={onStop} aria-label="停止生成"><Square size={15} /></Button> : <Button type="submit" size="icon" variant="primary" aria-label="发送"><Send size={16} /></Button>}
  </form>;
}
