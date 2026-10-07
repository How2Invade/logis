import { Handle, Position, useStore } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { ClassificationStatus, NodeType } from '@/lib/types';
import { Package, Truck, Store, MapPin, Database, Factory, Users, Milk, AlertTriangle } from 'lucide-react';

const icons: Record<NodeType, React.ElementType> = {
  supplier: Database,
  material: Milk,
  lot: Milk,
  batch: Factory,
  product: Package,
  warehouse: MapPin,
  shipment: Truck,
  store: Store,
  customer: Users,
};

const statusStyles: Record<string, { ring: string; dot: string; bg: string }> = {
  source: { ring: 'ring-critical', dot: 'bg-critical', bg: 'bg-critical/10' },
  affected: { ring: 'ring-critical', dot: 'bg-critical', bg: 'bg-critical/5' },
  uncertain: { ring: 'ring-warning', dot: 'bg-warning', bg: 'bg-warning/5' },
  safe: { ring: 'ring-success', dot: 'bg-success', bg: 'bg-success/5' },
  sold: { ring: 'ring-muted-foreground', dot: 'bg-muted-foreground', bg: 'bg-surface-2' },
  unaccounted: { ring: 'ring-primary', dot: 'bg-primary', bg: 'bg-primary/5' },
  not_relevant: { ring: 'ring-border', dot: 'bg-border', bg: 'bg-surface' },
};

function getRiskBadgeStyle(score: number): React.CSSProperties {
  if (score > 70) return { background: 'rgba(209, 154, 67, 0.18)', color: 'var(--color-warning)', border: '1px solid rgba(209, 154, 67, 0.45)' };
  if (score > 40) return { background: 'rgba(209, 154, 67, 0.10)', color: 'var(--color-warning)', border: '1px solid rgba(209, 154, 67, 0.28)', opacity: 0.85 };
  return { background: 'rgba(111, 166, 135, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(111, 166, 135, 0.4)' };
}

export function ImpactNode({ data, id }: any) {
  // Read zoom level from ReactFlow store
  const zoom = useStore(state => state.transform[2]);
  
  const type = data.type as NodeType;
  const status = data.status as ClassificationStatus;
  const label = data.label as string;
  const isMuted = data.isMuted as boolean;
  const isSelected = data.isSelected as boolean;
  const isAnimating = data.isAnimating as boolean;
  const aiRiskScore = data.aiRiskScore as number | undefined;
  const predictionMode = data.predictionMode as boolean;
  
  const Icon = icons[type] || Package;
  const styles = statusStyles[status] || statusStyles.not_relevant;
  
  const showDetail = zoom >= 0.7; // Intelligent zoom

  // Amber glow applies to uncertain nodes when prediction mode is active
  const showAmberGlow = predictionMode && status === 'uncertain' && !isMuted;

  // Show risk badge for safe/uncertain nodes in prediction mode
  const showRiskBadge = predictionMode && aiRiskScore !== undefined && (status === 'safe' || status === 'uncertain') && !isMuted && showDetail;

  return (
    <div 
      className={cn(
        "relative rounded-xl border border-border bg-surface p-3 transition-all duration-300 min-w-[160px] cursor-pointer",
        isMuted ? "opacity-30 grayscale" : "opacity-100",
        isSelected ? "ring-2 ring-foreground shadow-lg scale-105" : "hover:border-muted-foreground shadow-sm",
        status !== 'not_relevant' && status !== 'safe' && !isMuted ? styles.bg : '',
        isAnimating ? 'node-sweep' : '',
        showAmberGlow ? 'node-amber-glow' : '',
      )}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-muted-foreground/50 border-none" />
      
      <div className="flex items-center gap-3">
        <div className={cn("w-2 h-2 rounded-full shrink-0", styles.dot, isSelected && "animate-pulse")} />
        <div className="flex-1 overflow-hidden">
          <div className="text-[13px] font-semibold text-foreground truncate">{label}</div>
          {showDetail && (
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest mt-1 flex items-center gap-1">
              <Icon className="w-3 h-3" /> {type}
            </div>
          )}
        </div>
      </div>
      
      {showDetail && status === 'source' && (
        <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-critical text-critical-fg flex items-center justify-center animate-bounce shadow-md">
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
      )}

      {/* AI Risk Score Badge */}
      {showRiskBadge && (
        <div
          style={{
            ...getRiskBadgeStyle(aiRiskScore!),
            position: 'absolute',
            bottom: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            padding: '2px 7px',
            borderRadius: '999px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {aiRiskScore}% risk
        </div>
      )}

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-muted-foreground/50 border-none" />
    </div>
  );
}
