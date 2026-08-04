import { NextResponse } from "next/server";
import { exportBundle } from "@/server/repository";

export const runtime = "nodejs";

function markdown(bundle: NonNullable<ReturnType<typeof exportBundle>>) {
  const user = bundle.nodes.filter((node) => node.author === "user");
  const accepted = bundle.nodes.filter((node) => node.epistemicStatus === "user_accepted");
  const rejected = bundle.nodes.filter((node) => node.epistemicStatus === "user_rejected");
  const candidates = bundle.nodes.filter((node) => node.epistemicStatus === "ai_proposal" || node.epistemicStatus === "ai_interpretation");
  return [
    "# " + bundle.session.title,
    "",
    "阶段：" + bundle.session.phase + " · 状态：" + bundle.session.status,
    "",
    "## 最初直觉",
    user[0]?.content ?? "尚未记录",
    "",
    "## 思想演化时间线",
    ...bundle.events.map((event) => "- [" + new Date(event.createdAt).toLocaleString("zh-CN") + "] " + (event.type.startsWith("user") ? "用户" : "AI") + "： " + event.content),
    "",
    "## 用户接受的观点",
    ...(accepted.length ? accepted.map((node) => "- " + node.content) : ["- 尚未接受"]),
    "",
    "## AI 候选与被拒绝内容",
    ...(candidates.concat(rejected).length ? candidates.concat(rejected).map((node) => "- " + (rejected.includes(node) ? "已拒绝： " : "候选： ") + node.content) : ["- 尚未记录"]),
    "",
    "## 完整对话",
    ...bundle.events.map((event) => "- " + event.content),
  ].join("\n");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bundle = exportBundle(id);
  if (!bundle) return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format === "md") {
    return new Response(markdown(bundle), { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": "attachment; filename=thought-incubator.md" } });
  }
  return NextResponse.json(bundle, { headers: { "Content-Disposition": "attachment; filename=thought-incubator.json" } });
}
