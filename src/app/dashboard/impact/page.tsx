'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { cn, statusColors, formatNumber } from '@/lib/utils';
import type { ImpactResult, GraphNode as GNode, GraphEdge as GEdge, ClassificationStatus } from '@/lib/types';
import { X, Search, Filter, Eye, ZoomIn, Maximize2, AlertTriangle } from 'lucide-react';

const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
  source: { bg: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', border: 'var(--color-primary)', text: 'var(--color-foreground)' },
  affected: { bg: 'color-mix(in srgb, var(--color-red) 15%, transparent)', border: 'var(--color-red)', text: 'var(--color-foreground)' },
  uncertain: { bg: 'color-mix(in srgb, var(--color-amber) 15%, transparent)', border: 'var(--color-amber)', text: 'var(--color-foreground)' },
  safe: { bg: 'color-mix(in srgb, var(--color-emerald) 15%, transparent)', border: 'var(--color-emerald)', text: 'var(--color-foreground)' },
  sold: { bg: 'color-mix(in srgb, var(--color-purple) 15%, transparent)', border: 'var(--color-purple)', text: 'var(--color-foreground)' },
  unaccounted: { bg: 'color-mix(in srgb, var(--color-orange) 15%, transparent)', border: 'var(--color-orange)', text: 'var(--color-foreground)' },
  not_relevant: { bg: 'var(--color-surface)', border: 'var(--color-border)', text: 'var(--color-muted-foreground)' },
};

const typeLabels: Record<string, string> = {
  supplier: 'Supplier',
  material: 'Material',
  lot: 'Lot',
  batch: 'Batch',
  product: 'Product',
  warehouse: 'Warehouse',
  shipment: 'Shipment',
  store: 'Store',
  customer: 'Customer',
};

const typeColumns: Record<string, number> = {
  supplier: 0,
  material: 1,
  lot: 2,
  batch: 3,
  product: 4,
  warehouse: 5,
  shipment: 6,
  store: 7,
};

function layoutNodes(gnodes: GNode[], gedges: GEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 40, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  // Only include relevant nodes (reduce visual clutter)
  const relevantNodes = gnodes.filter(n => 
    n.status !== 'not_relevant' || n.type === 'supplier' || n.type === 'material'
  );
  const relevantNodeIds = new Set(relevantNodes.map(n => n.id));

  for (const node of relevantNodes) {
    g.setNode(node.id, { width: 180, height: 60 });
  }

  for (const edge of gedges) {
    if (relevantNodeIds.has(edge.source) && relevantNodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const nodes = relevantNodes.map(node => {
    const pos = g.node(node.id);
    const colors = nodeColors[node.status] || nodeColors.not_relevant;
    return {
      id: node.id,
      type: 'default',
      position: { x: pos?.x || 0, y: pos?.y || 0 },
      data: {
        label: (
          <div className="text-center px-2">
            <div className="text-[9px] uppercase tracking-wider opacity-60">{typeLabels[node.type]}</div>
            <div className="text-xs font-medium truncate mt-0.5">{node.label}</div>
            {node.quantity && <div className="text-[10px] opacity-70 mt-0.5">{formatNumber(node.quantity)} units</div>}
          </div>
        ),
      },
      style: {
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: node.status === 'source' ? 'var(--radius-full)' : 'var(--radius-lg)',
        color: colors.text,
        width: 180,
        fontSize: '12px',
        padding: '8px 4px',
      },
      sourcePosition: 'right' as const,
      targetPosition: 'left' as const,
    };
  });

  const edges = gedges
    .filter(e => relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target))
    .map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'bezier',
      animated: edge.confidence !== 'confirmed',
      style: {
        stroke: edge.confidence === 'confirmed' ? 'var(--color-red)' : edge.confidence === 'probable' ? 'var(--color-amber)' : 'var(--color-muted)',
        strokeWidth: 1.5,
        opacity: 0.6,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: 'var(--color-muted)' },
      label: edge.confidence !== 'confirmed' ? edge.confidence : undefined,
      labelStyle: { fill: 'var(--color-muted-foreground)', fontSize: 9 },
    }));

  return { nodes, edges };
}

export default function ImpactMapPage() {
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  useEffect(() => {
    runAnalysis();
  }, []);

  async function runAnalysis() {
    try {
      const res = await fetch('/api/incidents/INC-001/analyze', { method: 'POST' });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      setImpact(data.data);

      const { nodes: layoutedNodes, edges: layoutedEdges } = layoutNodes(data.data.nodes, data.data.edges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  const onNodeClick = useCallback((_: any, node: any) => {
    if (!impact) return;
    const gNode = impact.nodes.find(n => n.id === node.id);
    if (gNode) setSelectedNode(gNode);
  }, [impact]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="skeleton w-12 h-12 rounded-full mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Building impact map…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={runAnalysis} className="mt-4 px-4 py-2 rounded-md bg-surface border border-border text-sm hover:bg-surface-2">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={20} size={1} />
        <Controls showInteractive={false} className="!bg-surface !border-border !rounded-lg" />
        <MiniMap
          nodeColor={(node) => {
            const style = node.style as any;
            return style?.border || '#3f3f46';
          }}
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-surface !border-border !rounded-lg"
        />

        {/* Legend */}
        <Panel position="top-left">
          <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-lg p-3 space-y-1.5">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Legend</div>
            {Object.entries(nodeColors).filter(([k]) => k !== 'not_relevant').map(([status, colors]) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: colors.bg, border: `1px solid ${colors.border}` }} />
                <span className="text-[10px] capitalize">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Stats */}
        {impact && (
          <Panel position="top-right">
            <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs space-y-1">
              <div className="text-muted-foreground font-medium mb-2">Impact Summary</div>
              <div className="flex justify-between gap-8"><span className="text-red-400">Affected:</span><span className="tabular-nums">{formatNumber(impact.affectedUnits)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-emerald-400">Safe:</span><span className="tabular-nums">{formatNumber(impact.safeUnits)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-amber-400">Uncertain:</span><span className="tabular-nums">{formatNumber(impact.uncertainUnits)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-purple-400">Sold:</span><span className="tabular-nums">{formatNumber(impact.soldUnits)}</span></div>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Node Detail Panel */}
      {selectedNode && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-surface border-l border-border z-50 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Node Details</h3>
              <button onClick={() => setSelectedNode(null)} className="p-1 rounded hover:bg-surface-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Type</div>
                <div className="text-sm capitalize">{selectedNode.type}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Label</div>
                <div className="text-sm font-medium">{selectedNode.label}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium border', statusColors[selectedNode.status])}>
                  {selectedNode.status}
                </span>
              </div>
              {selectedNode.reason && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Why</div>
                  <div className="text-xs text-foreground/80 leading-relaxed">{selectedNode.reason}</div>
                </div>
              )}
              {selectedNode.path.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Path</div>
                  <div className="text-[10px] text-muted-foreground">
                    {selectedNode.path.join(' → ')}
                  </div>
                </div>
              )}
              {Object.entries(selectedNode.data).map(([key, value]) => (
                <div key={key}>
                  <div className="text-xs text-muted-foreground mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="text-xs">{String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
