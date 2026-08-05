import { NextResponse } from "next/server";
import { exportBundle, importBundle } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

function fileName(title: string, extension: string) {
  const safe = title.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "thought";
  return `thought-incubator-${safe}.${extension}`;
}

function markdown(bundle: NonNullable<ReturnType<typeof exportBundle>>) {
  const user = bundle.nodes.filter((node) => node.author === "user");
  const accepted = bundle.nodes.filter((node) => node.epistemicStatus === "user_accepted");
  const rejected = bundle.nodes.filter((node) => node.epistemicStatus === "user_rejected");
  const candidates = bundle.nodes.filter((node) => node.epistemicStatus === "ai_proposal" || node.epistemicStatus === "ai_interpretation");
  const examples = bundle.nodes.filter((node) => node.type === "example");
  const counterexamples = bundle.nodes.filter((node) => node.type === "counterexample");
  const revisions = bundle.nodes.filter((node) => node.type === "revision");
  const questions = bundle.nodes.filter((node) => node.type === "open_question");
  return [
    "# " + bundle.session.title,
    "",
    "阶段：" + bundle.session.phase + " · 状态：" + bundle.session.status,
    "",
    "## 最初直觉",
    user[0]?.content ?? "尚未记录",
    "",
    "## 当前焦点",
    bundle.nodes.find((node) => node.id === bundle.session.currentFocusNodeId)?.content ?? "尚未记录",
    "",
    "## 思想演化时间线",
    ...bundle.events.map((event) => "- [" + new Date(event.createdAt).toLocaleString("zh-CN") + "] " + (event.actor === "user" ? "用户" : event.actor === "assistant" ? "AI" : "系统") + "： " + event.content),
    "",
    "## 用户接受的观点",
    ...(accepted.length ? accepted.map((node) => "- " + node.content) : ["- 尚未接受"]),
    "",
    "## 用户修订",
    ...(revisions.length ? revisions.map((node) => "- " + node.content) : ["- 尚未记录"]),
    "",
    "## 关键区分",
    ...(bundle.nodes.filter((node) => node.type === "distinction").map((node) => "- " + node.content).length ? bundle.nodes.filter((node) => node.type === "distinction").map((node) => "- " + node.content) : ["- 尚未记录"]),
    "",
    "## 例子",
    ...(examples.length ? examples.map((node) => "- " + node.content) : ["- 尚未记录"]),
    "",
    "## 反例",
    ...(counterexamples.length ? counterexamples.map((node) => "- " + node.content) : ["- 尚未记录"]),
    "",
    "## 开放问题",
    ...(questions.length ? questions.map((node) => "- " + node.content) : ["- 尚未记录"]),
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
    return new Response(markdown(bundle), { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName(bundle.session.title, "md"))}` } });
  }
  return NextResponse.json({ schemaVersion: 2, ...bundle }, { headers: { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName(bundle.session.title, "json"))}` } });
}

export async function POST(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  try {
    const bundle = importBundle(await request.json());
    return bundle ? NextResponse.json({ bundle, imported: true }, { status: 201 }) : NextResponse.json({ error: "导入失败" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "导入文件无效" }, { status: 400 });
  }
}
