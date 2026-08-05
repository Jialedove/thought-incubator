"use client";

import Link from "next/link";
import { Check, ChevronLeft, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ModelConfig, ProviderKind, SafeProviderConfig } from "@/domain/types";
import { Button } from "@/components/ui/button";

const kinds: Array<[ProviderKind, string]> = [["mock", "本地模拟模型"], ["openai", "OpenAI"], ["anthropic", "Anthropic"], ["google", "Google Generative AI"], ["openai-compatible", "OpenAI-compatible"]];
const kindName = (kind: ProviderKind) => kinds.find(([value]) => value === kind)?.[1] ?? kind;

export default function ProvidersSettingsPage() {
  const [providers, setProviders] = useState<SafeProviderConfig[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/providers", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json() as { providers: SafeProviderConfig[]; models: ModelConfig[] };
      setProviders(data.providers); setModels(data.models);
    }
  }
  useEffect(() => { let active = true; fetch("/api/providers", { cache: "no-store" }).then((response) => response.json() as Promise<{ providers: SafeProviderConfig[]; models: ModelConfig[] }>).then((data) => { if (active) { setProviders(data.providers); setModels(data.models); } }).catch(() => undefined); return () => { active = false; }; }, []);

  async function test(providerId: string, modelConfigId?: string) {
    setMessage("正在测试连接…");
    const response = await fetch("/api/providers/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: providerId, modelConfigId }) });
    const data = await response.json() as { message?: string };
    setMessage(data.message ?? (response.ok ? "测试完成" : "连接测试失败"));
    void load();
  }
  async function remove(id: string) {
    if (!window.confirm("删除这个 Provider 及其模型配置？")) return;
    const response = await fetch(`/api/providers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { const data = await response.json() as { message?: string }; setMessage(data.message ?? "删除失败"); return; }
    void load();
  }

  return <main className="min-h-screen bg-[var(--paper)]"><header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6"><Link href="/app" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"><ChevronLeft size={16} />返回工作台</Link><nav className="flex gap-4 text-xs text-[var(--muted)]"><Link href="/settings/providers" className="text-[var(--ink)]">模型服务</Link><Link href="/settings/functions">认知功能</Link><Link href="/settings/general">常规</Link></nav></header><div className="mx-auto max-w-5xl px-6 pb-20"><div className="flex items-end justify-between gap-4"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">设置 / 模型服务</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Provider 与 Model 分开管理。</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">一个 Provider 可以拥有多个模型；默认模型是全局唯一的，认知功能也可以单独绑定已启用模型。</p></div><Button asChild variant="primary"><Link href="/settings/providers/new"><Plus size={14} />新增 Provider</Link></Button></div><div className="mt-10 space-y-3">{providers.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--line-strong)] p-8 text-sm text-[var(--muted)]">还没有 Provider 配置。</div> : providers.map((provider) => { const providerModels = models.filter((model) => model.providerId === provider.id); return <section key={provider.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><KeyRound size={15} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-sm font-semibold">{provider.name}{provider.isDefault && <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-normal text-[var(--accent)]"><Check size={10} />默认模型</span>}{!provider.enabled && <span className="rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-normal text-[var(--danger)]">Provider 已停用</span>}</div><p className="mt-1 text-xs text-[var(--muted)]">{kindName(provider.kind)} · Key {provider.apiKeyMasked} · {provider.modelCount} 个模型</p><p className="mt-1 text-[10px] text-[var(--muted)]">凭据状态：{provider.credentialStatus} · 最近测试：{provider.lastTestStatus ?? "未测试"}</p></div></div><div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" onClick={() => void test(provider.id)} aria-label="测试 Provider 连接"><RefreshCw size={14} /></Button><Button size="icon" variant="ghost" asChild><Link href={`/settings/providers/${provider.id}`} aria-label="编辑 Provider"><Pencil size={14} /></Link></Button><Button size="icon" variant="ghost" onClick={() => void remove(provider.id)} aria-label="删除 Provider"><Trash2 size={14} /></Button></div></div><div className="mt-4 border-t border-[var(--line)] pt-3">{providerModels.length ? <div className="flex flex-wrap gap-2">{providerModels.map((model) => <span key={model.id} className={`rounded-full border px-2.5 py-1 text-[11px] ${model.isDefault ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]"}`}>{model.displayName} <span className="opacity-60">({model.modelId})</span></span>)}</div> : <p className="text-xs text-[var(--muted)]">尚未添加模型。打开详情页进行发现或手动添加。</p>}</div></section>; })}</div>{message && <p className="mt-4 text-xs text-[var(--accent)]">{message}</p>}</div></main>;
}
