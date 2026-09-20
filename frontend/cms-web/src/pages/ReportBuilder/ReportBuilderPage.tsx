import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Play, Download, Save, Database, Code, Check, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../api/apiClient';
import { usePersistentState } from '../../utils/usePersistentState';

interface TableMeta {
  tableName: string;
  category: string;
  columns: string[];
}

const PRESET_QUERIES = [
  {
    name: 'Patients with Assigned Doctor & Triage',
    sql: `SELECT p.MRN, p.FirstName, p.LastName, p.Gender, p.DateOfBirth,
       t.SystolicBP, t.DiastolicBP, t.HeartRate, t.Temperature,
       d.DoctorName, s.SpecializationName
FROM Patients p
LEFT JOIN PatientTriage t ON p.Id = t.PatientId
LEFT JOIN Doctors d ON t.AssignedDoctorId = d.Id
LEFT JOIN Specializations s ON d.SpecializationId = s.Id
WHERE p.TenantId = 1
ORDER BY p.CreatedAt DESC;`
  },
  {
    name: 'Paid Invoices & Associated Items',
    sql: `SELECT i.InvoiceNo, p.MRN, p.FirstName + ' ' + p.LastName AS PatientName,
       ii.ItemName, ii.Quantity, ii.UnitPrice, ii.TotalPrice,
       i.TotalAmount, i.PaidAmount, s.StatusName, i.IssueDate
FROM Invoices i
JOIN Patients p ON i.PatientId = p.Id
JOIN InvoiceItems ii ON i.Id = ii.InvoiceId
LEFT JOIN InvoiceStatuses s ON i.StatusId = s.Id
WHERE i.TenantId = 1 AND i.StatusId = 4
ORDER BY i.IssueDate DESC;`
  },
  {
    name: 'Verified Lab Results with Reference Ranges',
    sql: `SELECT o.OrderNumber, p.MRN, p.FirstName + ' ' + p.LastName AS PatientName,
       c.TestName, lr.ParameterName, lr.NumericValue, lr.Unit, lr.Flag, lr.ReferenceRange,
       lr.EnteredAt
FROM LabResults lr
JOIN LabOrders o ON lr.OrderId = o.Id
JOIN Patients p ON o.PatientId = p.Id
LEFT JOIN LabTestCatalog c ON o.TestCatalogId = c.Id
WHERE o.TenantId = 1 AND lr.IsVerified = 1
ORDER BY lr.EnteredAt DESC;`
  },
  {
    name: 'Pharmacy Dispensary Formulary & Stock Health',
    sql: `SELECT DrugCode, GenericName, BrandName, Form, Strength,
       StockQuantity, MinStockLevel, CostPrice, SellingPrice
FROM DrugFormulary
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

  // SQL Query State
  const [customSql, setCustomSql] = useState<string>(PRESET_QUERIES[0].sql);

  // Execution Results State
  const [results, setResults] = useState<any[]>([]);
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [exportedAlert, setExportedAlert] = useState<string | null>(null);

  // Saved Templates
  const [savedTemplates, setSavedTemplates] = usePersistentState('custom_report_templates', [
    { id: 1, name: 'Active Patients & Insurance', sql: 'SELECT MRN, FirstName, LastName, InsuranceProvider FROM Patients WHERE TenantId=1;' },
    { id: 2, name: 'Revenue Invoices Audit', sql: 'SELECT InvoiceNo, TotalAmount, PaidAmount, IssueDate FROM Invoices WHERE TenantId=1;' }
  ]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

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
            category: d.description || d.category || 'Database',
            columns: d.columns || d.Columns || []
          }));
          setDataSources(list);
          const first = list[0];
          setSelectedTable(first.tableName);
          setSelectedCols(first.columns.slice(0, 5));
        }
      } catch (err) {
        console.warn('Failed to fetch datasources from backend, using defaults:', err);
        const fallback: TableMeta[] = [
          { tableName: 'Patients', category: 'Clinical', columns: ['Id', 'MRN', 'FirstName', 'LastName', 'Gender', 'DateOfBirth', 'PrimaryPhone', 'InsuranceProvider'] },
          { tableName: 'Invoices', category: 'Financial', columns: ['Id', 'InvoiceNo', 'PatientId', 'TotalAmount', 'PaidAmount', 'StatusId', 'IssueDate'] },
          { tableName: 'InvoiceItems', category: 'Financial', columns: ['Id', 'InvoiceId', 'ItemName', 'Quantity', 'UnitPrice', 'TotalPrice'] },
          { tableName: 'LabOrders', category: 'Clinical', columns: ['Id', 'OrderNumber', 'PatientId', 'DoctorId', 'OrderDate', 'StatusId'] },
          { tableName: 'LabResults', category: 'Clinical', columns: ['Id', 'OrderId', 'ParameterName', 'NumericValue', 'Unit', 'Flag', 'IsVerified'] },
          { tableName: 'DrugFormulary', category: 'Inventory', columns: ['Id', 'DrugCode', 'GenericName', 'BrandName', 'StockQuantity', 'CostPrice', 'SellingPrice'] },
          { tableName: 'Doctors', category: 'Staff', columns: ['Id', 'StaffId', 'DoctorName', 'SpecializationId', 'LicenseNumber'] },
          { tableName: 'PatientTriage', category: 'Clinical', columns: ['Id', 'PatientId', 'SystolicBP', 'DiastolicBP', 'HeartRate', 'Temperature', 'AssignedDoctorId'] }
        ];
        setDataSources(fallback);
        setSelectedTable('Patients');
        setSelectedCols(fallback[0].columns.slice(0, 5));
      } finally {
        setLoadingSources(false);
      }
    };
    fetchSources();
  }, []);

  const handleTableSelect = (tblName: string) => {
    setSelectedTable(tblName);
    const tbl = dataSources.find(d => d.tableName === tblName);
    if (tbl) {
      setSelectedCols(tbl.columns.slice(0, 5));
    }
  };

  // Run Custom SQL via Backend Read-Only Controller
  const executeQuery = async (queryToRun?: string) => {
    const q = queryToRun || (activeTab === 'sql' ? customSql : buildVisualQuery());
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
      setExecError(err?.message || 'Error executing query. Only SELECT queries are permitted.');
      setResults([]);
    } finally {
      setExecuting(false);
    }
  };

  // Build query from visual controls
  const buildVisualQuery = (): string => {
    const cols = selectedCols.length > 0 ? selectedCols.map(c => `t1.[${c}]`).join(', ') : 't1.*';
    let sql = `SELECT TOP 100 ${cols} FROM [${selectedTable}] t1`;
    if (joinTable && joinCols.length > 0) {
      const joinColsStr = joinCols.map(c => `t2.[${c}]`).join(', ');
      sql = `SELECT TOP 100 ${cols}, ${joinColsStr} FROM [${selectedTable}] t1 LEFT JOIN [${joinTable}] t2 ON t1.Id = t2.[${selectedTable === 'Invoices' ? 'InvoiceId' : 'PatientId'}]`;
    }
    sql += ` WHERE t1.TenantId = 1 ORDER BY t1.Id DESC;`;
    return sql;
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
    a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedAlert('CSV file downloaded successfully!');
    setTimeout(() => setExportedAlert(null), 3000);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) return;
    const q = activeTab === 'sql' ? customSql : buildVisualQuery();
    setSavedTemplates([...savedTemplates, { id: Date.now(), name: templateName, sql: q }]);
    setShowSaveModal(false);
    setTemplateName('');
  };

  const currentSourceMeta = dataSources.find(d => d.tableName === selectedTable);
  const joinSourceMeta = dataSources.find(d => d.tableName === joinTable);

  return (
    <div className="glass-panel" style={{ padding: isMobile ? '16px 12px' : '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet color="#06b6d4" size={20} /> Advanced Clinical & Operational Report Builder
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Join multiple database sources or compose custom read-only SQL queries
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
              onClick={() => setActiveTab('sql')}
              style={{
                flex: isMobile ? 1 : 'initial',
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.78rem',
                background: activeTab === 'sql' ? '#0284c7' : 'transparent',
                color: activeTab === 'sql' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <Code size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Custom SQL Query
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Visual Builder with Multi-table Join */}
      {activeTab === 'visual' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Config column */}
          <div style={{ background: '#f8fafc', padding: isMobile ? '14px' : '18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Primary Table ({dataSources.length} available)
              </label>
              <select
                value={selectedTable}
                onChange={e => handleTableSelect(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                {dataSources.map(d => (
                  <option key={d.tableName} value={d.tableName}>
                    {d.tableName} ({d.category})
                  </option>
                ))}
              </select>
            </div>

            {currentSourceMeta && (
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Select Output Columns
                </label>
                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px', background: '#fff' }}>
                  {currentSourceMeta.columns.map(col => (
                    <label key={col} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedCols.includes(col)}
                        style={{ width: '14px', height: '14px', flexShrink: 0, margin: 0, cursor: 'pointer' }}
                        onChange={e => {
                          if (e.target.checked) setSelectedCols([...selectedCols, col]);
                          else setSelectedCols(selectedCols.filter(c => c !== col));
                        }}
                      />
                      {col}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Join Table Section */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Join Secondary Table (Optional)
              </label>
              <select
                value={joinTable}
                onChange={e => {
                  setJoinTable(e.target.value);
                  const meta = dataSources.find(d => d.tableName === e.target.value);
                  if (meta) setJoinCols(meta.columns.slice(0, 3));
                  else setJoinCols([]);
                }}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="">-- None (Single Table) --</option>
                {dataSources.filter(d => d.tableName !== selectedTable).map(d => (
                  <option key={d.tableName} value={d.tableName}>{d.tableName} ({d.category})</option>
                ))}
              </select>
            </div>

            {joinSourceMeta && (
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Join Table Columns
                </label>
                <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px', background: '#fff' }}>
                  {joinSourceMeta.columns.map(col => (
                    <label key={col} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={joinCols.includes(col)}
                        style={{ width: '14px', height: '14px', flexShrink: 0, margin: 0, cursor: 'pointer' }}
                        onChange={e => {
                          if (e.target.checked) setJoinCols([...joinCols, col]);
                          else setJoinCols(joinCols.filter(c => c !== col));
                        }}
                      />
                      {col}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => executeQuery()}
                disabled={executing}
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Execute
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                className="btn-secondary"
                style={{ justifyContent: 'center' }}
              >
                <Save size={14} />
              </button>
            </div>
          </div>

          {/* Generated SQL preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem', minHeight: '80px', overflowX: 'auto', border: '1px solid #1e293b' }}>
              <div style={{ color: '#64748b', marginBottom: '6px', fontSize: '0.7rem' }}>-- Generated Query --</div>
              {buildVisualQuery()}
            </div>

            {/* Presets chips */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Preset Templates:
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PRESET_QUERIES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCustomSql(p.sql);
                      setActiveTab('sql');
                      executeQuery(p.sql);
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Custom SQL Query (Read-Only SELECT permitted)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {PRESET_QUERIES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setCustomSql(p.sql)}
                    className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                  >
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={8}
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
              ℹ Strict server validation: Only SELECT / WITH queries permitted. DDL/DML prohibited.
            </span>
            <div style={{ display: 'flex', gap: '8px', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
              <button onClick={() => setShowSaveModal(true)} className="btn-secondary">
                <Save size={14} /> Save Template
              </button>
              <button
                onClick={() => executeQuery()}
                disabled={executing}
                className="btn-primary"
                style={{ padding: '8px 20px' }}
              >
                {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run Query
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
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0284c7' }}>
            Results ({results.length} records returned)
          </h4>
          {results.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }}>
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

      {/* Saved Templates List */}
      <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>
          Saved Custom Templates ({savedTemplates.length})
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {savedTemplates.map((t: any) => (
            <button
              key={t.id}
              onClick={() => {
                setCustomSql(t.sql);
                setActiveTab('sql');
                executeQuery(t.sql);
              }}
              className="btn-secondary"
              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
            >
              <FileSpreadsheet size={11} color="#0284c7" /> {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Modal: Save Template */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: isMobile ? '16px' : '24px', background: '#fff', color: '#1c1917', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px' }}>Save Query as Template</h3>
            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#475569' }}>Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g. Monthly Department Revenue"
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowSaveModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
