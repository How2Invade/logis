export async function generateLogisPDF(incidentId: string, incident: any, impact: any, responseStats: any) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default ? jsPDFModule.default : jsPDFModule.jsPDF || jsPDFModule;
  const doc = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 20;
  
  const colors = {
    bg: '#F5F2EC', fg: '#181818', surface: '#FFFFFF',
    primary: '#F29B5B', critical: '#C85A52', warning: '#C58A32', success: '#4F8A68', muted: '#99958E'
  };

  function addFooter(pageNo: number) {
    doc.setFontSize(9);
    doc.setTextColor(colors.muted);
    doc.text('SYNTHETIC DEMONSTRATION DATA', margin, height - 15);
    doc.text(`Page ${pageNo}`, width - margin - 10, height - 15);
  }

  // --- PAGE 1: COVER ---
  doc.setFillColor(colors.fg);
  doc.rect(0, 0, width, height, 'F');
  
  doc.setTextColor(colors.surface);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('LOGIS', margin, 80);
  
  doc.setFontSize(18);
  doc.setTextColor(colors.primary);
  doc.text('INCIDENT INTELLIGENCE REPORT', margin, 95);
  
  doc.setFontSize(12);
  doc.setTextColor(colors.muted);
  doc.text(`Incident: ${incident?.id || incidentId}`, margin, 115);
  doc.text(`Title: ${incident?.title || 'N/A'}`, margin, 122);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 129);
  
  doc.setFontSize(9);
  doc.text('SYNTHETIC DEMONSTRATION DATA', margin, height - 15);

  // --- PAGE 2: IMPACT ANALYSIS ---
  doc.addPage();
  doc.setFillColor(colors.bg);
  doc.rect(0, 0, width, height, 'F');
  
  doc.setTextColor(colors.fg);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('1. IMPACT ANALYSIS', margin, margin);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Supply chain tracing indicates the following contamination spread:', margin, margin + 10);
  
  doc.setFillColor(colors.surface);
  doc.rect(margin, margin + 15, width - 2 * margin, 40, 'F');
  doc.setTextColor(colors.critical);
  doc.setFont('helvetica', 'bold');
  doc.text('AFFECTED UNITS', margin + 10, margin + 25);
  doc.setFontSize(18);
  doc.text(`${impact?.affectedUnits || 0}`, margin + 10, margin + 35);
  doc.setFontSize(8);
  doc.text('SIMULATED', margin + 10, margin + 45);

  addFooter(2);

  // --- PAGE 3: RECOMMENDED RESPONSE ---
  doc.addPage();
  doc.setFillColor(colors.bg);
  doc.rect(0, 0, width, height, 'F');
  doc.setTextColor(colors.fg);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('2. RECOMMENDED RESPONSE', margin, margin);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Comparison between Naive broad recall and LOGIS targeted response:', margin, margin + 10);

  // Naive Card
  doc.setFillColor(colors.surface);
  doc.rect(margin, margin + 15, (width - 2 * margin) / 2 - 5, 50, 'F');
  doc.setTextColor(colors.muted);
  doc.setFontSize(10);
  doc.text('NAIVE APPROACH', margin + 5, margin + 25);
  doc.setTextColor(colors.critical);
  doc.setFontSize(14);
  doc.text(`${responseStats?.naive?.totalUnits || 0} units recalled`, margin + 5, margin + 35);
  doc.setTextColor(colors.fg);
  doc.setFontSize(12);
  doc.text(`$${((responseStats?.naive?.totalCost || 0) / 1000).toFixed(1)}k cost`, margin + 5, margin + 45);

  // Logis Card
  doc.setFillColor(colors.surface);
  doc.rect(margin + (width - 2 * margin) / 2 + 5, margin + 15, (width - 2 * margin) / 2 - 5, 50, 'F');
  doc.setTextColor(colors.muted);
  doc.setFontSize(10);
  doc.text('LOGIS RESPONSE', margin + (width - 2 * margin) / 2 + 10, margin + 25);
  doc.setTextColor(colors.success);
  doc.setFontSize(14);
  doc.text(`${responseStats?.logis?.totalUnits || 0} units recalled`, margin + (width - 2 * margin) / 2 + 10, margin + 35);
  doc.setTextColor(colors.fg);
  doc.setFontSize(12);
  doc.text(`$${((responseStats?.logis?.totalCost || 0) / 1000).toFixed(1)}k cost`, margin + (width - 2 * margin) / 2 + 10, margin + 45);

  addFooter(3);

  // --- PAGE 4: RESPONSE EXECUTION ---
  doc.addPage();
  doc.setFillColor(colors.bg);
  doc.rect(0, 0, width, height, 'F');
  doc.setTextColor(colors.fg);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('3. RESPONSE EXECUTION & TRACKER', margin, margin);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Actions generated and assigned to mitigate risk:', margin, margin + 10);
  
  doc.setFillColor(colors.surface);
  doc.rect(margin, margin + 15, width - 2 * margin, 20, 'F');
  doc.text('Action Tracker Placeholder (See live dashboard for active checks)', margin + 10, margin + 25);

  addFooter(4);

  // --- PAGE 5: RECOVERY ---
  doc.addPage();
  doc.setFillColor(colors.bg);
  doc.rect(0, 0, width, height, 'F');
  doc.setTextColor(colors.fg);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('4. RECOVERY & RESOURCE OPTIMIZATION', margin, margin);
  
  addFooter(5);

  // --- PAGE 6: CONCLUSION ---
  doc.addPage();
  doc.setFillColor(colors.bg);
  doc.rect(0, 0, width, height, 'F');
  doc.setTextColor(colors.fg);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('5. SCENARIO ANALYSIS + CONCLUSION', margin, margin);
  
  addFooter(6);

  doc.save(`LOGIS_Incident_Report_${incidentId}.pdf`);
}
