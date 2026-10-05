import type { ReportData } from './data';
import { formatCurrency, formatNumber } from '@/lib/utils';

const W = 78;
const rule = (ch = '=') => ch.repeat(W);

function wrap(text: string, indent = '', width = W): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = indent;
  for (const w of words) {
    if ((line + w).length > width && line.trim().length > 0) {
      lines.push(line.trimEnd());
      line = indent + w + ' ';
    } else {
      line += w + ' ';
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.join('\n');
}

function section(title: string) {
  return `\n${rule()}\n${title}\n${rule()}\n`;
}

function kv(label: string, value: string, pad = 26) {
  return `  ${label.padEnd(pad, ' ')}${value}`;
}

function table(headers: string[], rows: string[][], align: ('l' | 'r')[]) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const fmt = (cells: string[]) =>
    '  ' + cells.map((c, i) => (align[i] === 'r' ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('   ');
  return [fmt(headers), '  ' + widths.map(w => '-'.repeat(w)).join('   '), ...rows.map(fmt)].join('\n');
}

function signed(n: number, fmt: (v: number) => string) {
  if (n === 0) return 'No change';
  return `${n > 0 ? '+' : '-'}${fmt(Math.abs(n))}`;
}

export function buildReportText(d: ReportData): string {
  const i = d.incident, im = d.impact, r = d.response, at = d.actionTracker, rc = d.recovery, sc = d.scenario;
  const generated = new Date(d.generatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const out: string[] = [];

  out.push(rule());
  out.push('LOGIS INCIDENT INTELLIGENCE REPORT');
  out.push(`${i.headline} - ${i.lotLabel}`);
  out.push(rule());
  out.push(kv('Incident', i.id));
  out.push(kv('Severity', i.severity.toUpperCase()));
  out.push(kv('Status', i.status.toUpperCase()));
  out.push(kv('Source', `${i.sourceName}${i.sourceId ? ` (${i.sourceId})` : ''}`));
  out.push(kv('Source lot', i.sourceLot));
  out.push(kv('Detected', new Date(i.detectedAt).toLocaleString('en-IN')));
  out.push(kv('Generated', generated));
  out.push(kv('Data', 'SYNTHETIC DEMONSTRATION DATA'));

  out.push(section('1. INCIDENT SUMMARY'));
  out.push(wrap(i.executiveSummary, '  '));
  out.push('');
  out.push(kv('Affected units', formatNumber(im.affectedUnits)));
  out.push(kv('Safe units', formatNumber(im.safeUnits)));
  out.push(kv('Needs verification', formatNumber(im.uncertainUnits)));
  out.push(kv('Estimated impact', formatCurrency(im.estimatedImpactINR)));
  out.push('');
  out.push('  KEY FINDINGS');
  i.keyFindings.forEach(f => out.push(wrap(f, '    ').replace(/^ {4}/, '  - ')));

  out.push(section('2. IMPACT ANALYSIS'));
  out.push(kv('Affected', formatNumber(im.affectedUnits)));
  out.push(kv('Safe', formatNumber(im.safeUnits)));
  out.push(kv('Needs verification', formatNumber(im.uncertainUnits)));
  out.push(kv('Already sold', formatNumber(im.soldUnits)));
  out.push(kv('Unaccounted', formatNumber(im.unaccountedUnits)));
  out.push(kv('Warehouses affected', String(im.affectedWarehouses)));
  out.push(kv('Stores affected', String(im.affectedStores)));
  out.push(kv('Shipments affected', String(im.affectedShipments)));
  out.push(kv('Affected batches', im.affectedBatches.join(', ')));
  out.push(kv('Uncertain batches', im.uncertainBatches.join(', ') || 'None'));
  out.push(kv('Network traced', `${im.network.nodes.length} nodes, ${im.network.edges.length} links`));
  out.push('');
  out.push('  FACILITY IMPACT');
  out.push(table(
    ['Facility', 'Affected', 'Safe', 'Uncertain'],
    im.facilities.map(f => [`${f.name} (${f.id})`, formatNumber(f.affected), formatNumber(f.safe), formatNumber(f.uncertain)]),
    ['l', 'r', 'r', 'r'],
  ));

  out.push(section('3. RECOMMENDED RESPONSE  [SIMULATED VALUES]'));
  out.push(table(
    ['', 'Naive broad recall', 'LOGIS targeted'],
    [
      ['Units recalled', formatNumber(r.naive.totalUnits), formatNumber(r.logis.totalUnits)],
      ['Estimated cost', formatCurrency(r.naive.totalCost), formatCurrency(r.logis.totalCost)],
      ['Response time', `${r.naive.estimatedTimeHours} h`, `${r.logis.estimatedTimeHours} h`],
      ['Disruption score', String(r.naive.disruptionScore), String(r.logis.disruptionScore)],
    ],
    ['l', 'r', 'r'],
  ));
  out.push('');
  out.push(kv('Unnecessary recalls avoided', formatNumber(r.unnecessaryRecallAvoided), 30));
  out.push(kv('Estimated savings', formatCurrency(r.costSaved), 30));
  out.push(kv('Risk score', `${r.riskScore} / 100 (${r.riskLevel.toUpperCase()})`, 30));

  out.push(section('4. RESPONSE EXECUTION'));
  out.push(kv('Progress', `${at.completed} / ${at.total} completed (${at.progressPercent}%)`));
  out.push(kv('Critical remaining', String(at.remainingCritical)));
  out.push(kv('High remaining', String(at.remainingHigh)));
  out.push(kv('Medium remaining', String(at.remainingMedium)));
  out.push('');
  out.push('  WORKSTREAMS');
  out.push(table(
    ['Workstream', 'Actions', 'Done', 'Units', 'Est. cost'],
    at.byType.map(t => [t.label, String(t.total), String(t.completed), formatNumber(t.units), formatCurrency(t.cost)]),
    ['l', 'r', 'r', 'r', 'r'],
  ));
  out.push('');
  out.push('  ACTION TRACKER');
  at.actions.forEach(a => {
    const box = a.completed ? '[x]' : '[ ]';
    out.push(`  ${box} ${a.id}  ${a.description}`);
    const meta = a.completed
      ? `Completed${a.completedAt ? ` - ${a.completedAt}` : ''}${a.owner ? ` - ${a.owner}` : ''}`
      : `Owner: ${a.owner || 'Unassigned'} - Priority: ${(a.priorityLevel || 'medium').toUpperCase()}`;
    out.push(`        ${meta} - ${formatNumber(a.units || 0)} units - ${formatCurrency(a.estimatedCost || 0)}`);
  });

  out.push(section('5. RECOVERY & RESOURCE OPTIMIZATION'));
  out.push(kv('Idle machines', String(rc.idleMachines)));
  out.push(kv('Available workers', String(rc.availableWorkers)));
  out.push(kv('Free storage (slots)', formatNumber(rc.freeStorage)));
  out.push(kv('Available trucks', String(rc.availableTrucks)));
  out.push('');
  out.push('  UNMET DEMAND');
  out.push(table(
    ['Product', 'Demand', 'Supply', 'Gap', 'Value at risk'],
    rc.unmetDemand.map(u => [u.productName, formatNumber(u.demandUnits), formatNumber(u.currentCapacity), formatNumber(u.gap), formatCurrency(u.totalValue)]),
    ['l', 'r', 'r', 'r', 'r'],
  ));
  out.push('');
  out.push('  PROPOSED ALLOCATIONS');
  rc.allocations.forEach(a => {
    out.push(`  - ${a.resourceName} -> ${a.targetProductName}`);
    out.push(`      Capacity ${formatNumber(a.capacityUsed)} units/day - Expected benefit ${formatCurrency(a.expectedBenefit)} - Delay reduction ${a.expectedDelayReduction} h`);
  });
  out.push('');
  out.push(kv('Potential recovery value', formatCurrency(rc.potentialRecoveryValue)));
  out.push(kv('Idle resources', `${rc.idleBefore} -> ${rc.idleAfter}`));
  out.push(kv('Recovery cost', formatCurrency(rc.estimatedCost)));
  out.push(kv('Recovery time', `${rc.estimatedRecoveryTimeHours} h`));

  out.push(section('6. SCENARIO ANALYSIS'));
  sc.presets.forEach(p => out.push(`  ${p.id === sc.activeId ? '(*)' : '( )'} ${p.title} - ${p.description}`));
  out.push('');
  out.push(kv('Active scenario', sc.activeTitle));
  out.push('');
  const b = sc.baseline, s = sc.scenario;
  out.push(table(
    ['Metric', 'Baseline', 'Scenario', 'Change'],
    [
      ['Affected units', formatNumber(b.affectedUnits), formatNumber(s.affectedUnits), signed(s.affectedUnits - b.affectedUnits, formatNumber)],
      ['Safe units', formatNumber(b.safeUnits), formatNumber(s.safeUnits), signed(s.safeUnits - b.safeUnits, formatNumber)],
      ['Uncertain units', formatNumber(b.uncertainUnits), formatNumber(s.uncertainUnits), signed(s.uncertainUnits - b.uncertainUnits, formatNumber)],
      ['Response cost', formatCurrency(b.responseCost), formatCurrency(s.responseCost), signed(s.responseCost - b.responseCost, formatCurrency)],
      ['Response time', `${b.responseTimeHours} h`, `${s.responseTimeHours} h`, signed(s.responseTimeHours - b.responseTimeHours, v => `${v} h`)],
    ],
    ['l', 'r', 'r', 'r'],
  ));

  out.push(section('CONCLUSION'));
  out.push('  TRACE -> ASSESS -> RESPOND -> RECOVER');
  out.push('');
  out.push(wrap(
    `LOGIS traced ${im.network.nodes.length} supply-chain entities from lot ${i.sourceLot}, isolated ${formatNumber(im.affectedUnits)} affected units from ${formatNumber(im.safeUnits)} safe units, ` +
    `and replaced a ${formatNumber(r.naive.totalUnits)}-unit broad recall with a ${formatNumber(r.logis.totalUnits)}-unit targeted response. ` +
    `Idle capacity has been redirected to recover up to ${formatCurrency(rc.potentialRecoveryValue)} of unmet demand.`,
    '  ',
  ));
  out.push('');
  out.push(rule('-'));
  out.push('Synthetic Demonstration Data - generated by LOGIS');
  out.push(rule('-'));
  return out.join('\n') + '\n';
}
