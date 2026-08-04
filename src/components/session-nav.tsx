"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Archive, ChevronRight, Plus, Search, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ThoughtSession } from "@/domain/types";
import { Button } from "@/components/ui/button";

export function SessionNav({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname(); const router = useRouter();
  const [sessions, setSessions] = useState<ThoughtSession[]>([]); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(false); const [showArchived, setShowArchived] = useState(false);
  useEffect(() => { let active = true; fetch("/api/sessions", { cache: "no-store" }).then((response) => response.json() as Promise<{ sessions: ThoughtSession[] }>).then((data) => { if (active) setSessions(data.sessions); }).catch(() => undefined); return () => { active = false; }; }, [pathname]);
  async function create() { setLoading(true); const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); setLoading(false); if (!response.ok) return; const data = await response.json() as { session: ThoughtSession }; onClose?.(); router.push("/app/session/" + data.session.id); }
  const visible = sessions.filter((session) => (showArchived || session.status !== "archived") && session.title.toLowerCase().includes(query.toLowerCase()));
  return <aside className={`sidebar flex min-h-screen flex-col ${open ? "mobile-open" : ""}`}>
    <div className="flex items-center justify-between px-4 py-5"><Link href="/" onClick={onClose} className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-7 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--paper)] text-xs">思</span>思想孵化器</Link><div className="flex items-center gap-2"><Link href="/settings/providers" onClick={onClose} aria-label="打开设置" className="text-[var(--muted)] hover:text-[var(--ink)]"><Settings2 size={16} /></Link>{onClose && <button type="button" onClick={onClose} aria-label="关闭会话导航" className="mobile-only text-[var(--muted)]"><X size={16} /></button>}</div></div>
    <div className="px-3"><Button className="w-full justify-between" variant="primary" onClick={() => void create()} disabled={loading}><span className="flex items-center gap-2"><Plus size={16} />新建思想</span><span className="text-xs opacity-60">⌘ N</span></Button></div>
    <div className="mt-5 px-3"><label className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--muted)]"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索思想" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted)]" /></label></div>
    <button type="button" onClick={() => setShowArchived((value) => !value)} className="mt-5 flex items-center justify-between px-4 text-left text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--muted)] hover:text-[var(--ink)]"><span>{showArchived ? "全部思想" : "最近思想"}</span><Archive size={13} /></button>
    <nav className="scrollbar mt-2 flex-1 overflow-y-auto px-2">{visible.length === 0 ? <p className="px-3 py-8 text-xs leading-5 text-[var(--muted)]">还没有思想。<br />从一个模糊的念头开始。</p> : visible.map((session) => { const active = pathname.includes(session.id); return <Link key={session.id} href={`/app/session/${session.id}`} onClick={onClose} className={`group mb-1 flex items-center justify-between rounded-lg px-3 py-3 text-sm transition ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-soft)] hover:bg-[var(--surface)]"}`}><span className="min-w-0 truncate">{session.title}</span><ChevronRight size={13} className={`shrink-0 opacity-0 transition group-hover:opacity-60 ${active ? "opacity-60" : ""}`} /></Link>; })}</nav>
    <div className="border-t border-[var(--line)] px-4 py-4 text-[10px] leading-5 text-[var(--muted)]">本地优先 · {sessions.some((session) => session.status !== "archived") ? "可用模型由设置决定" : "等待第一个思想"}<br />数据保存在本机 data/</div>
  </aside>;
}
