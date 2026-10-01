import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet, Play, Download, Save, Database, Code, Check,
  Loader2, AlertCircle, RefreshCw, Edit3, Trash2, Pin, ExternalLink,
  ChevronRight, ArrowRight
} from 'lucide-react';
import { api } from '../../api/apiClient';
import { usePersistentState } from '../../utils/usePersistentState';

interface TableMeta {
  tableName: string;
  category: string;
  columns: string[];
}

export interface SavedReportTemplate {
  id: number;
  name: string;
  sql: string;
  sourceMode?: 'visual' | 'sql';
  visualMeta?: {
    selectedTable: string;
    selectedCols: string[];
    joinTable?: string;
    joinCols?: string[];
    joinCondition?: string;
  };
  pinnedToSidebar?: boolean;
}

const PRESET_QUERIES = [
  {
    name: 'Patients with Assigned Doctor & Triage',
    sql: `SELECT TOP 100
    p.MRN, p.FirstName, p.LastName, 
    CASE p.Gender WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' ELSE 'Other' END AS Gender, 
    p.DateOfBirth,
    t.SystolicBP, t.DiastolicBP, t.HeartRate, t.Temperature,
    ISNULL(st.FirstName + ' ' + st.LastName, 'Attending Doctor') AS DoctorName,
    ISNULL(s.Name, 'General Practice') AS SpecializationName
FROM Patients p WITH (NOLOCK)
LEFT JOIN PatientTriage t WITH (NOLOCK) ON p.Id = t.PatientId
LEFT JOIN Doctors d WITH (NOLOCK) ON t.AssignedDoctorId = d.Id
LEFT JOIN Staff st WITH (NOLOCK) ON st.Id = d.StaffId
LEFT JOIN Specializations s WITH (NOLOCK) ON d.SpecializationId = s.Id
WHERE p.TenantId = 1
ORDER BY p.Id DESC;`
  },
  {
    name: 'Paid Invoices & Associated Items',
    sql: `SELECT TOP 100
    i.InvoiceNumber, p.MRN, p.FirstName + ' ' + p.LastName AS PatientName,
    ii.Description, ii.Quantity, ii.UnitPrice, ii.Total,
    i.TotalAmount, i.PaidAmount, ISNULL(s.Name, 'Paid') AS StatusName, i.IssueDate
FROM Invoices i WITH (NOLOCK)
JOIN Patients p WITH (NOLOCK) ON i.PatientId = p.Id
JOIN InvoiceItems ii WITH (NOLOCK) ON i.Id = ii.InvoiceId
LEFT JOIN InvoiceStatuses s WITH (NOLOCK) ON i.StatusId = s.Id
WHERE i.TenantId = 1
ORDER BY i.IssueDate DESC;`
  },
  {
    name: 'Verified Lab Results with Reference Ranges',
    sql: `SELECT TOP 100
    o.OrderNumber, p.MRN, p.FirstName + ' ' + p.LastName AS PatientName,
    ISNULL(c.TestName, 'Clinical Test') AS TestName,
    lr.NumericValue, lr.TextValue, lr.Unit, lr.Flag, lr.ReferenceRange,
    lr.EnteredAt
FROM LabResults lr WITH (NOLOCK)
JOIN LabOrders o WITH (NOLOCK) ON lr.OrderId = o.Id
JOIN Patients p WITH (NOLOCK) ON o.PatientId = p.Id
LEFT JOIN LabTestCatalog c WITH (NOLOCK) ON lr.TestId = c.Id
WHERE o.TenantId = 1
ORDER BY lr.EnteredAt DESC;`
  },
  {
    name: 'Pharmacy Dispensary Formulary & Stock Health',
    sql: `SELECT TOP 100
    GenericName, BrandName, DrugClass, Form, Strength,
    StockQuantity, MinStockLevel, CostPrice, SellingPrice
FROM DrugFormulary WITH (NOLOCK)
WHERE TenantId = 1
ORDER BY StockQuantity ASC;`
  }
];

export default function ReportBuilderPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<'visual' | 'sql'>('visual');
  const [dataSources, setDataSources] = useState<TableMeta[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

  // Visual Builder State
  const [selectedTable, setSelectedTable] = useState<string>('Patients');
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [joinTable, setJoinTable] = useState<string>('');
  const [joinCols, setJoinCols] = useState<string[]>([]);
  const [joinCondition, setJoinCondition] = useState<string>('');
  const [visualSql, setVisualSql] = useState<string>('');
  const [isCustomizedVisualSql, setIsCustomizedVisualSql] = useState<boolean>(false);

  // SQL Query State
  const [customSql, setCustomSql] = useState<string>(PRESET_QUERIES[0].sql);

  // Execution Results State
  const [results, setResults] = useState<any[]>([]);
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [exportedAlert, setExportedAlert] = useState<string | null>(null);

  // Saved Templates & Active Edit State
  const [savedTemplates, setSavedTemplates] = usePersistentState<SavedReportTemplate[]>('custom_report_templates', [
    {
      id: 1,
      name: 'Active Patients & Insurance Registry',
      sql: 'SELECT TOP 100 MRN, FirstName, LastName, InsuranceProvider FROM Patients WHERE TenantId=1 ORDER BY Id DESC;',
      sourceMode: 'visual',
      visualMeta: {
        selectedTable: 'Patients',
        selectedCols: ['MRN', 'FirstName', 'LastName', 'InsuranceProvider']
      },
      pinnedToSidebar: false
    },
    {
      id: 2,
      name: 'Revenue Invoices Audit',
      sql: 'SELECT TOP 100 InvoiceNumber, TotalAmount, PaidAmount, IssueDate FROM Invoices WHERE TenantId=1 ORDER BY Id DESC;',
      sourceMode: 'visual',
      visualMeta: {
        selectedTable: 'Invoices',
        selectedCols: ['InvoiceNumber', 'TotalAmount', 'PaidAmount', 'IssueDate']
      },
      pinnedToSidebar: false
    }
  ]);
  const [editingTemplate, setEditingTemplate] = useState<SavedReportTemplate | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [pinToSidebar, setPinToSidebar] = useState(true);

  // Intelligent Join Resolver based on genuine database schema
  const resolveDefaultJoinCondition = (tbl1: string, tbl2: string): string => {
    const s1 = dataSources.find(d => d.tableName === tbl1);
    const s2 = dataSources.find(d => d.tableName === tbl2);
    if (!s1 || !s2) return 't1.Id = t2.Id';

    const sing1 = tbl1.replace(/s$/, '');
    const sing2 = tbl2.replace(/s$/, '');

    // Check if tbl2 has tbl1's foreign key
    if (s2.columns.includes(`${sing1}Id`)) return `t1.Id = t2.[${sing1}Id]`;
    if (s2.columns.includes(`${tbl1}Id`)) return `t1.Id = t2.[${tbl1}Id]`;

    // Check if tbl1 has tbl2's foreign key
    if (s1.columns.includes(`${sing2}Id`)) return `t1.[${sing2}Id] = t2.Id`;
    if (s1.columns.includes(`${tbl2}Id`)) return `t1.[${tbl2}Id] = t2.Id`;

    // Special clinical relations
    if (tbl1 === 'Doctors' && tbl2 === 'Staff') return 't1.StaffId = t2.Id';
    if (tbl1 === 'Staff' && tbl2 === 'Users') return 't1.UserId = t2.Id';
    if (tbl1 === 'Doctors' && tbl2 === 'Specializations') return 't1.SpecializationId = t2.Id';
    if (tbl1 === 'LabOrders' && tbl2 === 'LabResults') return 't1.Id = t2.OrderId';
    if (tbl1 === 'Invoices' && tbl2 === 'InvoiceItems') return 't1.Id = t2.InvoiceId';
    if (tbl1 === 'Encounters' && tbl2 === 'Patients') return 't1.PatientId = t2.Id';
    if (tbl1 === 'Encounters' && tbl2 === 'Doctors') return 't1.DoctorId = t2.Id';

    // Shared patient or encounter link
    if (s1.columns.includes('PatientId') && s2.columns.includes('PatientId')) return 't1.PatientId = t2.PatientId';
    if (s1.columns.includes('EncounterId') && s2.columns.includes('EncounterId')) return 't1.EncounterId = t2.EncounterId';
    if (s1.columns.includes('DoctorId') && s2.columns.includes('DoctorId')) return 't1.DoctorId = t2.DoctorId';

    return 't1.Id = t2.Id';
  };

  // Build SQL string from visual parameters
  const generateVisualSql = (
    tbl: string,
    cols: string[],
    jTbl?: string,
    jCols?: string[],
    jCond?: string
  ): string => {
    const src = dataSources.find(d => d.tableName === tbl);
    const validCols = cols.filter(c => src?.columns.includes(c));
    const colsStr = validCols.length > 0 ? validCols.map(c => `t1.[${c}]`).join(', ') : 't1.*';

    let sql = '';
    if (jTbl && jCols && jCols.length > 0) {
      const jSrc = dataSources.find(d => d.tableName === jTbl);
      const validJCols = jCols.filter(c => jSrc?.columns.includes(c));
      const jColsStr = validJCols.map(c => `t2.[${c}]`).join(', ');

      const cond = jCond || resolveDefaultJoinCondition(tbl, jTbl);
      sql = `SELECT TOP 100 ${colsStr}, ${jColsStr}\nFROM [${tbl}] t1 WITH (NOLOCK)\nLEFT JOIN [${jTbl}] t2 WITH (NOLOCK) ON ${cond}`;
    } else {
      sql = `SELECT TOP 100 ${colsStr}\nFROM [${tbl}] t1 WITH (NOLOCK)`;
    }

    if (src?.columns.includes('TenantId')) {
      sql += `\nWHERE t1.TenantId = 1`;
    }

    if (src?.columns.includes('Id')) {
      sql += `\nORDER BY t1.Id DESC;`;
    } else if (src?.columns.includes('CreatedAt')) {
      sql += `\nORDER BY t1.CreatedAt DESC;`;
    } else {
      sql += `;`;
    }

    return sql;
  };

  // Load Real Data Sources from Backend
  useEffect(() => {
    const fetchSources = async () => {
      try {
        setLoadingSources(true);
        const res = await api.get<any>('/reports/datasources');
        const rawList = res?.Data || res?.data || res || [];
        if (Array.isArray(rawList) && rawList.length > 0) {
          const list: TableMeta[] = rawList.map((d: any) => ({
            tableName: d.name || d.tableName || d.Name || d.TableName,
            category: d.description || d.category || 'Database Table',
            columns: d.columns || d.Columns || []
          }));
          setDataSources(list);

          const defaultTbl = list.find(l => l.tableName === 'Patients') || list[0];
          setSelectedTable(defaultTbl.tableName);
          const initialCols = defaultTbl.columns.slice(0, 5);
          setSelectedCols(initialCols);
          const initialSql = generateVisualSql(defaultTbl.tableName, initialCols);
          setVisualSql(initialSql);
        }
      } catch (err) {
        console.warn('Failed to fetch datasources from backend, using safe schema defaults:', err);
        const fallback: TableMeta[] = [
          { tableName: 'Patients', category: 'Clinical Registry', columns: ['Id', 'MRN', 'FirstName', 'LastName', 'Gender', 'DateOfBirth', 'PrimaryPhone', 'InsuranceProvider'] },
          { tableName: 'Invoices', category: 'Financial Billing', columns: ['Id', 'InvoiceNumber', 'PatientId', 'TotalAmount', 'PaidAmount', 'StatusId', 'IssueDate'] },
          { tableName: 'InvoiceItems', category: 'Financial Billing', columns: ['Id', 'InvoiceId', 'ItemType', 'Description', 'Quantity', 'UnitPrice', 'Total'] },
          { tableName: 'Encounters', category: 'Clinical Consultations', columns: ['Id', 'PatientId', 'DoctorId', 'EncounterDate', 'ChiefComplaint', 'Assessment', 'Plan'] },
          { tableName: 'Appointments', category: 'Scheduling', columns: ['Id', 'PatientId', 'DoctorId', 'SlotDateTime', 'StatusId', 'Notes'] },
          { tableName: 'PatientTriage', category: 'Vital Signs', columns: ['Id', 'PatientId', 'SystolicBP', 'DiastolicBP', 'HeartRate', 'Temperature', 'OxygenSaturation', 'Bmi'] },
          { tableName: 'LabOrders', category: 'Diagnostic Lab', columns: ['Id', 'OrderNumber', 'PatientId', 'OrderedBy', 'OrderedAt', 'StatusId'] },
          { tableName: 'LabResults', category: 'Diagnostic Lab', columns: ['Id', 'OrderId', 'TestId', 'PatientId', 'NumericValue', 'TextValue', 'Unit', 'Flag', 'ReferenceRange'] },
          { tableName: 'DrugFormulary', category: 'Pharmacy Inventory', columns: ['Id', 'GenericName', 'BrandName', 'DrugClass', 'Form', 'Strength', 'StockQuantity', 'CostPrice', 'SellingPrice'] },
          { tableName: 'Doctors', category: 'Practitioners', columns: ['Id', 'StaffId', 'SpecializationId', 'LicenseNumber', 'ConsultationFee'] },
          { tableName: 'Staff', category: 'Practitioners', columns: ['Id', 'UserId', 'StaffCode', 'FirstName', 'LastName', 'Department', 'Phone'] },
          { tableName: 'Specializations', category: 'Catalog', columns: ['Id', 'Name', 'Code'] }
        ];
        setDataSources(fallback);
        setSelectedTable('Patients');
        const initialCols = fallback[0].columns.slice(0, 5);
        setSelectedCols(initialCols);
        setVisualSql(generateVisualSql('Patients', initialCols));
      } finally {
        setLoadingSources(false);
      }
    };
    fetchSources();
  }, []);

  // Listen for open_custom_report events from Sidebar pinned reports
  useEffect(() => {
    const handleOpenCustomReport = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.sql) {
        if (detail.sourceMode === 'visual' && detail.visualMeta) {
          loadReportIntoVisualBuilder(detail);
        } else {
          setActiveTab('sql');
          setCustomSql(detail.sql);
          setEditingTemplate(detail);
          executeQuery(detail.sql);
        }
      }
    };
    window.addEventListener('open_custom_report', handleOpenCustomReport);
    return () => window.removeEventListener('open_custom_report', handleOpenCustomReport);
  }, [dataSources]);

  // Update visual query automatically when visual selections change (if user hasn't typed custom SQL)
  const updateVisualQuery = (
    tbl: string,
    cols: string[],
    jTbl: string,
    jCols: string[],
    jCond: string
  ) => {
    const q = generateVisualSql(tbl, cols, jTbl, jCols, jCond);
    setVisualSql(q);
    setIsCustomizedVisualSql(false);
  };

  const handlePrimaryTableChange = (tblName: string) => {
    setSelectedTable(tblName);
    const tbl = dataSources.find(d => d.tableName === tblName);
    const newCols = tbl ? tbl.columns.slice(0, 5) : [];
    setSelectedCols(newCols);

    let newCond = joinCondition;
    if (joinTable) {
      newCond = resolveDefaultJoinCondition(tblName, joinTable);
      setJoinCondition(newCond);
    }
    updateVisualQuery(tblName, newCols, joinTable, joinCols, newCond);
  };

  const handleJoinTableChange = (jTblName: string) => {
    setJoinTable(jTblName);
    const meta = dataSources.find(d => d.tableName === jTblName);
    const newJCols = meta ? meta.columns.slice(0, 3) : [];
    setJoinCols(newJCols);

    let newCond = '';
    if (jTblName) {
      newCond = resolveDefaultJoinCondition(selectedTable, jTblName);
      setJoinCondition(newCond);
    } else {
      setJoinCondition('');
    }
    updateVisualQuery(selectedTable, selectedCols, jTblName, newJCols, newCond);
  };

  const handleRegenerateVisualSql = () => {
    const q = generateVisualSql(selectedTable, selectedCols, joinTable, joinCols, joinCondition);
    setVisualSql(q);
    setIsCustomizedVisualSql(false);
  };

  // Run SQL Query
  const executeQuery = async (queryToRun?: string) => {
    const q = queryToRun || (activeTab === 'sql' ? customSql : visualSql);
    if (!q || !q.trim()) return;

    setExecuting(true);
    setExecError(null);
    try {
      const res = await api.post<any>('/reports/custom-query', { query: q });
      const payload = res?.Data || res?.data || res || {};
      const rows = Array.isArray(payload) ? payload : (payload.rows || payload.Rows || []);
      if (Array.isArray(rows)) {
        setResults(rows);
      } else {
        setResults([]);
      }
    } catch (err: any) {
      console.error('Custom query error:', err);
      setExecError(err?.message || 'Error executing query. Please verify column names and SQL syntax.');
      setResults([]);
    } finally {
      setExecuting(false);
    }
  };

  // Load an existing report into the Visual Builder for editing
  const loadReportIntoVisualBuilder = (template: SavedReportTemplate) => {
    setEditingTemplate(template);
    setActiveTab('visual');
    if (template.visualMeta) {
      setSelectedTable(template.visualMeta.selectedTable);
      setSelectedCols(template.visualMeta.selectedCols || []);
      setJoinTable(template.visualMeta.joinTable || '');
      setJoinCols(template.visualMeta.joinCols || []);
      setJoinCondition(template.visualMeta.joinCondition || '');
    }
    setVisualSql(template.sql);
    setIsCustomizedVisualSql(true);
    executeQuery(template.sql);
  };

  // Load an existing report into the SQL Editor for query editing
  const loadReportIntoSqlEditor = (template: SavedReportTemplate) => {
    setEditingTemplate(template);
    setActiveTab('sql');
    setCustomSql(template.sql);
    executeQuery(template.sql);
  };

  // Delete saved template
  const handleDeleteTemplate = (id: number, name: string) => {
    if (!window.confirm(`Delete report template "${name}"?`)) return;
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);

    // Remove from pinned sidebar
    try {
      const currentPinned: any[] = JSON.parse(localStorage.getItem('pinned_custom_reports') || '[]');
      const filtered = currentPinned.filter((t: any) => t.id !== id && t.name !== name);
      localStorage.setItem('pinned_custom_reports', JSON.stringify(filtered));
      window.dispatchEvent(new Event('sidebar_reports_changed'));
    } catch {}

    if (editingTemplate?.id === id) {
      setEditingTemplate(null);
    }
  };

  // Toggle pinning of template to Sidebar Reports category
  const handleTogglePin = (template: SavedReportTemplate) => {
    const isCurrentlyPinned = !!template.pinnedToSidebar;
    const updatedTemplate = { ...template, pinnedToSidebar: !isCurrentlyPinned };
    const updatedList = savedTemplates.map(t => t.id === template.id ? updatedTemplate : t);
    setSavedTemplates(updatedList);

    try {
      let pinned: any[] = JSON.parse(localStorage.getItem('pinned_custom_reports') || '[]');
      if (!isCurrentlyPinned) {
        if (!pinned.some((p: any) => p.name === template.name)) {
          pinned.push(updatedTemplate);
        }
      } else {
        pinned = pinned.filter((p: any) => p.name !== template.name && p.id !== template.id);
      }
      localStorage.setItem('pinned_custom_reports', JSON.stringify(pinned));
      window.dispatchEvent(new Event('sidebar_reports_changed'));
    } catch {}
  };

  // Save / Update Template Handler
  const handleSaveOrUpdateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) return;

    const currentSql = activeTab === 'sql' ? customSql : visualSql;
    const visualMeta = activeTab === 'visual' ? {
      selectedTable,
      selectedCols,
      joinTable,
      joinCols,
      joinCondition
    } : editingTemplate?.visualMeta;

    let updatedTemplates: SavedReportTemplate[];
    let targetTemplate: SavedReportTemplate;

    if (editingTemplate) {
      targetTemplate = {
        ...editingTemplate,
        name: templateName,
        sql: currentSql,
        sourceMode: activeTab,
        visualMeta,
        pinnedToSidebar: pinToSidebar
      };
      updatedTemplates = savedTemplates.map(t => t.id === editingTemplate.id ? targetTemplate : t);
      setEditingTemplate(targetTemplate);
    } else {
      targetTemplate = {
        id: Date.now(),
        name: templateName,
        sql: currentSql,
        sourceMode: activeTab,
        visualMeta,
        pinnedToSidebar: pinToSidebar
      };
      updatedTemplates = [...savedTemplates, targetTemplate];
    }

    setSavedTemplates(updatedTemplates);

    // Sync with sidebar pinned reports
    try {
      let currentPinned: any[] = JSON.parse(localStorage.getItem('pinned_custom_reports') || '[]');
      if (pinToSidebar) {
        currentPinned = currentPinned.filter((p: any) => p.id !== targetTemplate.id && p.name !== targetTemplate.name);
        currentPinned.push(targetTemplate);
      } else {
        currentPinned = currentPinned.filter((p: any) => p.id !== targetTemplate.id && p.name !== targetTemplate.name);
      }
      localStorage.setItem('pinned_custom_reports', JSON.stringify(currentPinned));
      window.dispatchEvent(new Event('sidebar_reports_changed'));
    } catch {}

    setShowSaveModal(false);
    setExportedAlert(editingTemplate ? 'Template updated successfully!' : 'Template saved successfully!');
    setTimeout(() => setExportedAlert(null), 3000);
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    const keys = Object.keys(results[0]);
    const csvContent = [
      keys.join(','),
      ...results.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedAlert('CSV file downloaded successfully!');
    setTimeout(() => setExportedAlert(null), 3000);
  };

  const currentSourceMeta = dataSources.find(d => d.tableName === selectedTable);
  const joinSourceMeta = dataSources.find(d => d.tableName === joinTable);

  return (
    <div className="glass-panel" style={{ padding: isMobile ? '16px 12px' : '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: isMobile ? '1.05rem' : '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--text-main)' }}>
            <FileSpreadsheet color="#0284c7" size={22} /> Clinical & Operational Report Builder
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Build and edit reports dynamically using visual joins or direct SQL query composition
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {exportedAlert && <span className="badge badge-normal"><Check size={12} /> {exportedAlert}</span>}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', width: isMobile ? '100%' : 'auto' }}>
            <button
              onClick={() => setActiveTab('visual')}
              style={{
                flex: isMobile ? 1 : 'initial',
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.78rem',
                background: activeTab === 'visual' ? '#0284c7' : 'transparent',
                color: activeTab === 'visual' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <Database size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Visual Joins Builder
            </button>
            <button
              onClick={() => {
                setActiveTab('sql');
                if (activeTab === 'visual') {
                  setCustomSql(visualSql);
                }
              }}
              style={{
                flex: isMobile ? 1 : 'initial',
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.78rem',
                background: activeTab === 'sql' ? '#0284c7' : 'transparent',
                color: activeTab === 'sql' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <Code size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> SQL Query Editor
            </button>
          </div>
        </div>
      </div>

      {/* Editing Template Notification Banner */}
      {editingTemplate && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px',
          background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)',
          marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
            <Edit3 size={15} color="#0284c7" />
            <span>Currently Editing Template: <strong style={{ color: '#0284c7' }}>{editingTemplate.name}</strong></span>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{activeTab.toUpperCase()} Mode</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setTemplateName(editingTemplate.name);
                setPinToSidebar(!!editingTemplate.pinnedToSidebar);
                setShowSaveModal(true);
              }}
              className="btn-primary"
              style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            >
              <Save size={12} /> Save Updates
            </button>
            <button
              onClick={() => setEditingTemplate(null)}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              Done / Unlink
            </button>
          </div>
        </div>
      )}

      {/* Mode 1: Visual Builder with Multi-table Join */}
      {activeTab === 'visual' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '360px 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Controls Column */}
          <div style={{ background: '#f8fafc', padding: isMobile ? '14px' : '18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Primary Table Selection */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Primary Table ({dataSources.length} available from DB)
              </label>
              <select
                value={selectedTable}
                onChange={e => handlePrimaryTableChange(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
              >
                {dataSources.map(d => (
                  <option key={d.tableName} value={d.tableName}>
                    {d.tableName} — {d.category}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Columns Selection */}
            {currentSourceMeta && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                    Select Output Columns ({selectedCols.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const all = currentSourceMeta.columns;
                      const next = selectedCols.length === all.length ? [] : all;
                      setSelectedCols(next);
                      updateVisualQuery(selectedTable, next, joinTable, joinCols, joinCondition);
                    }}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                  >
                    {selectedCols.length === currentSourceMeta.columns.length ? 'Clear all' : 'Select all'}
                  </button>
                </div>
                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px', background: '#fff' }}>
                  {currentSourceMeta.columns.map(col => (
                    <label key={col} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedCols.includes(col)}
                        style={{ width: '14px', height: '14px', flexShrink: 0, margin: 0, cursor: 'pointer' }}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...selectedCols, col]
                            : selectedCols.filter(c => c !== col);
                          setSelectedCols(next);
                          updateVisualQuery(selectedTable, next, joinTable, joinCols, joinCondition);
                        }}
                      />
                      <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Join Secondary Table Section */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Join Secondary Table (Optional)
              </label>
              <select
                value={joinTable}
                onChange={e => handleJoinTableChange(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
              >
                <option value="">-- None (Single Table Query) --</option>
                {dataSources.filter(d => d.tableName !== selectedTable).map(d => (
                  <option key={d.tableName} value={d.tableName}>
                    {d.tableName} ({d.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Secondary Columns & Join Condition */}
            {joinSourceMeta && (
              <>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Join Condition (ON)
                  </label>
                  <input
                    type="text"
                    value={joinCondition}
                    onChange={e => {
                      setJoinCondition(e.target.value);
                      updateVisualQuery(selectedTable, selectedCols, joinTable, joinCols, e.target.value);
                    }}
                    placeholder={`e.g. t1.Id = t2.${selectedTable.replace(/s$/, '')}Id`}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                      Join Table Columns ({joinCols.length} selected)
                    </label>
                  </div>
                  <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px', background: '#fff' }}>
                    {joinSourceMeta.columns.map(col => (
                      <label key={col} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={joinCols.includes(col)}
                          style={{ width: '14px', height: '14px', flexShrink: 0, margin: 0, cursor: 'pointer' }}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...joinCols, col]
                              : joinCols.filter(c => c !== col);
                            setJoinCols(next);
                            updateVisualQuery(selectedTable, selectedCols, joinTable, next, joinCondition);
                          }}
                        />
                        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{col}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Visual Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => executeQuery(visualSql)}
                disabled={executing}
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {executing ? <Loader2 size={14} className="spin" /> : <Play size={14} />} Execute Query
              </button>
              <button
                onClick={() => {
                  setTemplateName(editingTemplate?.name || `${selectedTable} Report`);
                  setPinToSidebar(editingTemplate ? !!editingTemplate.pinnedToSidebar : true);
                  setShowSaveModal(true);
                }}
                className="btn-secondary"
                style={{ justifyContent: 'center' }}
                title="Save this query as a template"
              >
                <Save size={14} />
              </button>
            </div>
          </div>

          {/* Generated SQL Preview & EDITABLE Query Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700 }}>
                    Auto-Generated Query (Fully Editable)
                  </span>
                  {isCustomizedVisualSql && (
                    <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                      Customized in Editor
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {isCustomizedVisualSql && (
                    <button
                      onClick={handleRegenerateVisualSql}
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '3px 8px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}
                      title="Reset manual edits back to visual builder selections"
                    >
                      <RefreshCw size={11} /> Reset to Visual Query
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCustomSql(visualSql);
                      setActiveTab('sql');
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '3px 8px', background: '#1e293b', color: '#38bdf8', border: '1px solid #0284c7' }}
                  >
                    Open in Full SQL Editor <ArrowRight size={11} />
                  </button>
                </div>
              </div>

              {/* Editable Textarea for the generated query */}
              <textarea
                rows={6}
                value={visualSql}
                onChange={e => {
                  setVisualSql(e.target.value);
                  setIsCustomizedVisualSql(true);
                }}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '6px',
                  fontFamily: 'monospace', fontSize: '0.82rem',
                  background: '#090d16', color: '#38bdf8', border: '1px solid #1e293b',
                  lineHeight: 1.4, resize: 'vertical'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                💡 You can directly modify column names, add WHERE conditions, or change ORDER BY right inside this box.
              </span>
            </div>

            {/* Presets Chips */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Verified Preset Clinical Templates:
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PRESET_QUERIES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCustomSql(p.sql);
                      setActiveTab('sql');
                      setEditingTemplate(null);
                      executeQuery(p.sql);
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    ⚡ {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Custom SQL Query Editor */}
      {activeTab === 'sql' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Custom SQL Query Editor (Read-Only SELECT / WITH statements permitted)
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PRESET_QUERIES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCustomSql(p.sql);
                      setEditingTemplate(null);
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                  >
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={9}
              value={customSql}
              onChange={e => setCustomSql(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '8px',
                fontFamily: 'monospace', fontSize: '0.85rem',
                background: '#0f172a', color: '#f8fafc', border: '1px solid #334155',
                lineHeight: 1.5
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              ℹ Strictly verified server-side: SELECT queries with joins, CTEs, and aggregations permitted. DDL/DML prohibited.
            </span>
            <div style={{ display: 'flex', gap: '8px', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
              <button
                onClick={() => {
                  setTemplateName(editingTemplate?.name || '');
                  setPinToSidebar(editingTemplate ? !!editingTemplate.pinnedToSidebar : true);
                  setShowSaveModal(true);
                }}
                className="btn-secondary"
              >
                <Save size={14} /> {editingTemplate ? 'Update / Save Template' : 'Save Template'}
              </button>
              <button
                onClick={() => executeQuery(customSql)}
                disabled={executing}
                className="btn-primary"
                style={{ padding: '8px 20px' }}
              >
                {executing ? <Loader2 size={14} className="spin" /> : <Play size={14} />} Run Query
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {execError && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.82rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{execError}</span>
        </div>
      )}

      {/* Query Results Table */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0284c7', margin: 0 }}>
            Results ({results.length} record{results.length !== 1 ? 's' : ''} returned)
          </h4>
          {results.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Download size={13} /> Export to CSV
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {executing ? 'Executing query on database...' : 'Run a query or execute from visual builder to view records.'}
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '420px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table className="cms-table" style={{ margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                <tr>
                  {Object.keys(results[0]).map(col => (
                    <th key={col} style={{ whiteSpace: 'nowrap' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, idx) => (
                  <tr key={idx}>
                    {Object.keys(results[0]).map(col => (
                      <td key={col} style={{ whiteSpace: 'nowrap' }}>
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Saved Templates Management List */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Saved Custom Report Templates ({savedTemplates.length})
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Click Run to execute, or choose Edit (Visual/SQL) to modify the report
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
          {savedTemplates.map((t: SavedReportTemplate) => {
            const isEditing = editingTemplate?.id === t.id;
            return (
              <div
                key={t.id}
                style={{
                  padding: '12px', borderRadius: '8px',
                  background: isEditing ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                  border: isEditing ? '1px solid #0284c7' : '1px solid #e2e8f0',
                  display: 'flex', flexDirection: 'column', gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileSpreadsheet size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleTogglePin(t)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                        color: t.pinnedToSidebar ? '#0284c7' : '#94a3b8'
                      }}
                      title={t.pinnedToSidebar ? 'Pinned in sidebar (Click to unpin)' : 'Click to pin in sidebar Reports category'}
                    >
                      <Pin size={13} fill={t.pinnedToSidebar ? '#0284c7' : 'none'} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id, t.name)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#ef4444' }}
                      title="Delete template"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.sql}
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  <button
                    onClick={() => {
                      if (activeTab === 'sql') setCustomSql(t.sql);
                      else setVisualSql(t.sql);
                      executeQuery(t.sql);
                    }}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.72rem', justifyContent: 'center' }}
                  >
                    <Play size={11} /> Run
                  </button>

                  {t.visualMeta ? (
                    <button
                      onClick={() => loadReportIntoVisualBuilder(t)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', background: '#f1f5f9', color: '#0284c7', borderColor: '#cbd5e1' }}
                      title="Edit visually using table joins and column pickers"
                    >
                      <Edit3 size={11} /> Edit (Visual)
                    </button>
                  ) : null}

                  <button
                    onClick={() => loadReportIntoSqlEditor(t)}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.72rem', background: '#f1f5f9', color: '#334155', borderColor: '#cbd5e1' }}
                    title="Edit directly in SQL Query Editor"
                  >
                    <Code size={11} /> Edit (SQL)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Save / Update Template */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: isMobile ? '16px' : '24px', background: '#fff', color: '#1c1917', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-main)' }}>
              {editingTemplate ? 'Update Report Template' : 'Save as Custom Template'}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
              Save this report configuration to run it anytime or pin it into the sidebar navigation.
            </p>

            <form onSubmit={handleSaveOrUpdateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Report Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g. Monthly Clinical Encounters by Doctor"
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              {/* Pin to sidebar option */}
              <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={pinToSidebar}
                  onChange={e => setPinToSidebar(e.target.checked)}
                  style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>Include in sidebar under <strong>Reports</strong> category</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setShowSaveModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  <Save size={14} /> {editingTemplate ? 'Save Changes' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
