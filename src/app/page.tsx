import Link from "next/link";
import { ArrowRight, CircleDot, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-wide">
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--paper)]"><CircleDot size={16} /></span>
          思想孵化器
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/settings/providers" className="hidden text-sm text-[var(--muted)] hover:text-[var(--ink)] sm:block">模型设置</Link>
          <Button asChild size="sm" variant="primary"><Link href="/app">进入工作台 <ArrowRight size={15} /></Link></Button>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-20 pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-28">
        <div>
          <p className="mb-6 text-xs font-semibold uppercase tracking-[.22em] text-[var(--accent)]">A quiet place for unfinished thoughts</p>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.08] tracking-[-.05em] sm:text-7xl">让模糊的念头，慢慢长出自己的语言。</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">你带来直觉、经验或一个还没想清楚的问题。系统只在最需要的地方轻轻介入，然后把下一步交还给你。</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="md" variant="primary"><Link href="/app">开始一个思想 <ArrowRight size={16} /></Link></Button>
            <span className="text-xs text-[var(--muted)]">本地运行 · 无需注册 · 没有 API Key 也能体验</span>
          </div>
        </div>
        <div className="quiet-grid rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_20px_60px_rgba(28,34,29,.07)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] p-5">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-4"><span className="text-sm font-medium">一个还没说清的念头</span><span className="rounded-full bg-[var(--candidate-bg)] px-2 py-1 text-[10px] text-[var(--candidate)]">演示模式</span></div>
            <div className="space-y-4">
              <div className="max-w-[86%] rounded-2xl rounded-tl-sm bg-[var(--accent-soft)] p-4 text-sm leading-6">我总觉得，做得越多反而越没有在前进。</div>
              <div className="ml-auto max-w-[86%] rounded-2xl rounded-tr-sm border border-[var(--line)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--ink-soft)]">我先这样听见它：你似乎在说“做得越多反而越没有在前进”。这句话里，哪一部分最想被认真看见？</div>
            </div>
            <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm text-[var(--muted)]">继续写下去……</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-[var(--muted)]">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3"><Sparkles className="mx-auto mb-2 text-[var(--accent)]" size={16} />最小介入</div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3"><GitBranch className="mx-auto mb-2 text-[var(--accent)]" size={16} />思想演化</div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3"><ShieldCheck className="mx-auto mb-2 text-[var(--accent)]" size={16} />本地优先</div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 border-t border-[var(--line)] px-6 py-16 sm:grid-cols-3">
        {[
          ["不是聊天记录", "每一次表达都会进入思想节点、认识论状态和演化关系。"],
          ["不是 AI 替你总结", "候选就是候选。只有你明确确认，它才会成为你的观点。"],
          ["不是多个角色抢话", "默认一次只让一个认知功能介入，然后等待你的下一步。"],
        ].map(([title, text]) => <div key={title} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text}</p></div>)}
      </section>
    </main>
  );
}
