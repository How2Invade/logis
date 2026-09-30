'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart3, FileText, Download, Printer, Filter, 
  AlertTriangle, CheckCircle2, Clock, Calendar, Box, Activity 
} from 'lucide-react';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { Incident } from '@/lib/types';
import { toast } from 'sonner';

export default function ReportsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'comprehensive' | 'impact' | 'recovery'>('comprehensive');
  const [isExporting, setIsExporting] = useState(false);

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

  const handlePrint = () => {
    window.print();
    toast.success('Preparing document for printing');
  };

  const handleExport = async () => {
    if (!selectedIncidentId) return;
    setIsExporting(true);
    toast.loading('Generating PDF...', { id: 'pdf-export' });
    
    try {
      const element = document.getElementById('report-content');
      if (!element) throw new Error('Report content not found');
      
      // Dynamically import to avoid Next.js SSR issues and module resolution problems
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default ? html2canvasModule.default : html2canvasModule;
      
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default ? jsPDFModule.default : jsPDFModule.jsPDF || jsPDFModule;
      
      const canvas = await (html2canvas as any)(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new (jsPDF as any)({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`LOGIS-Report-${selectedIncidentId}.pdf`);
      
      toast.success('Report downloaded successfully!', { id: 'pdf-export' });
    } catch (error: any) {
      console.error('Failed to export PDF:', error);
      toast.error(`Failed to generate PDF: ${error.message || 'Unknown error'}`, { id: 'pdf-export' });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  if (loading) {
    return (
      <div className="p-12 space-y-10 max-w-[1600px] mx-auto min-h-screen">
        <div className="skeleton h-12 w-64 rounded-xl" />
        <div className="skeleton h-[600px] rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 space-y-12 max-w-[1800px] mx-auto min-h-screen bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 print:hidden">
        <div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-foreground">Reporting & Analytics</h1>
          <p className="text-lg text-muted-foreground mt-3 font-medium">
            Generate, view, and export operational intelligence reports
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border/50 bg-surface text-foreground font-bold hover:bg-surface-2 transition-all shadow-sm"
          >
            <Printer className="w-5 h-5" />
            Print
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
          >
            <Download className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-10 print:block">
        
        {/* Sidebar Controls (Hidden on Print) */}
        <div className="xl:col-span-1 space-y-8 print:hidden">
          <div className="rounded-2xl border-2 border-border/50 bg-surface p-6 shadow-md space-y-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Report Configuration
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Select Incident</label>
                <select 
                  className="w-full bg-surface-2 border border-border/50 rounded-xl p-3 text-sm font-semibold outline-none focus:border-primary/50 transition-colors"
                  value={selectedIncidentId || ''}
                  onChange={(e) => setSelectedIncidentId(e.target.value)}
                >
                  {incidents.map(inc => (
                    <option key={inc.id} value={inc.id}>{inc.id} - {inc.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Report Type</label>
                <div className="space-y-2">
                  {[
                    { id: 'comprehensive', label: 'Comprehensive Overview' },
                    { id: 'impact', label: 'Impact & Financial Analysis' },
                    { id: 'recovery', label: 'Recovery & Logistics Plan' }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setReportType(type.id as any)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold",
                        reportType === type.id 
                          ? "border-primary bg-primary/5 text-primary" 
                          : "border-border/40 bg-surface hover:bg-surface-2 hover:border-border"
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="xl:col-span-3">
          {selectedIncident ? (
            <div id="report-content" className="rounded-3xl border border-border bg-surface p-10 lg:p-16 shadow-2xl print:shadow-none print:border-none print:p-0">
              
              {/* Report Header */}
              <div className="border-b-2 border-border/50 pb-10 mb-10 flex items-start justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold text-sm tracking-widest uppercase">
                    <FileText className="w-4 h-4" />
                    {reportType === 'comprehensive' ? 'Comprehensive Report' : reportType === 'impact' ? 'Impact Report' : 'Recovery Report'}
                  </div>
                  <h2 className="text-3xl font-black text-foreground">{selectedIncident.title}</h2>
                  <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">{selectedIncident.description}</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Report ID</div>
                  <div className="font-mono font-bold text-foreground">REP-{selectedIncident.id}-{Date.now().toString().slice(-4)}</div>
                  <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-4">Generated On</div>
                  <div className="font-medium text-foreground">{new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</div>
                </div>
              </div>

              {/* Report Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                <MetricCard title="Incident ID" value={selectedIncident.id} icon={AlertTriangle} />
                <MetricCard title="Severity" value={selectedIncident.severity.toUpperCase()} color={selectedIncident.severity === 'critical' ? 'red' : 'orange'} />
                <MetricCard title="Status" value={selectedIncident.status.toUpperCase()} />
                <MetricCard title="Source Lot" value={selectedIncident.sourceLot} icon={Box} />
              </div>

              {/* Report Content Blocks */}
              <div className="space-y-12">
                
                {/* Timeline / Overview */}
                <section>
                  <h3 className="text-xl font-black border-b-2 border-border/50 pb-3 mb-6 flex items-center gap-3">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                    Event Timeline
                  </h3>
                  <div className="space-y-6">
                    <div className="flex gap-4 p-5 rounded-2xl bg-surface-2 border border-border/50">
                      <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">Incident Detected</h4>
                        <p className="text-sm text-muted-foreground mt-1">Initial anomaly detected in {selectedIncident.location}. System automatically flagged Lot {selectedIncident.sourceLot} for review.</p>
                      </div>
                    </div>
                    <div className="flex gap-4 p-5 rounded-2xl bg-surface-2 border border-border/50">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                        <Activity className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">Impact Analysis Completed</h4>
                        <p className="text-sm text-muted-foreground mt-1">Graph traversal executed across supply chain network. Upstream and downstream dependencies mapped.</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Simulated Data Block for Demo */}
                <section>
                  <h3 className="text-xl font-black border-b-2 border-border/50 pb-3 mb-6 flex items-center gap-3">
                    <BarChart3 className="w-6 h-6 text-muted-foreground" />
                    Key Findings & Metrics
                  </h3>
                  <div className="bg-surface-2/50 rounded-2xl p-8 border border-border/50 text-center">
                    <p className="text-muted-foreground mb-4">Detailed analytical charts are rendered here based on graph traversal data.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                         <div className="text-4xl font-black text-foreground mb-2">342</div>
                         <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Units at Risk</div>
                       </div>
                       <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                         <div className="text-4xl font-black text-foreground mb-2">4</div>
                         <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Facilities Affected</div>
                       </div>
                       <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                         <div className="text-4xl font-black text-foreground mb-2">{formatCurrency(1250000)}</div>
                         <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Est. Exposure</div>
                       </div>
                    </div>
                  </div>
                </section>

              </div>
              
              <div className="mt-20 pt-8 border-t border-border/50 text-center text-sm font-medium text-muted-foreground">
                CONFIDENTIAL — LOGIS OPERATIONAL INTELLIGENCE REPORT
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-border/50 bg-surface/50 h-[600px] flex items-center justify-center text-muted-foreground font-medium">
              No incident selected
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string | React.ReactNode; icon?: any; color?: string }) {
  return (
    <div className="bg-surface-2 p-5 rounded-2xl border border-border/50">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4" />}
        {title}
      </div>
      <div className={cn("text-xl font-black", color === 'red' ? 'text-red-500' : color === 'orange' ? 'text-orange-500' : 'text-foreground')}>
        {value}
      </div>
    </div>
  );
}
