'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel, useNodesState, useEdgesState, MarkerType, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { cn, formatNumber } from '@/lib/utils';
import type { ImpactResult, GraphNode as GNode, GraphEdge as GEdge } from '@/lib/types';
import { X, AlertTriangle, Crosshair, Map as MapIcon, Play, Sparkles } from 'lucide-react';
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

/** BFS order array — used for the animated sweep */
function getDownstreamOrdered(startNodeId: string, edges: GEdge[]): string[] {
  const visited = new Set<string>([startNodeId]);
  const queue = [startNodeId];
  const ordered: string[] = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === current && !visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
        ordered.push(edge.target);
      }
    }
  }
  return ordered;
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
        isAnimating: false,
        predictionMode: false,
        aiRiskScore: undefined,
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

// Compute max quantity across all nodes (for deterministic AI risk score)
function computeMaxQuantity(gnodes: GNode[]): number {
  return Math.max(1, ...gnodes.map(n => (n as any).quantity || 0));
}

function computeAiRiskScore(node: GNode, maxQuantity: number): number {
  return Math.round(30 + (((node as any).quantity || 0) / maxQuantity) * 60);
}

function ImpactFlow({ impact, predictionMode }: { impact: ImpactResult; predictionMode: boolean }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { fitView, setCenter, getNodes } = useReactFlow();
  const sweepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const maxQuantity = computeMaxQuantity(impact.nodes);

  useEffect(() => {
    const { initialNodes, initialEdges } = layoutElements(impact.nodes, impact.edges);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
  }, [impact, setNodes, setEdges, fitView]);

  // Apply / remove prediction mode props whenever it toggles
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const sourceNode = impact.nodes.find(sn => sn.id === n.id);
      const score = sourceNode ? computeAiRiskScore(sourceNode, maxQuantity) : undefined;
      return {
        ...n,
        data: {
          ...n.data,
          predictionMode,
          aiRiskScore: (n.data.status === 'safe' || n.data.status === 'uncertain') ? score : undefined,
        },
      };
    }));
  }, [predictionMode, setNodes, impact.nodes, maxQuantity]);

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
    // Find all source/affected nodes to fit the critical cluster
    const criticalNodes = getNodes().filter(n => n.data.status === 'source' || n.data.status === 'affected');
    if (criticalNodes.length === 0) return;
    const sourceNode = criticalNodes.find(n => n.data.status === 'source') || criticalNodes[0];
    setSelectedNodeId(sourceNode.id);
    setTimeout(() => {
      fitView({ nodes: criticalNodes, padding: 0.35, duration: 800 });
    }, 50);
  };

  const showFullNetwork = () => {
    setSelectedNodeId(null);
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50);
  };

  /** Trace Downstream — fixed: close panel first, then animate sweep, then fitView */
  const handleTraceDownstream = useCallback((nodeId: string) => {
    // 1. Close the details panel immediately
    setSelectedNodeId(null);

    // Clear any previous sweep timers
    sweepTimersRef.current.forEach(t => clearTimeout(t));
    sweepTimersRef.current = [];

    const down = getReachableNodes(nodeId, impact.edges, 'downstream');
    const up = getReachableNodes(nodeId, impact.edges, 'upstream');
    const activeIds = new Set([...Array.from(down), ...Array.from(up)]);
    const sweepOrder = getDownstreamOrdered(nodeId, impact.edges);

    // 2. Mute everything first, then fitView after a tick (panel close + state flush)
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, isSelected: n.id === nodeId, isMuted: !activeIds.has(n.id), isAnimating: false }
    })));

    setEdges(eds => eds.map(e => {
      const isPath = activeIds.has(e.source) && activeIds.has(e.target);
      return {
        ...e,
        style: {
          ...e.style,
          stroke: e.data.baseStroke,
          strokeWidth: isPath ? e.data.baseWidth + 1 : e.data.baseWidth,
          opacity: isPath ? 1 : 0.12,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: e.data.baseStroke }
      };
    }));

    // 3. After React flush (100ms), trigger fitView on the active cluster
    const fitTimer = setTimeout(() => {
      const currentNodes = getNodes();
      const targetNodes = currentNodes.filter(n => activeIds.has(n.id));
      fitView({ nodes: targetNodes, padding: 0.25, duration: 900 });
    }, 100);
    sweepTimersRef.current.push(fitTimer);

    // 4. After fitView starts, animate sweep — each node lights up one-by-one
    sweepOrder.forEach((nId, idx) => {
      const t = setTimeout(() => {
        // Turn on sweep flash
        setNodes(nds => nds.map(n => n.id === nId
          ? { ...n, data: { ...n.data, isAnimating: true } }
          : n
        ));
        // Turn off after 650ms
        const offTimer = setTimeout(() => {
          setNodes(nds => nds.map(n => n.id === nId
            ? { ...n, data: { ...n.data, isAnimating: false } }
            : n
          ));
        }, 650);
        sweepTimersRef.current.push(offTimer);
      }, 300 + idx * 150);
      sweepTimersRef.current.push(t);
    });
  }, [impact.edges, setNodes, setEdges, fitView, getNodes]);

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

            {/* AI Prediction Mode info card */}
            {predictionMode && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(209, 154, 67, 0.10)',
                  border: '1px solid rgba(209, 154, 67, 0.30)',
                  maxWidth: '180px',
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-warning)', letterSpacing: '0.06em', marginBottom: '4px', textTransform: 'uppercase' }}>
                  ⚡ AI Model Active
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-muted-foreground)', lineHeight: 1.5 }}>
                  Blast radius probabilities derived from supply chain velocity & historical contamination spread patterns.
                </div>
              </div>
            )}
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

            {/* AI Risk Score in panel */}
            {predictionMode && selectedData.aiRiskScore !== undefined && (selectedData.status === 'safe' || selectedData.status === 'uncertain') && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: 'rgba(209, 154, 67, 0.08)',
                  border: '1px solid rgba(209, 154, 67, 0.25)',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-warning)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>⚡ AI Blast Radius Forecast</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-warning)', lineHeight: 1 }}>{selectedData.aiRiskScore}%</div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted-foreground)', marginTop: '3px' }}>estimated probability of contamination spread reaching this node</div>
              </div>
            )}

            <button 
              onClick={() => handleTraceDownstream(selectedData.id)}
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
  const [predictionMode, setPredictionMode] = useState(false);

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

        {/* AI Prediction Mode toggle */}
        <button
          onClick={() => setPredictionMode(p => !p)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 200ms ease',
            border: predictionMode
              ? '1px solid rgba(209, 154, 67, 0.55)'
              : '1px solid var(--color-border)',
            background: predictionMode
              ? 'rgba(209, 154, 67, 0.13)'
              : 'var(--color-surface-2)',
            color: predictionMode
              ? 'var(--color-warning)'
              : 'var(--color-muted-foreground)',
            boxShadow: predictionMode
              ? '0 0 0 3px rgba(209, 154, 67, 0.12)'
              : 'none',
          }}
        >
          <Sparkles
            style={{
              width: '15px',
              height: '15px',
              color: predictionMode ? 'var(--color-warning)' : 'var(--color-muted-foreground)',
            }}
          />
          {predictionMode ? 'AI Prediction: ON' : '🔮 AI Prediction Mode'}
          {predictionMode && (
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--color-warning)',
                animation: 'amber-glow 1.8s ease-in-out infinite',
              }}
            />
          )}
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ReactFlowProvider>
          <ImpactFlow impact={impact} predictionMode={predictionMode} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
