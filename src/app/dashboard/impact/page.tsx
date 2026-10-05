'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel, useNodesState, useEdgesState, MarkerType, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { cn, formatNumber } from '@/lib/utils';
import type { ImpactResult, GraphNode as GNode, GraphEdge as GEdge } from '@/lib/types';
import { X, AlertTriangle, Crosshair, Map as MapIcon, Play } from 'lucide-react';
import { ImpactNode } from './components/ImpactNode';

const nodeTypes = {
  impactNode: ImpactNode,
};

function getReachableNodes(startNodeId: string, edges: GEdge[], direction: 'upstream' | 'downstream'): Set<string> {
  const visited = new Set<string>([startNodeId]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (direction === 'downstream' && edge.source === current && !visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
      } else if (direction === 'upstream' && edge.target === current && !visited.has(edge.source)) {
        visited.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return visited;
}

function layoutElements(gnodes: GNode[], gedges: GEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 180, nodesep: 50, marginx: 60, marginy: 60 });
  g.setDefaultEdgeLabel(() => ({}));

  // Filter out irrelevant ones
  const relevantNodes = gnodes.filter(n => n.status !== 'not_relevant' || n.type === 'supplier');
  const relevantNodeIds = new Set(relevantNodes.map(n => n.id));

  for (const node of relevantNodes) {
    g.setNode(node.id, { width: 180, height: 80 });
  }

  for (const edge of gedges) {
    if (relevantNodeIds.has(edge.source) && relevantNodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const initialNodes = relevantNodes.map(node => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      type: 'impactNode',
      position: { x: pos?.x || 0, y: pos?.y || 0 },
      data: {
        ...node,
        isSelected: false,
        isMuted: false,
      },
    };
  });

  const nodeStatusMap = new Map(relevantNodes.map(n => [n.id, n.status]));

  const initialEdges = gedges
    .filter(e => relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target))
    .map(edge => {
      const targetStatus = nodeStatusMap.get(edge.target) || 'not_relevant';
      
      let baseStroke = 'var(--color-border)';
      if (targetStatus === 'affected' || targetStatus === 'source') baseStroke = 'var(--color-critical)';
      else if (targetStatus === 'uncertain') baseStroke = 'var(--color-warning)';
      else if (targetStatus === 'safe') baseStroke = 'var(--color-success)';
      else if (targetStatus === 'sold') baseStroke = 'var(--color-muted-foreground)';

      const isImportant = targetStatus === 'affected' || targetStatus === 'source';

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'bezier',
        animated: edge.confidence !== 'confirmed',
        style: {
          stroke: baseStroke,
          strokeWidth: isImportant ? 2 : 1.5,
          opacity: isImportant ? 0.8 : 0.5,
        },
        data: {
          baseStroke,
          baseWidth: isImportant ? 2 : 1.5,
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          width: 12, height: 12, 
          color: baseStroke 
        },
      };
    });

  return { initialNodes, initialEdges };
}

function ImpactFlow({ impact }: { impact: ImpactResult }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { fitView, setCenter } = useReactFlow();

  useEffect(() => {
    const { initialNodes, initialEdges } = layoutElements(impact.nodes, impact.edges);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
  }, [impact, setNodes, setEdges, fitView]);

  // Update nodes and edges based on selection
  useEffect(() => {
    if (!selectedNodeId) {
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isSelected: false, isMuted: false } })));
      setEdges(eds => eds.map(e => ({
        ...e,
        style: { ...e.style, stroke: e.data.baseStroke, strokeWidth: e.data.baseWidth, opacity: e.data.baseWidth === 2 ? 0.8 : 0.4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: e.data.baseStroke }
      })));
      return;
    }

    const down = getReachableNodes(selectedNodeId, impact.edges, 'downstream');
    const up = getReachableNodes(selectedNodeId, impact.edges, 'upstream');
    const activeIds = new Set([...Array.from(down), ...Array.from(up)]);

    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === selectedNodeId,
        isMuted: !activeIds.has(n.id)
      }
    })));

    setEdges(eds => eds.map(e => {
      const isPath = activeIds.has(e.source) && activeIds.has(e.target);
      return {
        ...e,
        style: {
          ...e.style,
          stroke: e.data.baseStroke,
          strokeWidth: isPath ? e.data.baseWidth + 1 : e.data.baseWidth,
          opacity: isPath ? 1 : 0.15,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: e.data.baseStroke }
      };
    }));
  }, [selectedNodeId, impact.edges, setNodes, setEdges]);

  const handleNodeClick = useCallback((_: any, node: any) => {
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
  }, []);

  const focusIncident = () => {
    const sourceNode = nodes.find(n => n.data.status === 'source');
    if (sourceNode) {
      setSelectedNodeId(sourceNode.id);
      setCenter(sourceNode.position.x + 90, sourceNode.position.y + 40, { zoom: 1.2, duration: 800 });
    }
  };

  const showFullNetwork = () => {
    setSelectedNodeId(null);
    fitView({ padding: 0.2, duration: 800 });
  };

  const selectedData = selectedNodeId ? nodes.find(n => n.id === selectedNodeId)?.data : null;

  return (
    <div className="w-full h-full flex relative rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => setSelectedNodeId(null)}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background color="var(--color-muted-foreground)" gap={20} size={1} className="opacity-20" />
        
        {/* Controls Overlay */}
        <Panel position="bottom-left" className="mb-4 ml-4 flex gap-2">
          <button onClick={focusIncident} className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-2 border border-border text-[13px] font-semibold text-foreground hover:bg-surface shadow-sm transition-colors">
            <Crosshair className="w-4 h-4 text-critical" /> Focus Incident
          </button>
          <button onClick={showFullNetwork} className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-2 border border-border text-[13px] font-semibold text-foreground hover:bg-surface shadow-sm transition-colors">
            <MapIcon className="w-4 h-4 text-muted-foreground" /> Full Network
          </button>
        </Panel>

        <Controls showInteractive={false} className="!bg-surface !border-border !rounded-lg !shadow-sm !overflow-hidden" />

        {/* Legend */}
        <Panel position="top-left" className="mt-4 ml-4">
          <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-xl p-3.5 space-y-2 shadow-sm">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-3">Legend</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-critical" /><span className="text-[12px] font-medium">Affected</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-warning" /><span className="text-[12px] font-medium">Needs Verification</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-success" /><span className="text-[12px] font-medium">Safe</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" /><span className="text-[12px] font-medium">Already Sold</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-border" /><span className="text-[12px] font-medium text-muted-foreground">Normal</span></div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Stats overlay (Top Right) */}
      <div className="absolute top-4 right-4 z-10 flex gap-3 pointer-events-none">
        <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-xl px-4 py-3 text-right shadow-sm pointer-events-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Affected</div>
          <div className="text-xl font-semibold tabular-nums text-critical">{formatNumber(impact.affectedUnits)}</div>
        </div>
        <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-xl px-4 py-3 text-right shadow-sm pointer-events-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Uncertain</div>
          <div className="text-xl font-semibold tabular-nums text-warning">{formatNumber(impact.uncertainUnits)}</div>
        </div>
        <div className="bg-surface/90 backdrop-blur-sm border border-border rounded-xl px-4 py-3 text-right shadow-sm pointer-events-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Safe</div>
          <div className="text-xl font-semibold tabular-nums text-success">{formatNumber(impact.safeUnits)}</div>
        </div>
      </div>

      {/* Details Panel */}
      {selectedData && (
        <div className="absolute right-4 top-24 bottom-4 w-80 bg-surface/95 backdrop-blur-md rounded-2xl border border-border z-50 flex flex-col shadow-lg overflow-hidden animate-in slide-in-from-right-4 duration-300">
          <div className="p-5 border-b border-border/50 flex items-center justify-between bg-surface-2/30">
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Entity Details</div>
              <h3 className="text-[15px] font-semibold text-foreground truncate max-w-[200px]">{selectedData.label}</h3>
            </div>
            <button onClick={() => setSelectedNodeId(null)} className="p-1.5 rounded-md hover:bg-surface-2 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          
          <div className="p-5 flex-1 overflow-y-auto space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Type</div>
                <div className="text-[14px] capitalize font-medium text-foreground">{selectedData.type}</div>
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">ID</div>
                <div className="text-[13px] text-muted-foreground font-mono">{selectedData.id}</div>
              </div>
            </div>
            
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Status</div>
              <span className={cn(
                'px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border', 
                selectedData.status === 'affected' ? 'bg-critical/10 text-critical border-critical/50' :
                selectedData.status === 'uncertain' ? 'bg-warning/10 text-warning border-warning/50' :
                selectedData.status === 'safe' ? 'bg-success/10 text-success border-success/50' :
                selectedData.status === 'source' ? 'bg-critical/10 text-critical border-critical/50' :
                'bg-surface-2 text-muted-foreground border-border'
              )}>
                {selectedData.status.replace('_', ' ')}
              </span>
            </div>

            {selectedData.quantity && (
              <div>
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Quantity</div>
                <div className="text-[15px] font-semibold tabular-nums text-foreground">{formatNumber(selectedData.quantity)} <span className="text-[12px] font-medium text-muted-foreground">units</span></div>
              </div>
            )}

            {selectedData.reason && (
              <div>
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Reason</div>
                <div className="text-[13px] text-foreground leading-relaxed bg-surface-2 p-3 rounded-xl border border-border">
                  {selectedData.reason}
                </div>
              </div>
            )}
            
            {selectedData.path && selectedData.path.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Lineage</div>
                <div className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col gap-1.5 relative">
                  {selectedData.path.map((step: string, i: number) => (
                    <div key={i} className="flex flex-col">
                      <div className="text-[12px] font-medium text-foreground">{step}</div>
                      {i < selectedData.path.length - 1 && (
                        <div className="text-muted-foreground/40 text-[10px] ml-1 mt-0.5 mb-0.5">↓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => {
                const down = getReachableNodes(selectedData.id, impact.edges, 'downstream');
                const up = getReachableNodes(selectedData.id, impact.edges, 'upstream');
                const activeIds = new Set([...Array.from(down), ...Array.from(up)]);
                setNodes(nds => nds.map(n => ({
                  ...n, data: { ...n.data, isSelected: n.id === selectedData.id, isMuted: !activeIds.has(n.id) }
                })));
                fitView({ nodes: nodes.filter(n => activeIds.has(n.id)), padding: 0.2, duration: 800 });
              }}
              className="w-full py-3 bg-dark-action text-dark-action-fg rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-sm mt-4"
            >
              <Play className="w-4 h-4 fill-current" /> Trace Downstream
            </button>
            
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImpactMapPage() {
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function runAnalysis() {
      try {
        const res = await fetch('/api/incidents/INC-001/analyze', { method: 'POST' });
        if (!res.ok) throw new Error('Analysis failed');
        const data = await res.json();
        setImpact(data.data);
        setLoading(false);
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    }
    runAnalysis();
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="skeleton w-12 h-12 rounded-full mx-auto mb-4 animate-pulse" />
      </div>
    );
  }

  if (error || !impact) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center text-center">
        <div>
          <AlertTriangle className="w-8 h-8 text-critical mx-auto mb-3" />
          <p className="text-[14px] text-muted-foreground">{error || 'Failed to load'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto h-[calc(100vh-3.5rem)] flex flex-col space-y-5 text-foreground transition-colors duration-300">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-semibold text-foreground mb-1">Impact Analysis</h1>
          <p className="text-[14px] text-muted-foreground">Interactive map of upstream sources and downstream contamination spread</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ReactFlowProvider>
          <ImpactFlow impact={impact} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
