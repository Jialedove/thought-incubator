"use client";

import Link from "next/link";
import { ChevronLeft, Link2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { cognitiveFunctions, type CognitiveFunction, type SafeProviderConfig } from "@/domain/types";
import { Button } from "@/components/ui/button";

const names: Record<CognitiveFunction, string> = { facilitate: "引导", mirror: "镜像", clarify: "澄清", distinguish: "区分", ground: "经验", challenge: "挑战", extend: "延展", connect: "连接", reformulate: "重述", record: "记录" };

export default function FunctionsSettingsPage() {
  const [providers, setProviders] = useState<SafeProviderConfig[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");
  useEffect(() => { void Promise.all([fetch("/api/providers").then((response) => response.json() as Promise<{ providers: SafeProviderConfig[] }>), fetch("/api/functions").then((response) => response.json() as Promise<{ models: Array<{ cognitiveFunction: string; providerId: string | null }> }>)]).then(([providerData, modelData]) => { setProviders(providerData.providers); setMapping(Object.fromEntries(modelData.models.map((model) => [model.cognitiveFunction, model.providerId ?? ""]))); }); }, []);
  async function save() { await Promise.all(cognitiveFunctions.map((name) => fetch("/api/functions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cognitiveFunction: name, providerId: mapping[name] || null, modelId: null }) }))); setSaved("认知功能分配已保存。未指定时使用默认模型。"); }
  return <main className="min-h-screen bg-[var(--paper)]"><header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6"><Link href="/settings/providers" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"><ChevronLeft size={16} />模型服务</Link><nav className="flex gap-4 text-xs text-[var(--muted)]"><Link href="/settings/providers">模型服务</Link><Link href="/settings/functions" className="text-[var(--ink)]">认知功能</Link><Link href="/settings/general">常规</Link></nav></header><div className="mx-auto max-w-4xl px-6 pb-20"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">设置 / 认知功能</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">功能不是人格。</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">你可以把不同的认知功能交给不同的模型。前台只显示功能名称，不显示多个 AI 角色。</p><div className="mt-10 space-y-2">{cognitiveFunctions.map((name) => <div key={name} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><div><p className="text-sm font-semibold">{names[name]}</p><p className="mt-1 text-xs text-[var(--muted)]">{name}</p></div><select value={mapping[name] ?? ""} onChange={(event) => setMapping({ ...mapping, [name]: event.target.value })} className="max-w-[220px] rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-xs outline-none"><option value="">继承默认模型</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></div>)}</div><div className="mt-6 flex items-center gap-3"><Button variant="primary" onClick={() => void save()}><Save size={14} />保存分配</Button><span className="flex items-center gap-1 text-xs text-[var(--muted)]"><Link2 size={12} />默认模式每轮只选择一个功能</span>{saved && <span className="text-xs text-[var(--accent)]">{saved}</span>}</div></div></main>;
}
