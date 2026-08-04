"use client";

import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ThoughtEdge, ThoughtNode } from "@/domain/types";

const label: Record<ThoughtNode["type"], string> = {
  original_expression: "最初直觉", candidate_interpretation: "候选解释", distinction: "区分",
  example: "例子", counterexample: "反例", evidence: "证据", accepted_claim: "已接受",
  rejected_claim: "已拒绝", open_question: "开放问题", revision: "修订", temporary_summary: "临时摘要",
};

export function ThoughtMap({ nodes, edges }: { nodes: ThoughtNode[]; edges: ThoughtEdge[] }) {
  const flowNodes = nodes.map((node, index) => ({
    id: node.id,
    position: { x: (index % 2) * 175 + 20, y: Math.floor(index / 2) * 130 + 20 },
    data: { label: <div className="max-w-[140px]"><p className="mb-1 text-[9px] font-semibold text-[var(--muted)]">{label[node.type]}</p><p className="line-clamp-4 text-[11px] leading-4">{node.content}</p></div> },
    className: "rounded-xl border border-[var(--line-strong)] bg-[var(--surface-raised)] p-3 shadow-sm",
  }));
  const flowEdges = edges.filter((edge) => edge.sourceNodeId !== edge.targetNodeId).map((edge) => ({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId, label: edge.type, style: { stroke: "var(--accent)" }, labelStyle: { fontSize: 9, fill: "var(--muted)" } }));
  return <div className="h-[360px] w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)]"><ReactFlow nodes={flowNodes} edges={flowEdges} fitView fitViewOptions={{ padding: 0.25 }} nodesDraggable={false} nodesConnectable={false}><Background color="#dfe3dd" gap={24} /><Controls showInteractive={false} /><MiniMap pannable zoomable /></ReactFlow></div>;
}
