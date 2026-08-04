"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Download, HardDrive, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function GeneralSettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState("system");
  const [saved, setSaved] = useState(false);
  function changeTheme(value: string) { setTheme(value); window.localStorage.setItem("thought-incubator-theme", value); setSaved(true); }
  return <main className="min-h-screen bg-[var(--paper)]"><header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6"><Link href="/app" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"><ChevronLeft size={16} />返回工作台</Link><nav className="flex gap-4 text-xs text-[var(--muted)]"><Link href="/settings/providers">模型服务</Link><Link href="/settings/functions">认知功能</Link><Link href="/settings/general" className="text-[var(--ink)]">常规</Link></nav></header><div className="mx-auto max-w-4xl px-6 pb-20"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">设置 / 常规</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">让工作台适合长时间思考。</h1><div className="mt-10 max-w-2xl space-y-6"><section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-sm font-semibold">外观</h2><p className="mt-1 text-xs text-[var(--muted)]">主题偏好保存在当前浏览器，不上传任何数据。</p><div className="mt-4 grid grid-cols-3 gap-2">{[["system", "跟随系统", Sun], ["light", "浅色", Sun], ["dark", "深色", Moon]].map(([value, label, Icon]) => <button key={value as string} type="button" onClick={() => changeTheme(value as string)} className={"flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs " + (theme === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]")}><Icon size={14} />{label as string}{theme === value && <Check size={12} />}</button>)}</div>{saved && <p className="mt-3 text-xs text-[var(--accent)]">已保存。</p>}</section><section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-center gap-3"><HardDrive size={17} className="text-[var(--accent)]" /><div><h2 className="text-sm font-semibold">本地数据</h2><p className="mt-1 text-xs text-[var(--muted)]">SQLite：./data/thought-incubator.db</p><p className="text-xs text-[var(--muted)]">凭据：./data/.master-key 与加密文件</p></div></div><div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-xs leading-6 text-[var(--muted)]">备份：停止应用后复制整个 data/ 目录。彻底删除：停止应用并删除 data/ 目录。会话、思想节点和 API Key 不会发送到外部服务。</div><Button className="mt-4" onClick={() => router.push("/app")}><Download size={14} />导出请在具体会话中操作</Button></section></div></div></main>;
}
