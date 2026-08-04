import Link from "next/link";
import { ArrowRight, BookOpen, CircleDot, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionNav } from "@/components/session-nav";

export default function AppPage() {
  return <div className="app-grid">
    <SessionNav />
    <main className="quiet-grid flex min-h-screen min-w-0 items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <span className="mx-auto mb-6 flex size-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><CircleDot size={24} /></span>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Thought workspace</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-.04em]">你的思想，从这里开始有迹可循。</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">新建一个会话，写下一个模糊直觉。系统会在每一轮只做一次必要的认知介入，并把你的接受、拒绝与修订保存为思想演化。</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild variant="primary"><Link href="/app"><Sparkles size={15} />从左侧新建思想</Link></Button><Button asChild><Link href="/settings/general"><LockKeyhole size={15} />查看本地数据</Link></Button></div>
        <div className="mt-12 grid gap-3 text-left sm:grid-cols-3"><div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><BookOpen size={16} className="text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold">说出来</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">无需先组织好。</p></div><div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><Sparkles size={16} className="text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold">看清楚</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">候选保持为候选。</p></div><div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><ArrowRight size={16} className="text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold">带走</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">导出自己的演化。</p></div></div>
      </div>
    </main>
    <aside className="right-panel hidden min-h-screen p-5 lg:block"><div className="mt-3 text-xs font-semibold text-[var(--muted)]">工作台提示</div><p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">写下你现在最想继续想的事。这里没有正确的开场白。</p></aside>
  </div>;
}
