import type {
  Incident, ImpactResult, ResponsePlan, RecoveryResult, ScenarioResult, GraphNode, GraphEdge, FacilityImpact,
} from '@/lib/types';
import { loadTrackedActions, toTrackedActions, type TrackedAction } from '@/lib/actionTracker';
import { SCENARIO_PRESETS, loadActiveScenarioId, type ScenarioPreset } from '@/lib/scenarios';
import { formatCurrency, formatNumber } from '@/lib/utils';

/**
 * Single source of truth for every report export (PDF / JSON / TXT).
 * All numbers come from the same API endpoints and client state the dashboard pages use.
 */

export interface ReportData {
  generatedAt: string;
  dataType: 'synthetic_demo';
  incident: {
    id: string;
    title: string;
    headline: string;
    lotLabel: string;
    type: string;
    severity: string;
    status: string;
    sourceLot: string;
    sourceName: string;
    sourceId: string;
    location: string;
    detectedAt: string;
    description: string;
    executiveSummary: string;
    keyFindings: string[];
  };
  impact: {
    affectedUnits: number;
    safeUnits: number;
    uncertainUnits: number;
    soldUnits: number;
    unaccountedUnits: number;
    totalUnits: number;
    estimatedImpactINR: number;
    affectedWarehouses: number;
    affectedStores: number;
    affectedShipments: number;
    affectedBatches: string[];
    uncertainBatches: string[];
    affectedProducts: { id: string; name: string; status: string }[];
    facilities: FacilityImpact[];
    network: { nodes: GraphNode[]; edges: GraphEdge[] };
  };
  response: {
    riskScore: number;
    riskLevel: string;
    naive: ResponsePlan['comparison']['naive'];
    logis: ResponsePlan['comparison']['logis'];
    unnecessaryRecallAvoided: number;
    costSaved: number;
    simulated: true;
  };
  actionTracker: {
    source: 'live_tracker' | 'generated_plan';
    total: number;
    completed: number;
    progressPercent: number;
    remainingCritical: number;
    remainingHigh: number;
    remainingMedium: number;
    byType: { type: string; label: string; total: number; completed: number; units: number; cost: number; priority: string }[];
    actions: TrackedAction[];
  };
  recovery: {
    idleMachines: number;
    availableWorkers: number;
    freeStorage: number;
    availableTrucks: number;
    unmetDemand: RecoveryResult['unmetDemand'];
    allocations: RecoveryResult['allocations'];
    idleBefore: number;
    idleAfter: number;
    estimatedCost: number;
    estimatedRecoveryTimeHours: number;
    potentialRecoveryValue: number;
  };
  scenario: {
    presets: { id: string; title: string; description: string }[];
    activeId: string;
    activeTitle: string;
    activeDescription: string;
    selectedInSimulator: boolean;
    baseline: ScenarioMetrics;
    scenario: ScenarioMetrics;
  };
}

export interface ScenarioMetrics {
  affectedUnits: number;
  safeUnits: number;
  uncertainUnits: number;
  responseCost: number;
  responseTimeHours: number;
  responseActions: number;
  recoveryValue: number;
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  stop_shipment: 'Stop shipments',
  quarantine: 'Quarantine inventory',
  withdraw: 'Withdraw from stores',
  recall: 'Customer recall',
  verify: 'Verify uncertain stock',
  reconcile: 'Reconcile unaccounted',
  notify: 'Notify stakeholders',
};

async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Request failed: ${url} (${res.status})`);
  const json = await res.json();
  if (!json?.data) throw new Error(`Invalid response from ${url}`);
  return json.data as T;
}

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function scenarioMetrics(x: ScenarioResult['baseline']): ScenarioMetrics {
  return {
    affectedUnits: x.impact.affectedUnits,
    safeUnits: x.impact.safeUnits,
    uncertainUnits: x.impact.uncertainUnits,
    responseCost: x.response.comparison.logis.totalCost,
    responseTimeHours: x.response.comparison.logis.estimatedTimeHours,
    responseActions: x.response.actions.length,
    recoveryValue: x.recovery.potentialRecoveryValue,
  };
}

export async function buildReportData(incidentId: string): Promise<ReportData> {
  const incRes = await fetch(`/api/incidents`);
  if (!incRes.ok) throw new Error('Failed to load incidents');
  const incidents: Incident[] = (await incRes.json()).data || [];
  const inc = incidents.find(i => i.id === incidentId);
  if (!inc) throw new Error(`Incident ${incidentId} not found`);

  const active = loadActiveScenarioId();
  const preset = SCENARIO_PRESETS.find(p => p.id === active.id) as ScenarioPreset;

  const [impact, plan, recovery, scenario] = await Promise.all([
    postJSON<ImpactResult>(`/api/incidents/${incidentId}/analyze`),
    postJSON<ResponsePlan>(`/api/incidents/${incidentId}/response`),
    postJSON<RecoveryResult>(`/api/incidents/${incidentId}/recovery`),
    postJSON<ScenarioResult>(`/api/scenarios/simulate`, { incidentId, modifiers: preset.modifiers }),
  ]);

  // ---------- Incident ----------
  const [headlineRaw, lotRaw] = inc.title.split(/\s+[—-]\s+/);
  const headline = (headlineRaw || inc.title).toUpperCase();
  const lotLabel = lotRaw || `Lot ${inc.sourceLot}`;
  const locMatch = (inc.location || '').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const sourceName = locMatch ? locMatch[1] : inc.location;
  const sourceId = locMatch ? locMatch[2] : '';

  // ---------- Impact ----------
  const nodes = impact.nodes;
  const affectedBatches = nodes.filter(n => n.type === 'batch' && n.status === 'affected').map(n => n.id);
  const uncertainBatches = nodes.filter(n => n.type === 'batch' && n.status === 'uncertain').map(n => n.id);
  const affectedProducts = nodes
    .filter(n => n.type === 'product' && (n.status === 'affected' || n.status === 'uncertain'))
    .map(n => ({ id: n.id, name: n.label, status: n.status }));
  const facilities = (impact.facilityBreakdown || []).filter(f => f.affected + f.safe + f.uncertain > 0);

  // ---------- Action tracker ----------
  const live = loadTrackedActions();
  const actions: TrackedAction[] = live ?? toTrackedActions(plan.actions);
  const completed = actions.filter(a => a.completed).length;
  const total = actions.length;
  const typeOrder = Array.from(new Set(actions.map(a => a.type)));
  const byType = typeOrder.map(type => {
    const list = actions.filter(a => a.type === type);
    const top = list.reduce((m, a) => Math.min(m, a.priority), Infinity);
    return {
      type,
      label: ACTION_TYPE_LABELS[type] || titleCase(type),
      total: list.length,
      completed: list.filter(a => a.completed).length,
      units: list.reduce((s, a) => s + (a.units || 0), 0),
      cost: list.reduce((s, a) => s + (a.estimatedCost || 0), 0),
      priority: list[0]?.priorityLevel || (top <= 1 ? 'critical' : top <= 2 ? 'high' : 'medium'),
    };
  });

  const actionTracker: ReportData['actionTracker'] = {
    source: live ? 'live_tracker' : 'generated_plan',
    total,
    completed,
    progressPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
    remainingCritical: actions.filter(a => a.priorityLevel === 'critical' && !a.completed).length,
    remainingHigh: actions.filter(a => a.priorityLevel === 'high' && !a.completed).length,
    remainingMedium: actions.filter(a => a.priorityLevel === 'medium' && !a.completed).length,
    byType,
    actions,
  };

  // ---------- Recovery ----------
  const idle = recovery.idleResources;
  const rec: ReportData['recovery'] = {
    idleMachines: idle.filter(r => r.type === 'machine').length,
    availableWorkers: idle.filter(r => r.type === 'worker').length,
    freeStorage: idle.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + r.capacity, 0),
    availableTrucks: idle.filter(r => r.type === 'truck').length,
    unmetDemand: recovery.unmetDemand,
    allocations: recovery.allocations,
    idleBefore: recovery.idleBefore,
    idleAfter: recovery.idleAfter,
    estimatedCost: recovery.estimatedCost,
    estimatedRecoveryTimeHours: recovery.estimatedRecoveryTimeHours,
    potentialRecoveryValue: recovery.potentialRecoveryValue,
  };

  // ---------- Narrative (derived strictly from the data above) ----------
  const c = plan.comparison;
  const detected = new Date(inc.detectedAt);
  const detectedStr = detected.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const stopShipments = actions.filter(a => a.type === 'stop_shipment').length;
  const affectedPct = impact.totalUnits ? Math.round((impact.affectedUnits / impact.totalUnits) * 100) : 0;

  const executiveSummary =
    `On ${detectedStr}, an inspection at ${sourceName}${sourceId ? ` (${sourceId})` : ''} detected ${headline.toLowerCase()} in source lot ${inc.sourceLot}. ` +
    `LOGIS traced the lot through ${affectedBatches.length + uncertainBatches.length} production batches to ${impact.affectedWarehouses} warehouses and ${impact.affectedStores} retail stores, ` +
    `classifying ${formatNumber(impact.affectedUnits)} units as affected, ${formatNumber(impact.uncertainUnits)} as needing verification and ${formatNumber(impact.safeUnits)} as safe. ` +
    `The recommended targeted response covers ${formatNumber(c.logis.totalUnits)} units instead of ${formatNumber(c.naive.totalUnits)} under a broad recall, avoiding ${formatNumber(c.unnecessaryRecallAvoided)} unnecessary recalls (simulated). ` +
    `Response execution stands at ${completed} of ${total} actions completed (${actionTracker.progressPercent}%).`;

  const keyFindings = [
    `${formatNumber(impact.affectedUnits)} units (${affectedPct}% of traced inventory) are confirmed affected across ${impact.affectedWarehouses} warehouses and ${impact.affectedStores} stores; estimated product impact ${formatCurrency(impact.estimatedImpactINR)}.`,
    `${affectedBatches.length} batches are affected (${affectedBatches.join(', ')})${uncertainBatches.length ? ` and ${uncertainBatches.length} require verification (${uncertainBatches.join(', ')})` : ''}, all linked to lot ${inc.sourceLot}.`,
    `${impact.affectedShipments} shipments carried product from these batches; ${stopShipments} in-transit shipments must be stopped.`,
    `${formatNumber(impact.soldUnits)} units have already been sold and require a customer recall; ${formatNumber(impact.unaccountedUnits)} units are unaccounted for and need reconciliation.`,
    `A targeted response avoids ${formatNumber(c.unnecessaryRecallAvoided)} unnecessary recalls and saves an estimated ${formatCurrency(c.costSaved)} versus a broad recall (simulated).`,
  ];

  return {
    generatedAt: new Date().toISOString(),
    dataType: 'synthetic_demo',
    incident: {
      id: inc.id,
      title: inc.title,
      headline,
      lotLabel,
      type: inc.type,
      severity: inc.severity,
      status: inc.status,
      sourceLot: inc.sourceLot,
      sourceName,
      sourceId,
      location: inc.location,
      detectedAt: inc.detectedAt,
      description: inc.description,
      executiveSummary,
      keyFindings,
    },
    impact: {
      affectedUnits: impact.affectedUnits,
      safeUnits: impact.safeUnits,
      uncertainUnits: impact.uncertainUnits,
      soldUnits: impact.soldUnits,
      unaccountedUnits: impact.unaccountedUnits,
      totalUnits: impact.totalUnits,
      estimatedImpactINR: impact.estimatedImpactINR,
      affectedWarehouses: impact.affectedWarehouses,
      affectedStores: impact.affectedStores,
      affectedShipments: impact.affectedShipments,
      affectedBatches,
      uncertainBatches,
      affectedProducts,
      facilities,
      network: { nodes: impact.nodes, edges: impact.edges },
    },
    response: {
      riskScore: plan.riskScore,
      riskLevel: plan.riskLevel,
      naive: c.naive,
      logis: c.logis,
      unnecessaryRecallAvoided: c.unnecessaryRecallAvoided,
      costSaved: c.costSaved,
      simulated: true,
    },
    actionTracker,
    recovery: rec,
    scenario: {
      presets: SCENARIO_PRESETS.map(p => ({ id: p.id, title: p.title, description: p.description })),
      activeId: preset.id,
      activeTitle: preset.title,
      activeDescription: preset.description,
      selectedInSimulator: active.selectedInSimulator,
      baseline: scenarioMetrics(scenario.baseline),
      scenario: scenarioMetrics(scenario.scenario),
    },
  };
}

/** JSON export payload (network graph omitted — it is large and not report content). */
export function toReportJSON(d: ReportData) {
  const { network, ...impact } = d.impact;
  return {
    incident: d.incident,
    impact: { ...impact, networkSummary: { nodes: network.nodes.length, edges: network.edges.length } },
    response: d.response,
    actionTracker: d.actionTracker,
    recovery: d.recovery,
    scenario: d.scenario,
    generatedAt: d.generatedAt,
    dataType: d.dataType,
  };
}

export function reportFileBase(d: ReportData) {
  return `LOGIS_${d.incident.id.replace(/-/g, '')}_Report`;
}

export function downloadFile(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
