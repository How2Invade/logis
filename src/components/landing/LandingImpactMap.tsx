/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ImpactNode } from '@/app/dashboard/impact/components/ImpactNode';
import { Play, RotateCcw, Map as MapIcon, Crosshair } from 'lucide-react';

const nodeTypes = {
  impactNode: ImpactNode,
};

function layoutElements(gnodes: any[], gedges: any[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 50, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const relevantNodes = gnodes.filter(n => n.status !== 'not_relevant' || n.type === 'supplier');
  const relevantNodeIds = new Set(relevantNodes.map(n => n.id));

  for (const node of relevantNodes) {
    g.setNode(node.id, { width: 180, height: 70 });
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
      position: { x: pos?.x - 90 || 0, y: pos?.y - 35 || 0 },
      data: {
        ...node,
        isSelected: false,
        isMuted: false,
        isAnimating: false,
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
        type: 'default',
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

function getDownstreamOrdered(startNodeId: string, edges: any[]): string[] {
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

function ImpactMapInner({ impact }: { impact: any }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const { fitView, setCenter, getNodes } = useReactFlow();
  const [isSimulating, setIsSimulating] = useState(false);
  const [traceProgress, setTraceProgress] = useState<number | null>(null);

  useEffect(() => {
    if (impact?.nodes && impact?.edges) {
      const { initialNodes, initialEdges } = layoutElements(impact.nodes, impact.edges);
      setNodes(initialNodes);
      setEdges(initialEdges);
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
    }
  }, [impact, setNodes, setEdges, fitView]);

  const focusIncident = () => {
    const sourceNode = nodes.find(n => n.data.status === 'source');
    if (sourceNode) {
      fitView({ nodes: [sourceNode], padding: 1.2, maxZoom: 1.5, duration: 800 });
    }
  };

  const showFullNetwork = () => {
    fitView({ padding: 0.2, duration: 800 });
  };

  const startSimulation = useCallback(() => {
    if (!impact || isSimulating) return;
    setIsSimulating(true);
    setTraceProgress(0);

    const sourceNode = impact.nodes.find((n: any) => n.status === 'source');
    if (!sourceNode) {
      setIsSimulating(false);
      setTraceProgress(null);
      return;
    }

    const uiSourceNode = nodes.find(n => n.id === sourceNode.id);
    if (uiSourceNode) {
      setCenter(uiSourceNode.position.x + 90, uiSourceNode.position.y + 35, { zoom: 1.5, duration: 500 });
    }

    const ordered = getDownstreamOrdered(sourceNode.id, impact.edges);
    let step = 0;

    // Wait for the initial zoom-in to finish, then start the slow zoom out + tracing
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 3000 }); // Slowly zoom out to full map

      const interval = setInterval(() => {
        if (step >= ordered.length) {
          clearInterval(interval);
          setTimeout(() => {
            setTraceProgress(null);
            setIsSimulating(false);
            // Optionally, we could turn off all glows here, but leaving them on
            // until the user interacts again makes them "lightly highlighted" as requested.
          }, 1500);
          return;
        }

        const currentNodeId = ordered[step];
        const progress = Math.round(((step + 1) / ordered.length) * 100);
        setTraceProgress(progress);

        setNodes(nds => nds.map(n => {
          if (n.id === currentNodeId) {
            return { ...n, data: { ...n.data, isAnimating: true } };
          }
          return n;
        }));

        step++;
      }, 50); // Slightly slower than 20ms to match the slow zoom-out feel
    }, 600);

  }, [impact, isSimulating, setNodes, fitView, setCenter, nodes]);

  return (
    <div className="absolute inset-0 group">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--color-border)" gap={24} />
        <Controls className="!bg-surface !border-border !shadow-sm !rounded-lg overflow-hidden [&>button]:!border-b-border [&>button]:!bg-transparent [&>button:hover]:!bg-surface-2" />
      </ReactFlow>

      {/* View Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button onClick={focusIncident} className="flex items-center gap-2 px-3 py-2 bg-surface/90 backdrop-blur-sm border border-border rounded-lg shadow-sm hover:bg-surface-2 transition-colors text-xs font-semibold text-foreground">
          <Crosshair className="w-3.5 h-3.5" /> Focus Incident
        </button>
        <button onClick={showFullNetwork} className="flex items-center gap-2 px-3 py-2 bg-surface/90 backdrop-blur-sm border border-border rounded-lg shadow-sm hover:bg-surface-2 transition-colors text-xs font-semibold text-foreground">
          <MapIcon className="w-3.5 h-3.5" /> Full Network
        </button>
      </div>

      {/* Simulation UI */}
      <div className="absolute top-4 left-4 z-10">
        <button 
          onClick={startSimulation}
          disabled={isSimulating}
          className="flex items-center gap-2 px-4 py-2 bg-surface/90 backdrop-blur-sm border border-border rounded-xl shadow-sm hover:border-primary/30 transition-all text-sm font-semibold disabled:opacity-50"
        >
          {isSimulating ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-primary" />}
          {isSimulating ? 'Simulating Impact...' : 'Simulate Impact Spread'}
        </button>
      </div>

      {traceProgress !== null && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-64 bg-surface/90 backdrop-blur-md rounded-full border border-border p-3 shadow-lg flex flex-col gap-2 items-center">
          <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">Tracing Spread... {traceProgress}%</div>
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-critical transition-all duration-300 ease-out" 
              style={{ width: `${traceProgress}%` }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function LandingImpactMap() {
  const [impactData, setImpactData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/incidents/INC-003/analyze', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data?.data) {
          setImpactData(data.data);
        }
      })
      .catch(console.error);
  }, []);

  if (!impactData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="skeleton w-12 h-12 rounded-full" />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ImpactMapInner impact={impactData} />
    </ReactFlowProvider>
  );
}
