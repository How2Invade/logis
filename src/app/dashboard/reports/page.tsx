'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart3, FileText, Download, Printer, Filter, 
  AlertTriangle, CheckCircle2, Clock, Calendar, Box, Activity, FileJson
} from 'lucide-react';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { Incident } from '@/lib/types';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { buildReportData, toReportJSON, reportFileBase, downloadFile } from '@/lib/report/data';
import { generateLogisPDF } from '@/lib/report/pdf';
import { buildReportText } from '@/lib/report/text';

export default function ReportsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'comprehensive' | 'impact' | 'recovery'>('comprehensive');
  const [isExporting, setIsExporting] = useState(false);
  const [impact, setImpact] = useState<any>(null);
  const [responseStats, setResponseStats] = useState<any>(null);
  const [responsePlan, setResponsePlan] = useState<any>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/incidents');
        const data = await res.json();
        setIncidents(data.data || []);
        if (data.data?.length > 0) {
          setSelectedIncidentId(data.data[0].id);
        }
      } catch (e) {
        console.error('Failed to fetch incidents', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchDetails() {
      if (!selectedIncidentId) return;
      setImpactLoading(true);
      try {
        const [impRes, rspRes] = await Promise.all([
          fetch(`/api/incidents/${selectedIncidentId}/analyze`, { method: 'POST' }),
          fetch(`/api/incidents/${selectedIncidentId}/response`, { method: 'POST' })
        ]);
        const impData = await impRes.json();
        const rspData = await rspRes.json();
        setImpact(impData.data);
        if (rspData.data) {
          setResponseStats(rspData.data.comparison);
          setResponsePlan(rspData.data);
        }
      } catch (e) {
        console.error('Failed to fetch details', e);
      } finally {
        setImpactLoading(false);
      }
    }
    fetchDetails();
  }, [selectedIncidentId]);

  const handlePrint = () => {
    window.print();
    toast.success('Preparing document for printing');
  };

  const generateData = async () => {
    if (!selectedIncidentId || !selectedIncident) throw new Error('No incident selected');
    return await buildReportData(selectedIncidentId);
  };

  const handleExport = async () => {
    if (!selectedIncidentId) return;
    setIsExporting(true);
    toast.loading('Generating PDF...', { id: 'export' });
    
    try {
      const data = await generateData();
      await generateLogisPDF(data, `${reportFileBase(data)}.pdf`, reportType);
      toast.success('Report downloaded successfully!', { id: 'export' });
    } catch (error: any) {
      console.error('Failed to export PDF:', error);
      toast.error(`Failed to generate PDF: ${error.message || 'Unknown error'}`, { id: 'export' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    if (!selectedIncidentId) return;
    setIsExporting(true);
    toast.loading('Generating JSON...', { id: 'export' });
    try {
      const data = await generateData();
      const content = JSON.stringify(toReportJSON(data), null, 2);
      downloadFile(content, `${reportFileBase(data)}.json`, 'application/json');
      toast.success('JSON downloaded successfully!', { id: 'export' });
    } catch (error: any) {
      toast.error('Failed to generate JSON', { id: 'export' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTXT = async () => {
    if (!selectedIncidentId) return;
    setIsExporting(true);
    toast.loading('Generating TXT...', { id: 'export' });
    try {
      const data = await generateData();
      const content = buildReportText(data);
      downloadFile(content, `${reportFileBase(data)}.txt`, 'text/plain');
      toast.success('TXT downloaded successfully!', { id: 'export' });
    } catch (error: any) {
      toast.error('Failed to generate TXT', { id: 'export' });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  // Dynamic data for charts
  const facilityData = impact?.lines ? (() => {
    const facilities = new Map();
    impact.lines.forEach((line: any) => {
      if (line.nodeType === 'warehouse' || line.nodeType === 'store') {
        const loc = line.location || line.nodeId;
        const shortLoc = loc.split(' ')[0]; // e.g. WH-001 (Central) -> WH-001
        if (!facilities.has(shortLoc)) {
          facilities.set(shortLoc, { name: shortLoc, affected: 0, safe: 0, uncertain: 0 });
        }
        const data = facilities.get(shortLoc);
        if (line.status === 'affected') data.affected += line.quantity || 0;
        if (line.status === 'safe') data.safe += line.quantity || 0;
        if (line.status === 'uncertain') data.uncertain += line.quantity || 0;
      }
    });
    return Array.from(facilities.values())
      .filter(f => f.affected > 0 || f.safe > 0)
      .sort((a, b) => b.affected - a.affected)
      .slice(0, 5);
  })() : [];

  const productData = impact?.lines ? (() => {
    const products = new Map();
    impact.lines.forEach((line: any) => {
      if (line.status === 'affected') {
        const pName = (line.label || '').split(' (')[0] || line.productId || 'Unknown';
        products.set(pName, (products.get(pName) || 0) + (line.quantity || 0));
      }
    });
    
    const colors = ['var(--color-critical)', 'var(--color-warning)', 'var(--color-orange)', 'var(--color-primary)', 'var(--color-success)'];
    
    return Array.from(products.entries())
      .filter(p => p[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], idx) => ({
        name,
        value,
        color: colors[idx % colors.length]
      }));
  })() : [];

  const costData = responseStats ? [
    { name: 'Naive Approach', cost: responseStats.naive.totalCost },
    { name: 'LOGIS Response', cost: responseStats.logis.totalCost }
  ] : [];
  
  const criticalActions = responsePlan?.actions?.filter((a: any) => 
    a.type === 'quarantine' || a.type === 'withdraw' || a.type === 'verify'
  ).sort((a: any, b: any) => b.units - a.units).slice(0, 5) || [];

  if (loading) {
    return (
      <div className="px-8 lg:px-10 py-7 space-y-10 max-w-[1400px] mx-auto min-h-screen">
        <div className="skeleton w-12 h-12 rounded-full mx-auto mt-20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 print:hidden">
        <div>
          <h1 className="text-[32px] font-semibold text-foreground mb-1">Reports & Analytics</h1>
          <p className="text-[14px] text-muted-foreground">Generate, view, and export operational intelligence reports</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={handleExportTXT} className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-border bg-surface text-foreground text-[14px] font-semibold hover:bg-surface-2 transition-all shadow-sm">
            <FileText className="w-4 h-4" /> Export TXT
          </button>
          <button onClick={handleExportJSON} className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-border bg-surface text-foreground text-[14px] font-semibold hover:bg-surface-2 transition-all shadow-sm">
            <FileJson className="w-4 h-4" /> Export JSON
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-dark-action text-dark-action-fg text-[14px] font-semibold hover:opacity-90 transition-all shadow-sm">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 print:block mt-8">
        
        {/* Sidebar Controls */}
        <div className="xl:col-span-1 space-y-6 print:hidden">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-6">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4" /> Report Configuration
            </h3>
            
            <div>
              <label className="text-[12px] font-medium text-foreground block mb-2">Target Incident</label>
              <select 
                value={selectedIncidentId || ''} 
                onChange={(e) => setSelectedIncidentId(e.target.value)}
                className="w-full bg-surface-2 border border-border text-[13px] rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
              >
                {incidents.map(inc => (
                  <option key={inc.id} value={inc.id}>{inc.id} — {inc.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-foreground block mb-2">Report Type</label>
              <div className="space-y-2">
                {[
                  { id: 'comprehensive', label: 'Comprehensive Summary' },
                  { id: 'impact', label: 'Impact & Spread Analysis' },
                  { id: 'recovery', label: 'Recovery & Logistics' }
                ].map(type => (
                  <label key={type.id} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="radio" name="reportType" className="peer sr-only" 
                      checked={reportType === type.id} 
                      onChange={() => setReportType(type.id as any)} 
                    />
                    <div className="w-4 h-4 rounded-full border border-border flex items-center justify-center bg-surface peer-checked:border-dark-action peer-checked:bg-dark-action transition-all">
                      <div className="w-1.5 h-1.5 rounded-full bg-white opacity-0 peer-checked:opacity-100" />
                    </div>
                    <span className="text-[13px] text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                      {type.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="xl:col-span-3">
          <div id="report-content" className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden min-h-[800px]">
            
            {/* Report Header */}
            <div className="p-8 md:p-12 border-b border-border bg-surface-2/30">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <div className="text-[24px] font-bold tracking-tight text-foreground mb-1">LOGIS Intelligence Report</div>
                  <div className="text-[14px] text-muted-foreground font-medium uppercase tracking-widest">{reportType} Analysis</div>
                </div>
                <div className="text-right text-[12px] text-muted-foreground">
                  <div>Generated: {new Date().toLocaleString()}</div>
                  <div>ID: REP-{Math.random().toString(36).substring(2, 8).toUpperCase()}</div>
                </div>
              </div>

              {selectedIncident && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Incident</div>
                    <div className="text-[15px] font-semibold text-foreground">{selectedIncident.id}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Severity</div>
                    <div className="text-[15px] font-semibold text-critical capitalize">{selectedIncident.severity}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Source Lot</div>
                    <div className="text-[15px] font-semibold text-foreground">{selectedIncident.sourceLot}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</div>
                    <div className="text-[15px] font-semibold text-warning capitalize">{selectedIncident.status}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Report Body */}
            <div className="p-8 md:p-12 space-y-12 bg-surface">
              
              {impactLoading ? (
                <div className="text-center py-20 text-muted-foreground text-[14px]">Generating analytics...</div>
              ) : impact ? (
                <>
                  {/* Executive Summary */}
                  <div>
                    <h2 className="text-[16px] font-semibold border-b border-border pb-2 mb-6">1. Executive Summary</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl border border-border bg-surface-2/50">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Affected Units</div>
                        <div className="text-2xl font-bold text-critical tabular-nums">{formatNumber(impact.affectedUnits)}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-surface-2/50">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Safe Units</div>
                        <div className="text-2xl font-bold text-success tabular-nums">{formatNumber(impact.safeUnits)}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-surface-2/50">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Uncertain Units</div>
                        <div className="text-2xl font-bold text-warning tabular-nums">{formatNumber(impact.uncertainUnits)}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-surface-2/50">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Est. Financial Impact</div>
                        <div className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(impact.estimatedImpactINR)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Impact by Facility & Product */}
                  {(reportType === 'comprehensive' || reportType === 'impact') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div>
                        <h2 className="text-[16px] font-semibold border-b border-border pb-2 mb-6">2. Impact by Facility</h2>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={facilityData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                              <XAxis dataKey="name" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--color-foreground)' }} />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }} />
                              <Bar dataKey="affected" name="Affected" stackId="a" fill="var(--color-critical)" barSize={24} />
                              <Bar dataKey="safe" name="Safe" stackId="a" fill="var(--color-success)" barSize={24} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      
                      <div>
                        <h2 className="text-[16px] font-semibold border-b border-border pb-2 mb-6">3. Affected Units by Product</h2>
                        <div className="h-64 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={productData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                {productData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px' }} />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Response Cost Comparison */}
                  {responseStats && (reportType === 'comprehensive' || reportType === 'recovery') && (
                    <div>
                      <h2 className="text-[16px] font-semibold border-b border-border pb-2 mb-6">4. Response Cost Comparison</h2>
                      <div className="h-64 max-w-lg">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={costData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--color-border)" />
                            <XAxis type="number" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v/1000}k`} />
                            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px' }} />
                            <Bar dataKey="cost" name="Estimated Cost" fill="var(--color-warning)" radius={[0, 4, 4, 0]} barSize={24}>
                              {costData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 1 ? 'var(--color-success)' : 'var(--color-border)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-4">
                        LOGIS avoids {formatNumber(responseStats.unnecessaryRecallAvoided)} unnecessary product recalls, resulting in a net saving of {formatCurrency(responseStats.costSaved)}.
                      </p>
                    </div>
                  )}

                  {/* Operational Details Table */}
                  {(reportType === 'comprehensive' || reportType === 'impact') && (
                    <div className="print:break-before-page">
                      <h2 className="text-[16px] font-semibold border-b border-border pb-2 mb-6">5. Critical Action Areas</h2>
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                            <th className="pb-3 px-2">Location</th>
                            <th className="pb-3 px-2">Status</th>
                            <th className="pb-3 px-2 text-right">Affected Units</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {criticalActions.map((action: any, index: number) => (
                            <tr key={action.id} className={index % 2 === 0 ? "bg-surface-2/30" : ""}>
                              <td className="py-3 px-2 font-medium">{action.location}</td>
                              <td className="py-3 px-2">
                                <span className={cn(
                                  "font-semibold",
                                  action.type === 'verify' ? "text-warning" : "text-critical"
                                )}>
                                  {action.type === 'verify' ? 'Needs Verification' : 'Critical Impact'}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right tabular-nums">{formatNumber(action.units)}</td>
                            </tr>
                          ))}
                          {criticalActions.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-6 text-center text-muted-foreground text-[13px]">
                                No critical actions found for this incident.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                </>
              ) : null}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
