"use client";

import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ThoughtEdge, ThoughtNode } from "@/domain/types";

const label: Record<ThoughtNode["type"], string> = {
  original_expression: "最初直觉", answer: "回答", candidate_interpretation: "候选解释", distinction: "区分",
  example: "例子", counterexample: "反例", evidence: "证据", accepted_claim: "已接受",
  rejected_claim: "已拒绝", open_question: "开放问题", revision: "修订", temporary_summary: "临时摘要",
};

function positions(nodes: ThoughtNode[], edges: ThoughtEdge[]) {
  const depth = new Map<string, number>();
  for (const node of nodes) depth.set(node.id, 0);
  for (let pass = 0; pass < nodes.length; pass += 1) {
    for (const edge of edges) {
      if (edge.sourceNodeId !== edge.targetNodeId) depth.set(edge.targetNodeId, Math.max(depth.get(edge.targetNodeId) ?? 0, (depth.get(edge.sourceNodeId) ?? 0) + 1));
    }
  }
  const columns = new Map<number, number>();
  return new Map(nodes.map((node) => {
    const column = depth.get(node.id) ?? 0;
    const row = columns.get(column) ?? 0;
    columns.set(column, row + 1);
    return [node.id, { x: column * 210 + 24, y: row * 125 + 24 }];
  }));
}

export function ThoughtMap({ nodes, edges, currentFocusNodeId, onFocusNode }: { nodes: ThoughtNode[]; edges: ThoughtEdge[]; currentFocusNodeId?: string | null; onFocusNode?: (id: string) => void }) {
  if (nodes.length === 0) return <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-[var(--line-strong)] text-xs text-[var(--muted)]">思想节点会在表达和回应后出现在这里。</div>;
  const nodePositions = positions(nodes, edges);
  const flowNodes = nodes.map((node) => ({
    id: node.id, position: nodePositions.get(node.id) ?? { x: 24, y: 24 },
    data: { label: <div className="max-w-[150px]"><p className="mb-1 text-[9px] font-semibold text-[var(--muted)]">{label[node.type]}{node.id === currentFocusNodeId ? " · 当前焦点" : ""}</p><p className="line-clamp-4 text-[11px] leading-4">{node.content}</p></div> },
    className: "rounded-xl border border-[var(--line-strong)] bg-[var(--surface-raised)] p-3 shadow-sm",
  }));
  const flowEdges = edges.filter((edge) => edge.sourceNodeId !== edge.targetNodeId).map((edge) => ({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId, label: edge.type, style: { stroke: "var(--accent)" }, labelStyle: { fontSize: 9, fill: "var(--muted)" } }));
  return <div className="h-[440px] w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)]"><ReactFlow nodes={flowNodes} edges={flowEdges} fitView fitViewOptions={{ padding: 0.25 }} nodesDraggable={false} nodesConnectable={false} onNodeClick={(_, node) => onFocusNode?.(node.id)}><Background color="var(--line-strong)" gap={24} /><Controls showInteractive={false} /><MiniMap pannable zoomable /></ReactFlow></div>;
}
