"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, GitBranch, Loader2, Map as MapIcon, Menu, MessageCircle, MoreHorizontal, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isOpenQuestionResolved } from "@/domain/protocol";
import type { CognitiveFunction, ConversationEvent, SessionBundle, ThoughtNode } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { SessionNav } from "@/components/session-nav";
import { ThoughtMap } from "@/components/thought-map";
import { AssistantComposer } from "@/components/assistant-composer";

const functionNames: Record<CognitiveFunction, string> = { facilitate: "引导", mirror: "镜像", clarify: "澄清", distinguish: "区分", ground: "经验", challenge: "挑战", extend: "延展", connect: "连接", reformulate: "重述", record: "记录" };
const phaseNames: Record<SessionBundle["session"]["phase"], string> = { expressing: "表达中", clarifying: "澄清中", differentiating: "区分中", grounding: "落地中", testing: "检验中", expanding: "展开中", reformulating: "重述中", reflecting: "回看中" };
const nodeLabels: Record<ThoughtNode["type"], string> = { original_expression: "表达", answer: "回答", candidate_interpretation: "候选", distinction: "区分", example: "例子", counterexample: "反例", evidence: "证据", accepted_claim: "已接受", rejected_claim: "已拒绝", open_question: "问题", revision: "修订", temporary_summary: "摘要" };

function formatTime(timestamp: number) { return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(timestamp); }
function eventIsUser(event: ConversationEvent) { return event.actor === "user"; }

function DecisionActions({ node, sessionId, onDone }: { node: ThoughtNode; sessionId: string; onDone: (bundle: SessionBundle) => void }) {
  const [content, setContent] = useState(node.content);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(action: "accept" | "partial" | "misunderstood" | "candidate" | "reject") {
    if ((action === "partial" || action === "misunderstood") && !note.trim()) { setError("请写下你的修改或原因"); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodeId: node.id, action, note: note.trim() || undefined, content: content.trim() || undefined }) });
      const data = await response.json() as { bundle?: SessionBundle; error?: string };
      if (!response.ok || !data.bundle) { setError(data.error ?? "状态更新失败"); return; }
      onDone(data.bundle);
    } finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
    <label className="block text-[10px] text-[var(--muted)]">确认前可编辑最终措辞<textarea value={content} onChange={(event) => setContent(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-xs leading-5 outline-none focus:border-[var(--accent)]" /></label>
    <label className="block text-[10px] text-[var(--muted)]">部分接受或误解时写下修改/原因<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="这句话哪里需要改？" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-xs leading-5 outline-none focus:border-[var(--accent)]" /></label>
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={() => void decide("accept")} disabled={busy}>准确表达了我</Button><Button size="sm" onClick={() => void decide("partial")} disabled={busy}>部分准确</Button><Button size="sm" onClick={() => void decide("misunderstood")} disabled={busy}>误解了我</Button><Button size="sm" onClick={() => void decide("candidate")} disabled={busy}>保留候选</Button><Button size="sm" variant="ghost" onClick={() => void decide("reject")} disabled={busy}>拒绝</Button></div>
    {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
  </div>;
}

function MessageCard({ event, node, sessionId, onDone }: { event: ConversationEvent; node?: ThoughtNode; sessionId: string; onDone: (bundle: SessionBundle) => void }) {
  const user = eventIsUser(event);
  const confirmable = Boolean(node?.confirmable && event.confirmable);
  return <div className={`flex ${user ? "justify-end" : "justify-start"}`}>
    <div className="max-w-[88%]">
      <div className="mb-1 flex items-center gap-2 px-1 text-[10px] text-[var(--muted)]"><span>{user ? "你" : functionNames[event.cognitiveFunction ?? "facilitate"]}</span><span>{formatTime(event.createdAt)}</span>{!user && <span className="rounded-full bg-[var(--candidate-bg)] px-1.5 py-0.5 text-[var(--candidate)]">{confirmable ? "候选表达" : node ? nodeLabels[node.type] : "介入"}</span>}</div>
      <div className={`rounded-2xl px-4 py-3 text-sm leading-7 ${user ? "rounded-tr-sm bg-[var(--ink)] text-[var(--paper)]" : "rounded-tl-sm border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)]"}`}>{event.content}</div>
      {confirmable && node && <DecisionActions node={node} sessionId={sessionId} onDone={onDone} />}
    </div>
  </div>;
}

type StreamResult = { bundle: SessionBundle; mode: "mock" | "real"; providerId: string; modelId: string | null; modelConfigId?: string | null };
type StreamError = { code?: string; message?: string };
type StreamEvent = { type: "start"; mode: "mock" | "real"; providerId: string; modelId: string | null; modelConfigId?: string } | { type: "delta"; value: string } | { type: "done"; result: StreamResult } | { type: "error"; error: string | StreamError };

export function SessionWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [requestedFunction, setRequestedFunction] = useState<CognitiveFunction | "">("");
  const [isSending, setIsSending] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [error, setError] = useState("");
  const [streamText, setStreamText] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  const [retryRequestId, setRetryRequestId] = useState<string | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<"mock" | "real" | "unknown">("unknown");
  const [runtimeProvider, setRuntimeProvider] = useState("");
  const [runtimeModel, setRuntimeModel] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const response = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
    const data = await response.json() as SessionBundle | { error?: string };
    if (response.ok) setBundle(data as SessionBundle); else setError((data as { error?: string }).error ?? "这个思想会话不存在。");
  }
  useEffect(() => { let active = true; void fetch(`/api/sessions/${id}`, { cache: "no-store" }).then(async (response) => ({ ok: response.ok, data: await response.json() as SessionBundle | { error?: string } })).then(({ ok, data }) => { if (!active) return; if (ok) setBundle(data as SessionBundle); else setError((data as { error?: string }).error ?? "这个思想会话不存在。"); }).catch(() => { if (active) setError("无法连接到本地数据库。"); }); return () => { active = false; }; }, [id]);
  useEffect(() => { function onKeyDown(event: KeyboardEvent) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") { event.preventDefault(); router.push("/app"); } } window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [router]);

  const nodeByEvent = useMemo(() => new Map(bundle?.nodes.flatMap((node) => node.sourceEventIds.map((eventId) => [eventId, node] as const)) ?? []), [bundle]);
  const accepted = bundle?.nodes.filter((node) => node.epistemicStatus === "user_accepted") ?? [];
  const candidates = bundle?.nodes.filter((node) => node.confirmable && node.epistemicStatus === "ai_proposal" && node.candidateReviewStatus === "pending") ?? [];
  const openQuestions = bundle?.nodes.filter((node) => node.type === "open_question" && node.epistemicStatus !== "user_rejected" && !isOpenQuestionResolved(bundle, node.id)) ?? [];

  async function send(messageText: string, existingRequestId?: string) {
    if (!messageText.trim() || isSending) return;
    const clientRequestId = existingRequestId ?? crypto.randomUUID();
    setIsSending(true); setError(""); setStreamText(""); setPendingUser(messageText); setRetryText(null); setRetryRequestId(null);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const response = await fetch(`/api/sessions/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ text: messageText, requestedFunction: requestedFunction || null, clientRequestId }), signal: controller.signal });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("text/event-stream")) { const data = await response.json().catch(() => ({})) as { message?: string; error?: string; code?: string }; throw new Error(data.message ?? data.error ?? `请求失败${data.code ? `（${data.code}）` : ""}`); }
      if (!response.body) throw new Error("没有收到流式响应");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      const handleFrame = (frame: string) => {
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!data) return;
        const event = JSON.parse(data) as StreamEvent;
        if (event.type === "start") { setRuntimeMode(event.mode); setRuntimeProvider(event.providerId); setRuntimeModel(event.modelId ?? ""); }
        if (event.type === "delta") setStreamText((value) => value + event.value);
        if (event.type === "error") throw new Error(typeof event.error === "string" ? event.error : event.error.message ?? event.error.code ?? "消息处理失败");
        if (event.type === "done") { setBundle(event.result.bundle); setRuntimeMode(event.result.mode); setRuntimeProvider(event.result.providerId); setRuntimeModel(event.result.modelId ?? ""); setStreamText(""); }
      };
      while (true) {
        const read = await reader.read(); if (read.done) break; buffer += decoder.decode(read.value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/); buffer = frames.pop() ?? ""; frames.forEach(handleFrame);
      }
      if (buffer.trim()) handleFrame(buffer);
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === "AbortError" ? "已停止生成；这次表达可以安全重试。" : caught instanceof Error ? caught.message : "这次介入没有完成";
      setError(message); setRetryText(messageText); setRetryRequestId(clientRequestId); await load().catch(() => undefined);
    } finally { abortRef.current = null; setIsSending(false); setPendingUser(null); }
  }
  function stop() { abortRef.current?.abort(); }
  async function archive() { const response = await fetch(`/api/sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) }); if (response.ok) router.push("/app"); else setError("归档失败"); }
  async function remove() { if (!window.confirm("删除这个思想会话及其本地数据？")) return; await fetch(`/api/sessions/${id}`, { method: "DELETE" }); router.push("/app"); }
  async function importJson(file: File) { try { const response = await fetch(`/api/sessions/${id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text() }); const data = await response.json() as { bundle?: SessionBundle; error?: string }; if (!response.ok || !data.bundle) throw new Error(data.error ?? "导入失败"); router.push(`/app/session/${data.bundle.session.id}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "导入失败"); } }
  async function focusNode(nodeId: string) { const response = await fetch(`/api/sessions/${id}/focus`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodeId }) }); if (response.ok) setBundle((await response.json() as { bundle: SessionBundle }).bundle); }

  if (error && !bundle) return <main className="flex min-h-screen items-center justify-center p-6 text-sm text-[var(--danger)]">{error}</main>;
  if (!bundle) return <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]"><Loader2 className="mr-2 animate-spin" size={16} />正在打开思想…</main>;
  const modeLabel = runtimeMode === "real" ? "真实模型" : runtimeMode === "mock" ? "本地 Mock" : "尚未生成";
  const runtimeLabel = runtimeProvider && runtimeModel ? `${runtimeProvider} / ${runtimeModel}` : runtimeProvider || "未解析模型";
  const events = bundle.events.slice();
  return <div className="app-grid">
    <SessionNav open={showNav} onClose={() => setShowNav(false)} />
    <main className="flex min-h-screen min-w-0 flex-col bg-[var(--paper)]">
      <header className="relative flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--line)] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><Button size="icon" variant="ghost" className="mobile-only" onClick={() => setShowNav(true)} aria-label="打开会话导航"><Menu size={17} /></Button><div className="min-w-0"><div className="flex items-center gap-3"><h1 className="max-w-[45vw] truncate text-sm font-semibold">{bundle.session.title}</h1><span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] text-[var(--accent)]">{phaseNames[bundle.session.phase]}</span></div><p className="mt-1 text-[10px] text-[var(--muted)]">{modeLabel} · 每次只推进一个关键问题</p></div></div>
        <div className="flex items-center gap-1"><Button size="icon" variant="ghost" onClick={() => setShowMap((value) => !value)} aria-label="切换思想地图"><MapIcon size={16} /></Button><Button size="icon" variant="ghost" onClick={() => setShowMenu((value) => !value)} aria-label="更多操作"><MoreHorizontal size={16} /></Button>{showMenu && <div className="absolute right-4 top-14 z-20 w-44 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-1 text-xs shadow-lg"><Link className="block rounded-lg px-3 py-2 hover:bg-[var(--accent-soft)]" href={`/api/sessions/${id}/export?format=json`}>导出 JSON</Link><button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--accent-soft)]" onClick={() => importRef.current?.click()}><Upload size={12} className="mr-2 inline" />导入 JSON</button><button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--accent-soft)]" onClick={() => void archive()}>归档</button><button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-[var(--danger)] hover:bg-[var(--danger-bg)]" onClick={() => void remove()}>删除</button></div>}<input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJson(file); event.target.value = ""; }} /></div>
      </header>
      <div className="scrollbar flex-1 overflow-y-auto px-4 py-8 sm:px-6"><div className="mx-auto max-w-3xl space-y-7">
        {events.length === 0 && !pendingUser ? <div className="py-20 text-center"><Sparkles className="mx-auto mb-4 text-[var(--accent)]" size={22} /><h2 className="text-lg font-semibold">从一个还没想清楚的地方开始</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">可以是一句直觉、一个反复出现的问题，或一段最近的经历。不需要先把它说完整。</p></div> : events.map((event) => <MessageCard key={event.id} event={event} node={nodeByEvent.get(event.id)} sessionId={id} onDone={setBundle} />)}
        {pendingUser && <div className="flex justify-end"><div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-[var(--ink)] px-4 py-3 text-sm leading-7 text-[var(--paper)]">{pendingUser}</div></div>}
        {isSending && <div className="flex items-start gap-2 text-xs text-[var(--muted)]"><span className="mt-1 flex gap-1"><i className="size-1.5 animate-pulse rounded-full bg-[var(--accent)]" /><i className="size-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:150ms]" /><i className="size-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:300ms]" /></span><span>{streamText || "正在形成一次短介入…"}</span></div>}
      </div></div>
      <div className="border-t border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:px-6"><div className="mx-auto max-w-3xl">{error && <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>}{retryText && retryRequestId && <Button size="sm" variant="secondary" className="mb-2" onClick={() => void send(retryText, retryRequestId)}>用同一条表达重试</Button>}<div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><select aria-label="选择认知功能" value={requestedFunction} onChange={(event) => setRequestedFunction(event.target.value as CognitiveFunction | "")} className="max-w-[180px] rounded-md border border-[var(--line)] bg-transparent px-2 py-1.5 text-xs text-[var(--muted)] outline-none"><option value="">自动选择认知功能</option>{(Object.keys(functionNames) as CognitiveFunction[]).map((key) => <option key={key} value={key}>@{functionNames[key]}</option>)}</select></div><span className="text-right text-[10px] text-[var(--muted)]">{modeLabel} · {runtimeLabel}</span></div><AssistantComposer onSend={send} onStop={stop} disabled={isSending} /><div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted)]"><span className="flex items-center gap-1"><MessageCircle size={12} />你是思想的最终解释者</span><a className="flex items-center gap-1 hover:text-[var(--ink)]" href={`/api/sessions/${id}/export?format=md`}><Download size={12} />导出 Markdown</a></div></div></div>
    </main>
    <aside className="right-panel min-h-screen overflow-y-auto p-5">{showMap ? <MapPanel bundle={bundle} onBack={() => setShowMap(false)} onFocusNode={(nodeId) => void focusNode(nodeId)} onRequestFunction={(name) => { setRequestedFunction(name); setShowMap(false); }} /> : <InsightPanel bundle={bundle} accepted={accepted} candidates={candidates} openQuestions={openQuestions} onMap={() => setShowMap(true)} />}</aside>
    {showMap && <div className="map-overlay"><MapPanel bundle={bundle} onBack={() => setShowMap(false)} onFocusNode={(nodeId) => void focusNode(nodeId)} onRequestFunction={(name) => { setRequestedFunction(name); setShowMap(false); }} /></div>}
  </div>;
}

function MapPanel({ bundle, onBack, onFocusNode, onRequestFunction }: { bundle: SessionBundle; onBack: () => void; onFocusNode: (nodeId: string) => void; onRequestFunction: (name: CognitiveFunction) => void }) {
  const [selectedId, setSelectedId] = useState(bundle.session.currentFocusNodeId);
  const selected = bundle.nodes.find((node) => node.id === selectedId);
  function select(nodeId: string) { setSelectedId(nodeId); onFocusNode(nodeId); }
  return <div><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">思想地图</p><p className="mt-1 text-xs text-[var(--muted)]">{bundle.nodes.length} 个节点 · {bundle.edges.length} 条关系</p></div><Button size="sm" variant="ghost" onClick={onBack}>返回当前思想</Button></div><ThoughtMap nodes={bundle.nodes} edges={bundle.edges} currentFocusNodeId={bundle.session.currentFocusNodeId} onFocusNode={select} />{selected && <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><p className="text-[10px] font-semibold text-[var(--muted)]">{nodeLabels[selected.type]} · 当前焦点</p><p className="mt-2 text-xs leading-5">{selected.content}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => onRequestFunction("clarify")}>请求澄清</Button><Button size="sm" onClick={() => onRequestFunction("challenge")}>请求挑战</Button><Button size="sm" onClick={() => onRequestFunction("extend")}>请求延展</Button><Button size="sm" onClick={() => onRequestFunction("reformulate")}>请求重述</Button></div></div>}<p className="mt-2 text-[10px] text-[var(--muted)]">点击节点可将它设为当前焦点，并从这里指定下一项认知功能。</p></div>;
}
function InsightPanel({ bundle, accepted, candidates, openQuestions, onMap }: { bundle: SessionBundle; accepted: ThoughtNode[]; candidates: ThoughtNode[]; openQuestions: ThoughtNode[]; onMap: () => void }) { return <div><div className="mb-6 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">思想演化</p><p className="mt-1 text-xs text-[var(--muted)]">不是结论，是正在形成的结构</p></div><GitBranch size={16} className="text-[var(--accent)]" /></div><section className="mb-6"><h2 className="text-xs font-semibold text-[var(--muted)]">最初直觉</h2><p className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm leading-6">{bundle.session.originalIntent ?? "尚未记录"}</p></section><section className="mb-6"><h2 className="text-xs font-semibold text-[var(--muted)]">用户已接受的观点 <span className="ml-1 text-[var(--accent)]">{accepted.length}</span></h2>{accepted.length ? <div className="mt-2 space-y-2">{accepted.map((node) => <p key={node.id} className="rounded-xl border border-[var(--accepted-line)] bg-[var(--accent-soft)] p-3 text-sm leading-6">{node.content}</p>)}</div> : <p className="mt-2 text-xs text-[var(--muted)]">确认一个候选表达后，它会出现在这里。</p>}</section><section className="mb-6"><h2 className="text-xs font-semibold text-[var(--muted)]">候选观点 <span className="ml-1 text-[var(--candidate)]">{candidates.length}</span></h2>{candidates.length ? <div className="mt-2 space-y-2">{candidates.slice(-3).map((node) => <p key={node.id} className="rounded-xl border border-[var(--candidate)]/35 bg-[var(--candidate-bg)] p-3 text-sm leading-6">{node.content}</p>)}</div> : <p className="mt-2 text-xs text-[var(--muted)]">AI 的理解会停留在候选状态。</p>}</section><section><h2 className="text-xs font-semibold text-[var(--muted)]">尚未解决的问题 <span className="ml-1 text-[var(--accent)]">{openQuestions.length}</span></h2>{openQuestions.length ? <div className="mt-2 space-y-2">{openQuestions.slice(-3).map((node) => <p key={node.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm leading-6">{node.content}</p>)}</div> : <p className="mt-2 text-xs text-[var(--muted)]">对话会在需要时留下问题。</p>}</section><button type="button" className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] py-2.5 text-xs text-[var(--muted)] hover:bg-[var(--surface)]" onClick={onMap}><MapIcon size={14} />打开思想地图</button></div>; }
