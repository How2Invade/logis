// GET /api/analytics — EDA stats, ML risk score, trend data
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

function getDb() {
  const db = new Database(path.join(process.cwd(), 'logis.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function GET() {
  const db = getDb();
  try {
    // --- Incident stats ---
    const incidents = db.prepare('SELECT * FROM incidents ORDER BY created_at ASC').all() as any[];
    const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    const typeBreakdown: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};
    const incidentsByMonth: Record<string, number> = {};

    for (const inc of incidents) {
      const s = inc.severity as keyof typeof severityBreakdown;
      if (s in severityBreakdown) severityBreakdown[s]++;
      typeBreakdown[inc.type] = (typeBreakdown[inc.type] ?? 0) + 1;
      statusBreakdown[inc.status] = (statusBreakdown[inc.status] ?? 0) + 1;
      const month = (inc.detected_at ?? inc.created_at ?? '').slice(0, 7);
      if (month) incidentsByMonth[month] = (incidentsByMonth[month] ?? 0) + 1;
    }

    // --- Lot / batch stats ---
    const lots = db.prepare('SELECT quantity FROM lots').all() as any[];
    const lotQtys = lots.map((l) => Number(l.quantity)).filter(Boolean).sort((a, b) => a - b);
    const lotMean = lotQtys.length ? lotQtys.reduce((s, v) => s + v, 0) / lotQtys.length : 0;
    const lotStats = {
      count: lotQtys.length,
      mean: Math.round(lotMean),
      median: Math.round(percentile(lotQtys, 50)),
      p75: Math.round(percentile(lotQtys, 75)),
      p95: Math.round(percentile(lotQtys, 95)),
      stdDev: Math.round(stdDev(lotQtys, lotMean)),
      total: lotQtys.reduce((s, v) => s + v, 0),
    };

    // --- Inventory stats ---
    const invRows = db.prepare('SELECT quantity, status FROM inventory').all() as any[];
    const invTotal = invRows.reduce((s: number, r: any) => s + r.quantity, 0);
    const invAvailable = invRows
      .filter((r: any) => r.status === 'available')
      .reduce((s: number, r: any) => s + r.quantity, 0);

    // --- Inspection stats (data quality proxy) ---
    const inspections = db.prepare('SELECT result FROM inspections').all() as any[];
    const passCount = inspections.filter((i: any) => i.result === 'pass').length;
    const failCount = inspections.filter((i: any) => i.result === 'fail').length;
    const dataQualityScore = inspections.length
      ? Math.round((passCount / inspections.length) * 100)
      : 100;

    // --- Product / batch diversity ---
    const productCount = (db.prepare('SELECT COUNT(DISTINCT id) as c FROM products').get() as any)?.c ?? 0;
    const batchCount = (db.prepare('SELECT COUNT(*) as c FROM batches').get() as any)?.c ?? 0;
    const supplierCount = (db.prepare('SELECT COUNT(*) as c FROM suppliers').get() as any)?.c ?? 0;
    const warehouseCount = (db.prepare('SELECT COUNT(*) as c FROM warehouses').get() as any)?.c ?? 0;
    const storeCount = (db.prepare('SELECT COUNT(*) as c FROM stores').get() as any)?.c ?? 0;
    const shipmentCount = (db.prepare('SELECT COUNT(*) as c FROM shipments').get() as any)?.c ?? 0;

    // --- Sales trend (monthly) ---
    const salesRows = db.prepare('SELECT sold_at, quantity FROM sales ORDER BY sold_at ASC').all() as any[];
    const salesByMonth: Record<string, number> = {};
    for (const s of salesRows) {
      const month = (s.sold_at ?? '').slice(0, 7);
      if (month) salesByMonth[month] = (salesByMonth[month] ?? 0) + s.quantity;
    }

    // --- ML Risk Score for most critical active incident ---
    const criticalInc = incidents.find(
      (i) => i.status !== 'resolved' && i.severity === 'critical'
    ) ?? incidents.find((i) => i.status !== 'resolved') ?? incidents[0];

    let riskScore = 0;
    let riskFactors: Array<{ label: string; weight: number; value: string }> = [];

    if (criticalInc) {
      const severityWeights: Record<string, number> = { critical: 1, high: 0.75, medium: 0.5, low: 0.25 };
      const sw = severityWeights[criticalInc.severity] ?? 0.5;

      // affected inventory fraction
      const affectedInv = invRows
        .filter((r: any) => r.status === 'quarantined' || r.status === 'on_hold')
        .reduce((s: number, r: any) => s + r.quantity, 0);
      const affectedFrac = invTotal > 0 ? Math.min(affectedInv / invTotal, 1) : sw * 0.5;

      // facility spread (warehouses with quarantined stock)
      const spreadRows = db
        .prepare(
          "SELECT COUNT(DISTINCT location_id) as c FROM inventory WHERE status IN ('quarantined','on_hold')"
        )
        .get() as any;
      const spreadFrac = warehouseCount > 0 ? Math.min((spreadRows?.c ?? 1) / warehouseCount, 1) : 0.5;

      // data quality risk (more failures = higher risk)
      const dqRisk = 1 - dataQualityScore / 100;

      riskScore = Math.round(
        (sw * 35 + affectedFrac * 30 + spreadFrac * 25 + dqRisk * 10)
      );

      riskFactors = [
        { label: 'Severity Level', weight: 35, value: `${criticalInc.severity} (${Math.round(sw * 35)}/35)` },
        { label: 'Inventory Exposure', weight: 30, value: `${Math.round(affectedFrac * 100)}% affected (${Math.round(affectedFrac * 30)}/30)` },
        { label: 'Facility Spread', weight: 25, value: `${spreadRows?.c ?? 1} nodes (${Math.round(spreadFrac * 25)}/25)` },
        { label: 'Data Quality Risk', weight: 10, value: `${dataQualityScore}% pass rate (${Math.round(dqRisk * 10)}/10)` },
      ];
    }

    // --- Outlier incidents (affected > p75 lot quantity — used as proxy) ---
    const p75Lot = percentile(lotQtys, 75);
    const outlierLots = lots.filter((l) => Number(l.quantity) > p75Lot * 2).length;

    // --- Month trend arrays (sorted) ---
    const allMonths = Array.from(
      new Set([...Object.keys(incidentsByMonth), ...Object.keys(salesByMonth)])
    ).sort();

    const incidentTrend = allMonths.map((m) => ({
      month: m,
      incidents: incidentsByMonth[m] ?? 0,
      sales: Math.round((salesByMonth[m] ?? 0) / 1000),
    }));

    return NextResponse.json({
      data: {
        incidentStats: {
          total: incidents.length,
          severityBreakdown,
          typeBreakdown,
          statusBreakdown,
        },
        lotStats,
        inventoryStats: {
          total: invTotal,
          available: invAvailable,
          availabilityPct: invTotal > 0 ? Math.round((invAvailable / invTotal) * 100) : 100,
        },
        dataQuality: {
          score: dataQualityScore,
          passCount,
          failCount,
          totalInspections: inspections.length,
          outlierLots,
        },
        networkStats: {
          productCount,
          batchCount,
          supplierCount,
          warehouseCount,
          storeCount,
          shipmentCount,
        },
        mlRisk: {
          score: riskScore,
          label:
            riskScore >= 80 ? 'Critical' : riskScore >= 60 ? 'High' : riskScore >= 40 ? 'Moderate' : 'Low',
          incidentId: criticalInc?.id ?? null,
          incidentTitle: criticalInc?.title ?? null,
          factors: riskFactors,
        },
        trend: incidentTrend,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: { code: 'ANALYTICS_ERROR', message: err.message } }, { status: 500 });
  } finally {
    db.close();
  }
}
