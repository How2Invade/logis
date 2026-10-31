'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadialBarChart, RadialBar,
} from 'recharts';
import {
  TrendingUp, Database, ShieldCheck, Activity, AlertTriangle,
  CheckCircle2, PackageCheck, Truck, Info,
} from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

interface AnalyticsData {
  incidentStats: {
    total: number;
    severityBreakdown: Record<string, number>;
    typeBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
  };
  lotStats: {
    count: number; mean: number; median: number; p75: number;
    p95: number; stdDev: number; total: number;
  };
  inventoryStats: { total: number; available: number; availabilityPct: number };
  dataQuality: {
    score: number; passCount: number; failCount: number;
    totalInspections: number; outlierLots: number;
  };
  networkStats: {
    productCount: number; batchCount: number; supplierCount: number;
    warehouseCount: number; storeCount: number; shipmentCount: number;
  };
  mlRisk: {
    score: number; label: string;
    incidentId: string | null; incidentTitle: string | null;
    factors: Array<{ label: string; weight: number; value: string }>;
  };
  trend: Array<{ month: string; incidents: number; sales: number }>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-warning)',
  medium: 'var(--color-primary)',
  low: 'var(--color-success)',
};

const TYPE_COLORS = [
  'var(--color-critical)', 'var(--color-warning)', 'var(--color-success)',
  'var(--color-primary)', 'var(--color-muted-foreground)',
];

function RiskGauge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? 'var(--color-critical)' :
    score >= 60 ? 'var(--color-warning)' :
    score >= 40 ? 'var(--color-primary)' :
    'var(--color-success)';

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const arcLen = circumference * 0.75;
  const filled = arcLen * (score / 100);

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg viewBox="0 0 140 120" className="w-36 h-[104px]">
        <path
          d="M 15 105 A 54 54 0 1 1 125 105"
          fill="none" stroke="var(--color-border)" strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 15 105 A 54 54 0 1 1 125 105"
          fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={`${filled} ${arcLen - filled}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="70" y="80" textAnchor="middle"
          className="tabular-nums" fontSize="28" fontWeight="700"
          fill="var(--color-foreground)"
        >
          {score}
        </text>
        <text x="70" y="100" textAnchor="middle" fontSize="11"
          fill="var(--color-muted-foreground)"
        >
          / 100
        </text>
      </svg>
      <span
        className="text-[13px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border"
        style={{ color, borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        {label} Risk
      </span>
    </div>
  );
}

function InsightCard({ icon: Icon, title, body, tone }: {
  icon: React.ElementType; title: string; body: string;
  tone: 'success' | 'warning' | 'critical' | 'info';
}) {
  const colors = {
    success: 'text-success border-success/25 bg-success/8',
    warning: 'text-warning border-warning/25 bg-warning/8',
    critical: 'text-critical border-critical/25 bg-critical/8',
    info: 'text-primary border-primary/25 bg-primary/8',
  };
  return (
    <div className={cn('rounded-xl border p-4 flex gap-3', colors[tone])}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <div className="text-[12px] font-bold uppercase tracking-widest mb-0.5">{title}</div>
        <div className="text-[13px] text-foreground leading-snug">{body}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="text-[26px] font-semibold tabular-nums text-foreground leading-none">{typeof value === 'number' ? formatNumber(value) : value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="text-sm font-medium text-muted-foreground">Running EDA…</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Failed to load analytics.</p>
      </div>
    );
  }

  const { incidentStats, lotStats, inventoryStats, dataQuality, networkStats, mlRisk, trend } = data;

  // --- Build insight narrative cards ---
  const insights: Array<{ icon: React.ElementType; title: string; body: string; tone: 'success' | 'warning' | 'critical' | 'info' }> = [];

  if (incidentStats.severityBreakdown.critical > 0) {
    insights.push({
      icon: AlertTriangle, title: 'Critical Risk Active', tone: 'critical',
      body: `${incidentStats.severityBreakdown.critical} critical incident(s) currently active in the network — immediate containment required to prevent further spread.`,
    });
  }
  const resolvedCount = incidentStats.statusBreakdown['resolved'] ?? 0;
  const resolvedPct = incidentStats.total > 0 ? Math.round((resolvedCount / incidentStats.total) * 100) : 0;
  if (resolvedPct >= 50) {
    insights.push({
      icon: CheckCircle2, title: 'Strong Incident Resolution Rate', tone: 'success',
      body: `${resolvedPct}% of incidents have been resolved — demonstrating effective response protocols and operational resilience.`,
    });
  }
  if (dataQuality.score < 80) {
    insights.push({
      icon: Database, title: 'Data Quality Alert', tone: 'warning',
      body: `Inspection pass rate at ${dataQuality.score}% — ${dataQuality.failCount} failed checks detected. Review supplier QC processes to reduce contamination risk.`,
    });
  } else {
    insights.push({
      icon: ShieldCheck, title: 'High Data Quality', tone: 'success',
      body: `${dataQuality.score}% inspection pass rate across ${formatNumber(dataQuality.totalInspections)} tests. Clean data enables reliable trace analysis and faster incident response.`,
    });
  }
  if (inventoryStats.availabilityPct < 80) {
    insights.push({
      icon: PackageCheck, title: 'Inventory Availability Risk', tone: 'warning',
      body: `Only ${inventoryStats.availabilityPct}% of inventory is available — ${formatNumber(inventoryStats.total - inventoryStats.available)} units are held or quarantined. Recovery capacity may be constrained.`,
    });
  } else {
    insights.push({
      icon: PackageCheck, title: 'Healthy Inventory Buffer', tone: 'info',
      body: `${inventoryStats.availabilityPct}% availability (${formatNumber(inventoryStats.available)} of ${formatNumber(inventoryStats.total)} units) provides adequate buffer for demand fulfillment during recovery.`,
    });
  }
  if (lotStats.stdDev > lotStats.mean * 0.5) {
    insights.push({
      icon: TrendingUp, title: 'High Lot Size Variance', tone: 'warning',
      body: `Lot quantities range from median ${formatNumber(lotStats.median)} to P95 ${formatNumber(lotStats.p95)} — high variance (σ=${formatNumber(lotStats.stdDev)}) increases recall scope uncertainty when contamination is detected.`,
    });
  }

  // Severity pie data
  const severityData = Object.entries(incidentStats.severityBreakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v, color: SEVERITY_COLORS[k] }));

  // Type bar data
  const typeData = Object.entries(incidentStats.typeBreakdown).map(([k, v], i) => ({
    name: k.replace(/_/g, ' '),
    count: v,
    color: TYPE_COLORS[i % TYPE_COLORS.length],
  }));

  // Risk radial for gauge background
  const riskColor =
    mlRisk.score >= 80 ? 'var(--color-critical)' :
    mlRisk.score >= 60 ? 'var(--color-warning)' :
    mlRisk.score >= 40 ? 'var(--color-primary)' :
    'var(--color-success)';

  return (
    <div className="px-8 lg:px-10 py-6 max-w-[1400px] mx-auto space-y-6 min-h-screen text-foreground transition-colors duration-300">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground mb-0.5">Analytics & EDA</h1>
          <p className="text-[13px] text-muted-foreground">
            Statistical analysis · ML risk scoring · Data quality · Trend insights
          </p>
        </div>
        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground bg-surface-2">
          {formatNumber(networkStats.batchCount)} batches · {formatNumber(networkStats.supplierCount)} suppliers
        </span>
      </div>

      {/* Network Stats Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatBox label="Products" value={networkStats.productCount} />
        <StatBox label="Batches" value={networkStats.batchCount} />
        <StatBox label="Suppliers" value={networkStats.supplierCount} />
        <StatBox label="Warehouses" value={networkStats.warehouseCount} />
        <StatBox label="Stores" value={networkStats.storeCount} />
        <StatBox label="Shipments" value={networkStats.shipmentCount} />
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ML Risk Score */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-6 flex flex-col">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> ML Risk Score
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <RiskGauge score={mlRisk.score} label={mlRisk.label} />
            {mlRisk.incidentTitle && (
              <p className="text-[11px] text-muted-foreground text-center mt-3 max-w-[200px] leading-snug">
                Based on: {mlRisk.incidentTitle}
              </p>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {mlRisk.factors.map((f) => (
              <div key={f.label} className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground truncate mr-2">{f.label}</span>
                <span className="font-semibold text-foreground shrink-0 text-right">{f.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground leading-snug">
            Weighted model: severity (35%) · exposure (30%) · spread (25%) · data quality (10%)
          </div>
        </div>

        {/* Incident Severity Distribution */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-6 flex flex-col">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Incident Severity Distribution
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(incidentStats.severityBreakdown).map(([sev, count]) => (
              <div key={sev} className="flex items-center gap-2 text-[12px]">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SEVERITY_COLORS[sev] }} />
                <span className="text-muted-foreground capitalize">{sev}</span>
                <span className="ml-auto font-semibold tabular-nums text-foreground">{count}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 pt-3 border-t border-border text-[12px] text-muted-foreground">
            Total incidents: <span className="font-semibold text-foreground">{incidentStats.total}</span>
            {' · '}Resolved: <span className="font-semibold text-success">{incidentStats.statusBreakdown['resolved'] ?? 0}</span>
          </div>
        </div>

        {/* Data Quality Panel */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-6 flex flex-col">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Database className="w-4 h-4" /> Data Quality
          </div>
          <div className="flex-1 flex flex-col justify-center gap-4">
            {/* Quality score bar */}
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-muted-foreground font-medium">Inspection Pass Rate</span>
                <span className={cn('font-bold', dataQuality.score >= 80 ? 'text-success' : 'text-warning')}>
                  {dataQuality.score}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-2 border border-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${dataQuality.score}%`,
                    backgroundColor: dataQuality.score >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Pass</div>
                <div className="text-xl font-semibold text-success tabular-nums">{formatNumber(dataQuality.passCount)}</div>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fail</div>
                <div className="text-xl font-semibold text-critical tabular-nums">{formatNumber(dataQuality.failCount)}</div>
              </div>
            </div>

            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Inspections</span>
                <span className="font-semibold text-foreground tabular-nums">{formatNumber(dataQuality.totalInspections)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outlier Lots (2× P75)</span>
                <span className={cn('font-semibold tabular-nums', dataQuality.outlierLots > 0 ? 'text-warning' : 'text-success')}>
                  {dataQuality.outlierLots}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inventory Availability</span>
                <span className="font-semibold text-foreground tabular-nums">{inventoryStats.availabilityPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EDA Stats + Type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Lot Size Statistical Summary */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-6">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Lot Size — Statistical Distribution
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Mean', value: lotStats.mean },
              { label: 'Median', value: lotStats.median },
              { label: 'Std Dev (σ)', value: lotStats.stdDev },
              { label: 'P75', value: lotStats.p75 },
              { label: 'P95', value: lotStats.p95 },
              { label: 'Total Lots', value: lotStats.count },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
                <div className="text-[20px] font-semibold tabular-nums text-foreground">{formatNumber(value)}</div>
              </div>
            ))}
          </div>
          {/* Visual distribution */}
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Median', value: lotStats.median, fill: 'var(--color-primary)' },
                  { name: 'Mean', value: lotStats.mean, fill: 'var(--color-success)' },
                  { name: 'P75', value: lotStats.p75, fill: 'var(--color-warning)' },
                  { name: 'P95', value: lotStats.p95, fill: 'var(--color-critical)' },
                ]}
                margin={{ top: 0, right: 0, left: -30, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any) => formatNumber(v)}
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28}>
                  {['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-critical)'].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            High σ/mean ratio ({lotStats.mean > 0 ? Math.round((lotStats.stdDev / lotStats.mean) * 100) : 0}%) indicates
            heterogeneous lot sizes — recall scope is harder to bound when contamination is lot-linked.
          </p>
        </div>

        {/* Incident Type Breakdown */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-6">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Incident Type Breakdown
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                />
                <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]} barSize={36}>
                  {typeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {typeData.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2 text-[12px]">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: t.color }} />
                <span className="capitalize text-muted-foreground">{t.name}</span>
                <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden border border-border ml-1">
                  <div className="h-full rounded-full" style={{ width: `${(t.count / incidentStats.total) * 100}%`, backgroundColor: t.color }} />
                </div>
                <span className="font-semibold tabular-nums text-foreground">{t.count}</span>
                <span className="text-muted-foreground">({Math.round((t.count / incidentStats.total) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      {trend.length > 1 && (
        <div className="rounded-xl border border-border bg-surface shadow-sm p-6">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Monthly Trend — Incidents vs Sales Volume (k units)
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }} />
                <Line yAxisId="left" type="monotone" dataKey="incidents" name="Incidents"
                  stroke="var(--color-critical)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="sales" name="Sales (k)"
                  stroke="var(--color-success)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Correlation between incident frequency and sales volume reveals operational pressure periods.
          </p>
        </div>
      )}

      {/* Insight Cards */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Analytical Insights
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <InsightCard key={i} {...ins} />
          ))}
        </div>
      </div>

      {/* ML Methodology note */}
      <div className="rounded-xl border border-border bg-surface-2 p-5 flex gap-3">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-[12px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">ML Risk Model — </span>
          The risk score uses a weighted multi-factor model inspired by fault-tree analysis.
          Severity (35%) accounts for regulatory and consumer impact; Inventory Exposure (30%) quantifies scope;
          Facility Spread (25%) captures how many nodes are at risk; Data Quality Risk (10%) penalizes uncertainty
          introduced by failed QC tests. The model is deterministic and interpretable — suitable for regulated food-safety contexts
          where explainability is required alongside prediction.
        </div>
      </div>

    </div>
  );
}
