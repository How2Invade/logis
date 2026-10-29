'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Settings, RotateCcw, Gauge, UploadCloud, Download, CheckCircle, AlertTriangle, XCircle,
  FileSpreadsheet, Table as TableIcon, Trash2, Server, ShieldCheck, ChevronDown, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface ParsedRow {
  [key: string]: string;
}

interface ValidationReport {
  status: 'success' | 'partial' | 'failed';
  validateOnly?: boolean;
  message: string;
  inserted: Record<string, number>;
  skipped: Array<{ entity: string; id: string; reason: string }>;
  confidenceStats?: { confirmed: number; probable: number; unknown: number };
  errors: Array<{ entity: string; id: string; field: string; message: string }>;
}

export default function SettingsPage() {
  const [resetting, setResetting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isUnifiedFile, setIsUnifiedFile] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [entityType, setEntityType] = useState<'lots' | 'batches' | 'shipments' | 'suppliers'>('lots');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [showSkippedDetails, setShowSkippedDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleReset() {
    if (!confirm('Reset the database to the initial seed state? This will undo all changes.')) return;
    setResetting(true);
    try {
      await fetch('/api/demo/reset', { method: 'POST' });
      toast.success('Database reset to initial seed state');
      setReport(null);
    } catch (e) {
      toast.error('Failed to reset database');
    }
    setResetting(false);
  }

  // Convert parsed rows into API entity payload
  function buildPayload(rows: ParsedRow[], isUnified: boolean) {
    const entitiesPayload: any = {
      suppliers: [],
      materials: [],
      lots: [],
      products: [],
      batches: [],
      batchLotUsage: [],
      warehouses: [],
      inventory: [],
      shipments: [],
      stores: [],
    };

    if (isUnified) {
      for (const r of rows) {
        const type = (r['EntityType'] || '').toLowerCase().trim();
        const id = r['ID'] || '';
        const nameOrType = r['Name_or_Type'] || '';
        const parentOrOrigin = r['Parent_or_Origin'] || '';
        const targetOrDest = r['Target_or_Dest'] || '';
        const qty = parseFloat(r['Quantity'] || '0') || 0;
        const unitOrPrice = r['Unit_or_Price'] || '';
        const statusOrConf = r['Status_or_Conf'] || 'active';

        if (type === 'supplier') {
          entitiesPayload.suppliers.push({ id, name: nameOrType, location: parentOrOrigin, contactEmail: targetOrDest, rating: qty || 4.5 });
        } else if (type === 'material') {
          entitiesPayload.materials.push({ id, name: nameOrType, supplierId: parentOrOrigin, unit: unitOrPrice || 'kg', category: statusOrConf });
        } else if (type === 'lot') {
          entitiesPayload.lots.push({ id, materialId: nameOrType, supplierId: parentOrOrigin, quantity: qty, unit: unitOrPrice || 'kg', status: statusOrConf });
        } else if (type === 'product') {
          entitiesPayload.products.push({ id, name: nameOrType, category: parentOrOrigin, unitPrice: qty || 10, shelfLifeDays: 270 });
        } else if (type === 'batch') {
          entitiesPayload.batches.push({ id, productId: nameOrType, machineId: parentOrOrigin, lineId: targetOrDest, quantity: Math.round(qty), status: statusOrConf });
        } else if (type === 'batch_lot_usage') {
          entitiesPayload.batchLotUsage.push({ id, confidence: nameOrType as any, lotId: parentOrOrigin, batchId: targetOrDest, fractionUsed: qty || 1.0 });
        } else if (type === 'warehouse') {
          entitiesPayload.warehouses.push({ id, name: nameOrType, location: parentOrOrigin, capacity: qty || 50000 });
        } else if (type === 'inventory') {
          entitiesPayload.inventory.push({ id, productId: nameOrType, batchId: parentOrOrigin, locationId: targetOrDest, locationType: 'warehouse', quantity: Math.round(qty), status: statusOrConf });
        } else if (type === 'shipment') {
          entitiesPayload.shipments.push({ id, batchId: nameOrType, origin: parentOrOrigin, destination: targetOrDest, quantity: Math.round(qty), status: statusOrConf });
        } else if (type === 'store') {
          entitiesPayload.stores.push({ id, name: nameOrType, location: parentOrOrigin });
        }
      }
    } else {
      if (entityType === 'lots') {
        entitiesPayload.lots = rows.map((r, i) => ({
          id: r['Lot ID'] || r['id'] || `LOT-IMP-${Date.now()}-${i}`,
          materialId: r['Material ID'] || r['material_id'] || 'MAT-001',
          supplierId: r['Supplier ID'] || r['supplier_id'] || 'SUP-001',
          quantity: parseFloat(r['Quantity'] || '1000') || 1000,
          unit: r['Unit'] || 'kg',
          status: r['Status'] || 'active',
        }));
      } else if (entityType === 'batches') {
        entitiesPayload.batches = rows.map((r, i) => ({
          id: r['Batch ID'] || r['id'] || `BAT-IMP-${Date.now()}-${i}`,
          productId: r['Product ID'] || 'PRD-001',
          quantity: parseInt(r['Quantity'] || '500', 10) || 500,
          status: r['Status'] || 'active',
        }));
      } else if (entityType === 'suppliers') {
        entitiesPayload.suppliers = rows.map((r, i) => ({
          id: r['Supplier ID'] || r['id'] || `SUP-IMP-${Date.now()}-${i}`,
          name: r['Name'] || 'Supplier Partner',
          location: r['Location'] || 'India',
        }));
      } else if (entityType === 'shipments') {
        entitiesPayload.shipments = rows.map((r, i) => ({
          id: r['Shipment ID'] || r['id'] || `SHP-IMP-${Date.now()}-${i}`,
          batchId: r['Batch ID'] || 'BAT-001',
          origin: r['Origin'] || 'WH-01',
          destination: r['Destination'] || 'Store #101',
          quantity: parseInt(r['Quantity'] || '200', 10) || 200,
          status: r['Status'] || 'in_transit',
        }));
      }
    }

    return entitiesPayload;
  }

  // Automatic Dry Run Validation
  async function runDryRun(rows: ParsedRow[], isUnified: boolean) {
    setValidating(true);
    try {
      const payload = buildPayload(rows, isUnified);
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validateOnly: true, entities: payload }),
      });
      const data: ValidationReport = await res.json();
      setReport(data);
    } catch (e: any) {
      console.warn('Dry run check failed:', e);
    } finally {
      setValidating(false);
    }
  }

  // Parse CSV text
  function parseCSV(text: string) {
    setReport(null);
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      toast.error('CSV file must have a header row and data rows.');
      return;
    }

    // Check for comment line or metadata directive: e.g. # dataset_name: <name>
    let discoveredDatasetName: string | null = null;
    let discoveredIsSimulation: boolean | null = null;
    let dataLinesStartIndex = 0;

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.startsWith('#')) {
        dataLinesStartIndex = i + 1;
        const metaMatch = line.match(/dataset_name[:=]\s*(.+)/i);
        if (metaMatch) discoveredDatasetName = metaMatch[1].trim();
        if (line.toLowerCase().includes('simulation') || line.toLowerCase().includes('is_simulation=true')) {
          discoveredIsSimulation = true;
        }
      }
    }

    const rawHeaders = lines[dataLinesStartIndex].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    setHeaders(rawHeaders);

    const hasUnifiedCol = rawHeaders.some(h => h.toLowerCase() === 'entitytype');
    setIsUnifiedFile(hasUnifiedCol);
    if (hasUnifiedCol) {
      setImportMode('replace'); // Default to "replace" when the file has an EntityType column
    }

    const rows: ParsedRow[] = [];
    for (let i = dataLinesStartIndex + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith('#')) continue;
      const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      const row: ParsedRow = {};
      rawHeaders.forEach((h, index) => {
        row[h] = (match[index] || '').replace(/^"|"$/g, '').trim();
      });

      // Also check if any row specifies EntityType = dataset_meta
      if ((row['EntityType'] || '').toLowerCase() === 'dataset_meta') {
        discoveredDatasetName = row['Name_or_Type'] || row['ID'] || discoveredDatasetName;
        if ((row['Status_or_Conf'] || '').toLowerCase() === 'simulation' || row['Unit_or_Price'] === 'true') {
          discoveredIsSimulation = true;
        }
      } else {
        rows.push(row);
      }
    }

    if (discoveredDatasetName) {
      setFileName(discoveredDatasetName + (discoveredIsSimulation ? ' · SIMULATION' : ''));
    }

    setParsedRows(rows);
    toast.success(`Loaded ${rows.length} rows`);

    // Run dry-run validation automatically
    runDryRun(rows, hasUnifiedCol);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCSV(content);
    };
    reader.readAsText(file);
  }

  function loadSampleCSV() {
    fetch('/sample-data/nestle-sim/nestle_sim_complete.csv')
      .then(res => res.text())
      .then(csv => {
        setFileName('nestle_sim_complete.csv [SIMULATION: Nestlé India Maggi 2015 Case]');
        parseCSV(csv);
      })
      .catch(() => toast.error('Could not fetch dataset'));
  }

  function loadNoisySampleCSV() {
    fetch('/sample-data/nestle-sim/nestle_sim_noisy.csv')
      .then(res => res.text())
      .then(csv => {
        setFileName('nestle_sim_noisy.csv [SIMULATION: 10% Noise Injected]');
        parseCSV(csv);
      })
      .catch(() => toast.error('Could not fetch dataset'));
  }

  async function handleImportData() {
    if (parsedRows.length === 0) {
      toast.error('No rows to import. Please upload a CSV first.');
      return;
    }

    setImporting(true);
    setReport(null); // Clear previous banner

    try {
      const payload = buildPayload(parsedRows, isUnifiedFile);
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validateOnly: false,
          mode: importMode,
          sourceFile: fileName || 'uploaded.csv',
          datasetName: fileName?.includes('nestle') ? 'Nestlé India (Maggi 2015 Simulation)' : 'Imported Supply Chain',
          entities: payload,
        }),
      });

      const data: ValidationReport = await res.json();
      setReport(data);

      if (data.status === 'success') {
        toast.success(`Successfully imported all ${parsedRows.length} entities!`);
        if (importMode === 'replace') {
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 800);
        }
      } else if (data.status === 'partial') {
        toast.warning(`Imported with ${data.skipped.length} dangling rows safely skipped.`);
        if (importMode === 'replace') {
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1200);
        }
      } else {
        toast.error(`Import failed: ${data.message || 'Fatal error'}`);
      }
    } catch (e: any) {
      setReport({
        status: 'failed',
        message: e.message,
        inserted: {},
        skipped: [],
        errors: [{ entity: 'system', id: 'client', field: 'network', message: e.message }],
      });
      toast.error(`Import error: ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  function clearUploadedData() {
    setFileName(null);
    setParsedRows([]);
    setHeaders([]);
    setReport(null);
    setIsUnifiedFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto space-y-6 min-h-screen text-foreground transition-colors duration-300">
      <div>
        <h1 className="text-[32px] font-semibold text-foreground mb-1">Settings & Data Management</h1>
        <p className="text-[14px] text-muted-foreground">Upload operational CSVs, inspect datasets live, manage integrations and audit exports</p>
      </div>

      {/* CSV / Excel Upload & Live Data Display */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" /> CSV / Spreadsheet Data Importer
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              Upload your CSV file to preview the data on screen and seamlessly append it to your operational graph without wiping out existing dummy data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSampleCSV}
              className="text-[12px] px-3 py-1.5 rounded-lg border border-border bg-surface-2 hover:bg-surface text-primary font-medium transition-colors"
            >
              Load Clean Sim (Nestlé 2015)
            </button>
            <button
              onClick={loadNoisySampleCSV}
              className="text-[12px] px-3 py-1.5 rounded-lg border border-border bg-surface-2 hover:bg-surface text-warning font-medium transition-colors"
            >
              Load Noisy Sim (10% Noise)
            </button>
          </div>
        </div>

        {/* Dropzone & File Picker */}
        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-surface-2/40 transition-colors cursor-pointer relative mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-[14px] font-medium text-foreground">
            {fileName ? (
              <span className="text-primary font-semibold">{fileName}</span>
            ) : (
              'Click or drag & drop a .csv file here'
            )}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">Supports unified multi-entity CSVs (with EntityType column) or single-table CSVs</p>
        </div>

        {/* Live Data Table Preview */}
        {parsedRows.length > 0 && (
          <div className="space-y-4 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-primary" />
                <span className="text-[14px] font-semibold text-foreground">Spreadsheet Preview</span>
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-surface-2 border border-border text-muted-foreground">
                  {parsedRows.length} rows loaded
                </span>
                {validating && (
                  <span className="text-[11px] text-muted-foreground animate-pulse flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Validating graph constraints…
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {isUnifiedFile ? (
                  <div className="px-3 py-1 rounded-lg bg-surface-2 border border-border text-[12px] font-medium text-primary flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Unified multi-entity file detected (10 entity types)
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-muted-foreground">Map to entity:</span>
                    <select
                      value={entityType}
                      onChange={(e: any) => setEntityType(e.target.value)}
                      className="bg-surface-2 border border-border rounded-lg px-2.5 py-1 text-[13px] font-medium text-foreground focus:outline-none"
                    >
                      <option value="lots">Lots (Raw Materials)</option>
                      <option value="batches">Batches (Finished Goods)</option>
                      <option value="shipments">Shipments / Logistics</option>
                      <option value="suppliers">Suppliers</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={clearUploadedData}
                  className="p-1.5 text-muted-foreground hover:text-critical transition-colors rounded-lg hover:bg-surface-2"
                  title="Clear file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Data Table */}
            <div className="overflow-x-auto rounded-xl border border-border max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-2 sticky top-0 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    {headers.map((h) => (
                      <th key={h} className="py-2.5 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-surface" : "bg-surface-2/30"}>
                      <td className="py-2 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                      {headers.map((h) => (
                        <td key={h} className="py-2 px-3 whitespace-nowrap font-mono text-foreground">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedRows.length > 100 && (
              <p className="text-[11px] text-muted-foreground text-center italic">
                Showing first 100 of {parsedRows.length} rows in browser preview.
              </p>
            )}

            {/* Action Buttons & Import Mode Toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-medium text-muted-foreground">Import mode:</span>
                <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                      importMode === 'replace'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Replace Dataset
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${
                      importMode === 'append'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Append Rows
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {importMode === 'replace' ? 'Atomic clean slate for full network simulation' : 'Merges with existing network'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => runDryRun(parsedRows, isUnifiedFile)}
                  disabled={validating || importing}
                  className="px-4 py-2 rounded-full border border-border bg-surface-2 hover:bg-surface text-[13px] font-semibold text-foreground transition-colors"
                >
                  {validating ? 'Checking…' : 'Validate Only (Dry Run)'}
                </button>

                <button
                  onClick={handleImportData}
                  disabled={importing || validating}
                  className="px-6 py-2 rounded-full bg-primary text-primary-foreground text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                >
                  {importing ? 'Processing…' : importMode === 'replace' ? `Replace with ${parsedRows.length} Rows` : `Append ${parsedRows.length} Rows`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation & Import Feedback Reports */}
        {report && (
          <div className="mt-6">
            {report.status === 'success' && (
              <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-[13px]">
                <p className="font-semibold text-success flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4" /> {report.validateOnly ? 'Dry Run Passed (100% Valid)' : 'Database Updated Successfully'}
                </p>
                <p className="text-foreground text-[12px] mb-3">{report.message}</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[12px] text-muted-foreground">
                  {Object.entries(report.inserted).map(([entity, count]) => (
                    <div key={entity}>
                      {entity}: <span className="font-semibold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.status === 'partial' && (
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 text-[13px]">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-warning flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {report.validateOnly ? 'Dry Run: Partial Validation (Dangling Rows Detected)' : 'Import Completed with Skipped Rows'}
                  </p>
                  <button 
                    onClick={() => setShowSkippedDetails(!showSkippedDetails)}
                    className="text-[12px] text-warning underline flex items-center gap-1"
                  >
                    {showSkippedDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    {showSkippedDetails ? 'Hide' : 'View'} {report.skipped.length} Skipped Rows
                  </button>
                </div>
                <p className="text-foreground text-[12px] mb-3">{report.message}</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[12px] text-muted-foreground mb-3">
                  {Object.entries(report.inserted).map(([entity, count]) => (
                    <div key={entity}>
                      {entity}: <span className="font-semibold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>

                {showSkippedDetails && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-warning/20 bg-surface/50 p-2 mt-2">
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-1 px-2">Entity</th>
                          <th className="py-1 px-2">ID</th>
                          <th className="py-1 px-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {report.skipped.map((s, idx) => (
                          <tr key={idx}>
                            <td className="py-1 px-2 font-mono">{s.entity}</td>
                            <td className="py-1 px-2 font-mono">{s.id}</td>
                            <td className="py-1 px-2 text-warning">{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {report.status === 'failed' && (
              <div className="p-4 rounded-xl bg-critical/10 border border-critical/30 text-[13px]">
                <p className="font-semibold text-critical flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4" /> Import Failed — 0 Rows Written (Rolled Back)
                </p>
                <p className="text-foreground text-[12px] mb-3">{report.message}</p>
                {report.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-critical/20 bg-surface/50 p-2">
                    <ul className="space-y-1 text-[11px] font-mono text-critical">
                      {report.errors.slice(0, 20).map((err, idx) => (
                        <li key={idx}>
                          [{err.entity.toUpperCase()}] ID: {err.id} — Field '{err.field}': {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Report Card */}
      {report && (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div>
              <h3 className="text-[16px] font-semibold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" /> Import Report
              </h3>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Structured result and confidence breakdown from the {report.validateOnly ? 'dry-run validation' : 'last database ingestion'}.
              </p>
            </div>
            <span className={`text-[12px] px-3 py-1 rounded-full font-semibold border ${
              report.status === 'success' 
                ? 'bg-success/10 text-success border-success/30' 
                : report.status === 'partial' 
                  ? 'bg-warning/10 text-warning border-warning/30' 
                  : 'bg-critical/10 text-critical border-critical/30'
            }`}>
              {report.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rows Inserted Per Entity */}
            <div className="space-y-3">
              <h4 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rows Ingested Per Entity
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                {Object.entries(report.inserted).map(([entity, count]) => (
                  <div key={entity} className="p-2.5 rounded-lg bg-surface-2 border border-border flex items-center justify-between">
                    <span className="capitalize text-muted-foreground">{entity}</span>
                    <span className="font-mono font-bold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Traceability Link Confidence */}
            <div className="space-y-3">
              <h4 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                Traceability Link Confidence
              </h4>
              <div className="grid grid-cols-3 gap-2 text-[12px]">
                <div className="p-3 rounded-lg bg-surface-2 border border-border text-center">
                  <span className="block text-success font-bold font-mono text-[18px]">
                    {report.confidenceStats?.confirmed ?? 0}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Confirmed Links</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-2 border border-border text-center">
                  <span className="block text-warning font-bold font-mono text-[18px]">
                    {report.confidenceStats?.probable ?? 0}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Probable Links</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-2 border border-border text-center">
                  <span className="block text-critical font-bold font-mono text-[18px]">
                    {report.confidenceStats?.unknown ?? 0}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Unknown Links</span>
                </div>
              </div>

              {/* Rows Skipped Summary */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Dangling / Skipped Rows:</span>
                  <span className={`font-mono font-bold ${report.skipped.length > 0 ? 'text-warning' : 'text-success'}`}>
                    {report.skipped.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Skipped Rows Details */}
          {report.skipped.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-warning">Skipped Rows Details ({report.skipped.length})</span>
                <button
                  type="button"
                  onClick={() => setShowSkippedDetails(!showSkippedDetails)}
                  className="text-[12px] text-primary hover:underline"
                >
                  {showSkippedDetails ? 'Collapse' : 'Expand'}
                </button>
              </div>
              {showSkippedDetails && (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-surface-2 p-3">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-1.5 px-2">Entity</th>
                        <th className="py-1.5 px-2">ID</th>
                        <th className="py-1.5 px-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {report.skipped.map((s, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-2 text-foreground capitalize">{s.entity}</td>
                          <td className="py-1.5 px-2 text-primary">{s.id}</td>
                          <td className="py-1.5 px-2 text-warning font-sans">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* REST / Webhook Ingestion API Info */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-[15px] font-semibold text-foreground mb-2 flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" /> Active Ingestion Webhooks & APIs
        </h3>
        <p className="text-[13px] text-muted-foreground mb-4">
          Connect your external ERP (SAP/Oracle), LIMS quality labs, or telematics gateways directly to LOGIS via REST webhooks:
        </p>
        <div className="space-y-3 font-mono text-[12px]">
          <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-success">POST</span> <span className="text-foreground">/api/v1/incidents/ingest</span>
              <p className="font-sans text-muted-foreground text-[11px] mt-0.5">Direct incident creation from quality test failures or supplier notices.</p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-surface text-muted-foreground border border-border font-sans">Active</span>
          </div>

          <div className="p-3 rounded-xl bg-surface-2 border border-border flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-success">POST</span> <span className="text-foreground">/api/v1/events/telemetry</span>
              <p className="font-sans text-muted-foreground text-[11px] mt-0.5">Cold-chain reefer and IoT temperature excursion alerts with auto-quarantine.</p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-surface text-muted-foreground border border-border font-sans">Active</span>
          </div>
        </div>
      </div>

      {/* Audit Trail & Compliance Export */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-[15px] font-semibold text-foreground mb-2 flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" /> Regulatory Audit Trail & Compliance Export
        </h3>
        <p className="text-[13px] text-muted-foreground mb-4">
          Export full immutable action logs, timestamped decisions, and user interventions supporting FDA FSMA 204 or ISO audits.
        </p>
        <a 
          href="/api/audit/export"
          download
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-surface-2 border border-border text-foreground text-[14px] font-semibold hover:bg-surface transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" /> Download Audit Trail (CSV / Excel)
        </a>
      </div>

      {/* Demo Controls */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-muted-foreground" /> Demo Controls
        </h3>
        <p className="text-[13px] text-muted-foreground mb-6">Reset the database to the original seeded demo scenario.</p>
        <button onClick={handleReset} disabled={resetting}
          className="px-6 py-2.5 rounded-full bg-surface-2 border border-border text-critical text-[14px] font-semibold hover:bg-surface transition-colors disabled:opacity-50 shadow-sm">
          {resetting ? 'Resetting…' : 'Reset Demo'}
        </button>
      </div>

      {/* Accessibility */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-muted-foreground" /> Accessibility
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-foreground font-medium">Reduced motion</span>
            <span className="text-[13px] text-muted-foreground">Uses prefers-reduced-motion</span>
          </div>
        </div>
      </div>
      
      <div className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground text-center space-y-1 mt-10 pt-8 border-t border-border/50">
        <p>LOGIS — Product Incident Intelligence & Operational Recovery</p>
        <p>ENTERPRISE INGESTION & COMPLIANCE READY · All data auditable</p>
      </div>
    </div>
  );
}
