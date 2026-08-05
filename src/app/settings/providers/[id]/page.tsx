"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ModelConfig, ProviderKind, SafeProviderConfig } from "@/domain/types";
import { Button } from "@/components/ui/button";

const kinds: Array<[ProviderKind, string]> = [["mock", "本地模拟模型"], ["openai", "OpenAI"], ["anthropic", "Anthropic"], ["google", "Google Generative AI"], ["openai-compatible", "OpenAI-compatible"]];
type ProviderForm = { name: string; kind: ProviderKind; baseUrl: string; apiKey: string; headersText: string; enabled: boolean; credentialAction: "keep" | "replace" | "clear" };
type DiscoveredModel = { modelId: string; displayName: string; capabilities: Record<string, boolean> };
const blank = (): ProviderForm => ({ name: "新的 Provider", kind: "mock", baseUrl: "", apiKey: "", headersText: "{}", enabled: true, credentialAction: "keep" });

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const isNew = id === "new";
  const [provider, setProvider] = useState<SafeProviderConfig | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredModel[]>([]);
  const [form, setForm] = useState<ProviderForm>(blank());
  const [manualModel, setManualModel] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (isNew) return;
    const [providerResponse, modelResponse] = await Promise.all([fetch("/api/providers", { cache: "no-store" }), fetch(`/api/providers/${id}/models`, { cache: "no-store" })]);
    if (!providerResponse.ok) { setMessage("Provider 不存在"); return; }
    const providerData = await providerResponse.json() as { providers: SafeProviderConfig[] };
    const found = providerData.providers.find((item) => item.id === id);
    if (!found) { setMessage("Provider 不存在"); return; }
    setProvider(found); setModels((await modelResponse.json() as { models: ModelConfig[] }).models);
    setForm({ name: found.name, kind: found.kind, baseUrl: found.baseUrl ?? "", apiKey: "", headersText: JSON.stringify(found.headers, null, 2), enabled: found.enabled, credentialAction: "keep" });
  }
  useEffect(() => {
    if (isNew) return;
    let active = true;
    Promise.all([fetch("/api/providers", { cache: "no-store" }), fetch(`/api/providers/${id}/models`, { cache: "no-store" })]).then(async ([providerResponse, modelResponse]) => {
      if (!providerResponse.ok) { if (active) setMessage("Provider 不存在"); return; }
      const providerData = await providerResponse.json() as { providers: SafeProviderConfig[] };
      const found = providerData.providers.find((item) => item.id === id);
      if (!found) { if (active) setMessage("Provider 不存在"); return; }
      const modelData = await modelResponse.json() as { models: ModelConfig[] };
      if (!active) return;
      setProvider(found); setModels(modelData.models); setForm({ name: found.name, kind: found.kind, baseUrl: found.baseUrl ?? "", apiKey: "", headersText: JSON.stringify(found.headers, null, 2), enabled: found.enabled, credentialAction: "keep" });
    }).catch(() => { if (active) setMessage("无法读取 Provider"); });
    return () => { active = false; };
  }, [id, isNew]);

  async function saveProvider(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    let headers: Record<string, string>;
    try { headers = JSON.parse(form.headersText) as Record<string, string>; if (!headers || Array.isArray(headers)) throw new Error(); } catch { setMessage("Headers 必须是 JSON 对象"); setBusy(false); return; }
    const response = await fetch("/api/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: isNew ? undefined : id, name: form.name, kind: form.kind, baseUrl: form.baseUrl || null, apiKey: form.apiKey || undefined, headers, enabled: form.enabled, credentialAction: form.credentialAction }) });
    const data = await response.json() as { provider?: SafeProviderConfig; message?: string; error?: string };
    setBusy(false);
    if (!response.ok || !data.provider) { setMessage(data.message ?? data.error ?? "保存失败"); return; }
    setMessage("Provider 已保存；API Key 只在服务端加密保存。");
    if (isNew) router.replace(`/settings/providers/${data.provider.id}`); else void load();
  }

  async function addModel(model: DiscoveredModel | null = null) {
    const modelId = (model?.modelId ?? manualModel).trim(); if (!modelId || isNew) return;
    const response = await fetch(`/api/providers/${id}/models`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelId, displayName: model?.displayName ?? modelId, capabilities: model?.capabilities ?? {}, enabled: true, isDefault: models.length === 0, source: model ? "discovered" : "manual" }) });
    const data = await response.json() as { model?: ModelConfig; message?: string; error?: string };
    if (!response.ok) { setMessage(data.message ?? data.error ?? "模型保存失败"); return; }
    setManualModel(""); setDiscovered((items) => items.filter((item) => item.modelId !== modelId)); setMessage("模型已添加"); void load();
  }
  async function discover() { setMessage("正在发现模型…"); const response = await fetch(`/api/providers/${id}/discover`, { method: "POST" }); const data = await response.json() as { models?: DiscoveredModel[]; message?: string }; if (!response.ok) { setMessage(data.message ?? "模型发现失败"); return; } setDiscovered(data.models ?? []); setMessage(`发现 ${data.models?.length ?? 0} 个模型`); }
  async function updateModel(model: ModelConfig, changes: Partial<ModelConfig>) { const response = await fetch(`/api/providers/${id}/models`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: model.id, modelId: model.modelId, displayName: model.displayName, capabilities: model.capabilities, source: model.source, enabled: changes.enabled ?? model.enabled, isDefault: changes.isDefault ?? model.isDefault }) }); const data = await response.json() as { message?: string; error?: string }; if (!response.ok) setMessage(data.message ?? data.error ?? "模型更新失败"); else void load(); }
  async function removeModel(model: ModelConfig) { if (!window.confirm(`删除模型 ${model.displayName}？`)) return; const response = await fetch(`/api/providers/${id}/models?id=${encodeURIComponent(model.id)}`, { method: "DELETE" }); if (!response.ok) { const data = await response.json() as { message?: string }; setMessage(data.message ?? "模型删除失败"); return; } void load(); }
  async function testModel(model: ModelConfig) { setMessage("正在测试模型…"); const response = await fetch("/api/providers/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, modelConfigId: model.id }) }); const data = await response.json() as { message?: string }; setMessage(data.message ?? "测试完成"); void load(); }

  if (!isNew && !provider && !message) return <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]"><Loader2 className="mr-2 animate-spin" size={16} />正在读取 Provider…</main>;
  return <main className="min-h-screen bg-[var(--paper)]"><header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6"><Link href="/settings/providers" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"><ChevronLeft size={16} />返回 Provider 列表</Link><nav className="flex gap-4 text-xs text-[var(--muted)]"><Link href="/settings/providers" className="text-[var(--ink)]">模型服务</Link><Link href="/settings/functions">认知功能</Link><Link href="/settings/general">常规</Link></nav></header><div className="mx-auto max-w-5xl px-6 pb-20"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">设置 / Provider 详情</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">连接与模型</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">凭据、连接测试和模型列表分开管理。列表只展示掩码，不会回传原始 API Key。</p><div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]"><form onSubmit={(event) => void saveProvider(event)} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-sm font-semibold">Provider 连接</h2><div className="mt-5 space-y-4"><label className="block text-xs text-[var(--muted)]">显示名称<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]" /></label><label className="block text-xs text-[var(--muted)]">类型<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ProviderKind })} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm outline-none">{kinds.map(([kind, name]) => <option key={kind} value={kind}>{name}</option>)}</select></label><label className="block text-xs text-[var(--muted)]">Base URL（兼容服务必填）<input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]" /></label><label className="block text-xs text-[var(--muted)]">API Key<input type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value, credentialAction: "replace" })} placeholder={provider?.apiKeyMasked ?? "留空表示未设置"} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]" /></label><div className="flex gap-2 text-xs"><Button type="button" size="sm" variant={form.credentialAction === "keep" ? "primary" : "secondary"} onClick={() => setForm({ ...form, apiKey: "", credentialAction: "keep" })}>保留现有 Key</Button><Button type="button" size="sm" variant={form.credentialAction === "clear" ? "danger" : "secondary"} onClick={() => setForm({ ...form, apiKey: "", credentialAction: "clear" })}>清除 Key</Button></div><label className="block text-xs text-[var(--muted)]">自定义 Headers（JSON）<textarea value={form.headersText} onChange={(event) => setForm({ ...form, headersText: event.target.value })} rows={4} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-2 font-mono text-xs outline-none focus:border-[var(--accent)]" /></label><label className="flex items-center gap-2 text-xs text-[var(--ink-soft)]"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />启用 Provider</label><Button type="submit" variant="primary" className="w-full" disabled={busy}><Save size={14} />{busy ? "保存中…" : "保存连接"}</Button>{provider && <p className="text-[10px] leading-5 text-[var(--muted)]">当前 Key：{provider.apiKeyMasked} · 状态：{provider.credentialStatus}</p>}</div></form><section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Model 配置</h2><p className="mt-1 text-xs text-[var(--muted)]">发现模型或手动添加；默认模型全局只能有一个。</p></div>{!isNew && <Button size="sm" onClick={() => void discover()}><RefreshCw size={13} />发现模型</Button>}</div>{isNew ? <p className="mt-8 rounded-xl border border-dashed border-[var(--line-strong)] p-5 text-xs text-[var(--muted)]">先保存 Provider，再添加模型。</p> : <><div className="mt-5 flex gap-2"><input value={manualModel} onChange={(event) => setManualModel(event.target.value)} placeholder="手动输入 Model ID" className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]" /><Button size="sm" variant="primary" onClick={() => void addModel()}><Plus size={13} />添加</Button></div><div className="mt-4 space-y-2">{models.map((model) => <div key={model.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold">{model.displayName}{model.isDefault && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent)]">全局默认</span>}{!model.enabled && <span className="rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] text-[var(--danger)]">已停用</span>}</div><p className="mt-1 truncate font-mono text-[10px] text-[var(--muted)]">{model.modelId} · {model.source}</p></div><div className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => void testModel(model)}>测试</Button><Button size="sm" variant="ghost" onClick={() => void updateModel(model, { enabled: !model.enabled })}>{model.enabled ? "停用" : "启用"}</Button>{!model.isDefault && <Button size="sm" variant="ghost" onClick={() => void updateModel(model, { isDefault: true })}>设默认</Button>}<Button size="icon" variant="ghost" onClick={() => void removeModel(model)} aria-label="删除模型"><Trash2 size={14} /></Button></div></div>)}</div>{discovered.length > 0 && <div className="mt-6 border-t border-[var(--line)] pt-4"><h3 className="text-xs font-semibold">发现结果</h3><div className="mt-2 space-y-2">{discovered.map((model) => <div key={model.modelId} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-raised)] px-3 py-2"><div className="min-w-0"><p className="truncate text-xs">{model.displayName}</p><p className="truncate font-mono text-[10px] text-[var(--muted)]">{model.modelId}</p></div><Button size="sm" onClick={() => void addModel(model)}>添加</Button></div>)}</div></div>}</>}</section></div>{message && <p className="mt-4 text-xs text-[var(--accent)]">{message}</p>}</div></main>;
}
