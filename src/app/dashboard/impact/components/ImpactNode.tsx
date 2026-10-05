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

export function ImpactNode({ data, id }: any) {
  // Read zoom level from ReactFlow store
  const zoom = useStore(state => state.transform[2]);
  
  const type = data.type as NodeType;
  const status = data.status as ClassificationStatus;
  const label = data.label as string;
  const isMuted = data.isMuted as boolean;
  const isSelected = data.isSelected as boolean;
  
  const Icon = icons[type] || Package;
  const styles = statusStyles[status] || statusStyles.not_relevant;
  
  const showDetail = zoom >= 0.7; // Intelligent zoom

  return (
    <div 
      className={cn(
        "relative rounded-xl border border-border bg-surface p-3 transition-all duration-300 min-w-[160px] cursor-pointer",
        isMuted ? "opacity-30 grayscale" : "opacity-100",
        isSelected ? "ring-2 ring-foreground shadow-lg scale-105" : "hover:border-muted-foreground shadow-sm",
        status !== 'not_relevant' && status !== 'safe' && !isMuted ? styles.bg : ''
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

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-muted-foreground/50 border-none" />
    </div>
  );
}
