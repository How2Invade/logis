export type NodeKind = 'supplier' | 'plant' | 'warehouse' | 'store';
export type ImpactTone = 'affected' | 'uncertain' | 'safe';
export type ViewMode = 'logis' | 'naive';

export interface UnitSplit {
  affected: number;
  uncertain: number;
  safe: number;
  naiveRecall: number;
}

export interface StockLine {
  label: string;
  product: string;
  batch: string;
  units: number;
  status: string;
  received: boolean;
}

export interface MapNode {
  id: string;
  kind: NodeKind;
  name: string;
  location: string;
  units: UnitSplit;
  stock: StockLine[];
  isSource: boolean;
  cold?: boolean;
}

export interface MapShipment {
  id: string;
  batchId: string;
  product: string;
  origin: string;
  destination: string;
  quantity: number;
  eta: string;
  impact: ImpactTone;
}

export interface NetworkMap {
  incident: { id: string; title: string; sourceLot: string; severity: string };
  nodes: MapNode[];
  edges: Array<{ from: string; to: string }>;
  shipments: MapShipment[];
  totals: {
    affected: number;
    uncertain: number;
    safe: number;
    sold: number;
    logisUnits: number;
    naiveUnits: number;
    logisCost: number;
    naiveCost: number;
    costSaved: number;
    unitsSaved: number;
  };
  hiddenStores: number;
  isDemo: boolean;
}
