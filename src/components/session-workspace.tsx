"use client";

import Link from "next/link";
import { Download, GitBranch, Loader2, Map as MapIcon, MessageCircle, MoreHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CognitiveFunction, ConversationEvent, SessionBundle, ThoughtNode } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { SessionNav } from "@/components/session-nav";
import { ThoughtMap } from "@/components/thought-map";
import { AssistantComposer } from "@/components/assistant-composer";

const functionNames: Record<CognitiveFunction, string> = {
  facilitate: "引导", mirror: "镜像", clarify: "澄清", distinguish: "区分", ground: "经验",
  challenge: "挑战", extend: "延展", connect: "连接", reformulate: "重述", record: "记录",
};
const phaseNames: Record<SessionBundle["session"]["phase"], string> = {
  expressing: "表达中", clarifying: "澄清中", differentiating: "区分中", grounding: "落地中",
  testing: "检验中", expanding: "展开中", reformulating: "重述中", reflecting: "回看中",
};

function eventIsUser(event: ConversationEvent) {
  return event.type.startsWith("user");
}
function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function DecisionActions({ node, sessionId, onDone }: { node: ThoughtNode; sessionId: string; onDone: (bundle: SessionBundle) => void }) {
  const [busy, setBusy] = useState(false);
  async function decide(action: "accept" | "partial" | "misunderstood" | "candidate" | "reject") {
    setBusy(true);
    const response = await fetch("/api/sessions/" + sessionId + "/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodeId: node.id, action }) });
    setBusy(false);
    if (response.ok) onDone((await response.json() as { bundle: SessionBundle }).bundle);
  }
  return <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3"><Button size="sm" variant="primary" onClick={() => void decide("accept")} disabled={busy}>准确表达了我</Button><Button size="sm" onClick={() => void decide("partial")} disabled={busy}>部分准确</Button><Button size="sm" onClick={() => void decide("misunderstood")} disabled={busy}>误解了我</Button><Button size="sm" onClick={() => void decide("candidate")} disabled={busy}>先作为候选</Button><Button size="sm" variant="ghost" onClick={() => void decide("reject")} disabled={busy}>拒绝</Button></div>;
}

function MessageCard({ event, node, sessionId, onDone }: { event: ConversationEvent; node?: ThoughtNode; sessionId: string; onDone: (bundle: SessionBundle) => void }) {
  const user = eventIsUser(event);
  return <div className={"flex " + (user ? "justify-end" : "justify-start")}>
    <div className={"max-w-[86%] " + (user ? "items-end" : "items-start")}>
      <div className="mb-1 flex items-center gap-2 px-1 text-[10px] text-[var(--muted)]"><span>{user ? "你" : functionNames[event.cognitiveFunction ?? "facilitate"]}</span><span>{formatTime(event.createdAt)}</span>{!user && <span className="rounded-full bg-[var(--candidate-bg)] px-1.5 py-0.5 text-[var(--candidate)]">候选</span>}</div>
      <div className={"rounded-2xl px-4 py-3 text-sm leading-7 " + (user ? "rounded-tr-sm bg-[var(--ink)] text-[var(--paper)]" : "rounded-tl-sm border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)]")}>{event.content}</div>
      {!user && node && (node.epistemicStatus === "ai_proposal" || node.epistemicStatus === "ai_interpretation") && <DecisionActions node={node} sessionId={sessionId} onDone={onDone} />}
    </div>
  </div>;
}

export function SessionWorkspace({ id }: { id: string }) {
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [requestedFunction, setRequestedFunction] = useState<CognitiveFunction | "">("");
  const [isSending, setIsSending] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/sessions/" + id, { cache: "no-store" }).then(async (response) => ({ ok: response.ok, data: await response.json() as SessionBundle | { error?: string } })).then(({ ok, data }) => { if (!active) return; if (ok) setBundle(data as SessionBundle); else setError((data as { error?: string }).error ?? "这个思想会话不存在。"); }).catch(() => { if (active) setError("无法连接到本地数据库。"); });
    return () => { active = false; };
  }, [id]);

  const nodeByEvent = useMemo(() => new globalThis.Map(bundle?.nodes.flatMap((node) => node.sourceEventIds.map((eventId) => [eventId, node] as const)) ?? []), [bundle]);
  const accepted = bundle?.nodes.filter((node) => node.epistemicStatus === "user_accepted") ?? [];
  const candidates = bundle?.nodes.filter((node) => node.epistemicStatus === "ai_proposal" || node.epistemicStatus === "ai_interpretation") ?? [];
  const openQuestions = bundle?.nodes.filter((node) => node.type === "open_question" && node.epistemicStatus !== "user_rejected") ?? [];

  async function send(messageText: string) {
    if (!messageText.trim() || isSending) return;
    setIsSending(true); setError("");
    const response = await fetch("/api/sessions/" + id + "/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: messageText, requestedFunction: requestedFunction || null }) });
    if (response.ok) setBundle((await response.json() as { bundle: SessionBundle }).bundle);
    else setError(((await response.json() as { error?: string }).error) ?? "这次介入没有完成");
    setIsSending(false);
  }

  if (error && !bundle) return <main className="flex min-h-screen items-center justify-center p-6 text-sm text-[var(--danger)]">{error}</main>;
  if (!bundle) return <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]"><Loader2 className="mr-2 animate-spin" size={16} />正在打开思想…</main>;
  return <div className="app-grid">
    <SessionNav />
    <main className="flex min-h-screen min-w-0 flex-col bg-[var(--paper)]">
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--line)] px-6">
        <div><div className="flex items-center gap-3"><h1 className="max-w-[45vw] truncate text-sm font-semibold">{bundle.session.title}</h1><span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] text-[var(--accent)]">{phaseNames[bundle.session.phase]}</span></div><p className="mt-1 text-[10px] text-[var(--muted)]">默认模式 · 每次只推进一个关键问题</p></div>
        <div className="flex items-center gap-1"><Button size="icon" variant="ghost" onClick={() => setShowMap((value) => !value)} aria-label="切换思想地图"><MapIcon size={16} /></Button><Button size="icon" variant="ghost" aria-label="更多操作"><MoreHorizontal size={16} /></Button></div>
      </header>
      <div className="scrollbar flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-7">
          {bundle.events.length === 0 ? <div className="py-20 text-center"><Sparkles className="mx-auto mb-4 text-[var(--accent)]" size={22} /><h2 className="text-lg font-semibold">从一个还没想清楚的地方开始</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">可以是一句直觉、一个反复出现的问题，或一段最近的经历。不需要先把它说完整。</p></div> : bundle.events.map((event) => <MessageCard key={event.id} event={event} node={nodeByEvent.get(event.id)} sessionId={id} onDone={setBundle} />)}
          {isSending && <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><span className="flex gap-1"><i className="size-1.5 animate-pulse rounded-full bg-[var(--accent)]" /><i className="size-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:150ms]" /><i className="size-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:300ms]" /></span>正在形成一次短介入…</div>}
        </div>
      </div>
      <div className="border-t border-[var(--line)] bg-[var(--surface)] px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {error && <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>}
          <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><select value={requestedFunction} onChange={(event) => setRequestedFunction(event.target.value as CognitiveFunction | "")} className="rounded-md border border-[var(--line)] bg-transparent px-2 py-1.5 text-xs text-[var(--muted)] outline-none"><option value="">自动选择认知功能</option>{(Object.keys(functionNames) as CognitiveFunction[]).map((key) => <option key={key} value={key}>@{functionNames[key]}</option>)}</select><button className="text-[10px] text-[var(--muted)] hover:text-[var(--accent)]" type="button" onClick={() => setRequestedFunction("")}>清除点名</button></div><span className="text-[10px] text-[var(--muted)]">演示模式 · 不访问外部网络</span></div>
          <AssistantComposer onSend={send} disabled={isSending} />
          <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted)]"><span className="flex items-center gap-1"><MessageCircle size={12} />你是思想的最终解释者</span><button type="button" className="flex items-center gap-1 hover:text-[var(--ink)]" onClick={() => { window.open("/api/sessions/" + id + "/export?format=md", "_self"); }}><Download size={12} />导出 Markdown</button></div>
        </div>
      </div>
    </main>
    <aside className="right-panel min-h-screen overflow-y-auto p-5">
      {showMap ? <div><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">思想地图</p><p className="mt-1 text-xs text-[var(--muted)]">{bundle.nodes.length} 个节点 · {bundle.edges.length} 条关系</p></div><Button size="sm" variant="ghost" onClick={() => setShowMap(false)}>返回当前思想</Button></div><ThoughtMap nodes={bundle.nodes} edges={bundle.edges} /></div> : <div><div className="mb-6 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">思想演化</p><p className="mt-1 text-xs text-[var(--muted)]">不是结论，是正在形成的结构</p></div><GitBranch size={16} className="text-[var(--accent)]" /></div><section className="mb-6"><h2 className="text-xs font-semibold text-[var(--muted)]">最初直觉</h2><p className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm leading-6">{bundle.session.originalIntent ?? "尚未记录"}</p></section><section className="mb-6"><h2 className="text-xs font-semibold text-[var(--muted)]">用户已接受的观点 <span className="ml-1 text-[var(--accent)]">{accepted.length}</span></h2>{accepted.length ? <div className="mt-2 space-y-2">{accepted.map((node) => <p key={node.id} className="rounded-xl border border-[#c7decf] bg-[var(--accent-soft)] p-3 text-sm leading-6">{node.content}</p>)}</div> : <p className="mt-2 text-xs text-[var(--muted)]">确认一个候选表达后，它会出现在这里。</p>}</section><section className="mb-6"><h2 className="text-xs font-semibold text-[var(--muted)]">候选观点 <span className="ml-1 text-[var(--candidate)]">{candidates.length}</span></h2>{candidates.length ? <div className="mt-2 space-y-2">{candidates.slice(-3).map((node) => <p key={node.id} className="rounded-xl border border-[#ead8bf] bg-[var(--candidate-bg)] p-3 text-sm leading-6">{node.content}</p>)}</div> : <p className="mt-2 text-xs text-[var(--muted)]">AI 的理解会停留在候选状态。</p>}</section><section><h2 className="text-xs font-semibold text-[var(--muted)]">尚未解决的问题 <span className="ml-1 text-[var(--accent)]">{openQuestions.length}</span></h2>{openQuestions.length ? <div className="mt-2 space-y-2">{openQuestions.slice(-3).map((node) => <p key={node.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm leading-6">{node.content}</p>)}</div> : <p className="mt-2 text-xs text-[var(--muted)]">对话会在需要时留下问题。</p>}</section><button type="button" className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] py-2.5 text-xs text-[var(--muted)] hover:bg-[var(--surface)]" onClick={() => setShowMap(true)}><MapIcon size={14} />打开思想地图</button></div>}
    </aside>
  </div>;
}
