import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Search, Filter, RefreshCw, Calendar, Clock,
  User, Database, Globe, Eye, FileText, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, ArrowRight, X, Download
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface AuditLogEntry {
  id: number;
  tenantId: number;
  tableName: string;
  recordId: string;
  operation: string;
  oldValues: string | null;
  newValues: string | null;
  changedBy: number | null;
  userName: string | null;
  changedAt: string;
  ipAddress: string | null;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [tableName, setTableName] = useState('');
  const [operation, setOperation] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected Log for Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        pageSize,
        keyword: keyword.trim() || undefined,
        tableName: tableName || undefined,
        operation: operation.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      };

      const res: any = await api.get<any>('/audit/logs', params);
      const data = res?.data ?? res?.Data ?? res ?? [];
      const meta = res?.meta ?? res?.Meta ?? {};

      setLogs(Array.isArray(data) ? data : []);
      setTotalCount(meta.Total ?? meta.total ?? 0);
      setCurrentPage(meta.Page ?? meta.page ?? page);
      setTotalPages(meta.TotalPages ?? meta.totalPages ?? 1);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCurrentPage(1);
    fetchLogs(1);
  };

  const handleReset = () => {
    setKeyword('');
    setTableName('');
    setOperation('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
    setTimeout(() => {
      fetchLogs(1);
    }, 0);
  };

  const formatTimestamp = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getOperationBadge = (op: string) => {
    const upper = (op || '').toUpperCase();
    if (upper.includes('DELETE') || upper.includes('REVOKE') || upper.includes('FAIL')) {
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    }
    if (upper.includes('CREATE') || upper.includes('INSERT') || upper.includes('LOGIN')) {
      return { bg: '#dcfce7', text: '#15803d', border: '#86efac' };
    }
    if (upper.includes('UPDATE') || upper.includes('EDIT') || upper.includes('RESET')) {
      return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
    }
    if (upper.includes('VIEW') || upper.includes('READ') || upper.includes('GET')) {
      return { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' };
    }
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  };

  const formatJson = (val: string | null) => {
    if (!val) return null;
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: '#fff',
            borderRadius: '12px',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Audit & Compliance Trail
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Complete HIPAA-compliant audit logs for chart access, security events, clinical orders, and database mutations.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchLogs(currentPage)}
          disabled={loading}
          className="btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter Card */}
      <form
        onSubmit={handleSearch}
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid var(--border-color, #e2e8f0)',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              Keyword (Record ID, User, IP)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search logs..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  fontSize: '0.85rem',
                  background: 'var(--bg-input, #fff)',
                  color: 'var(--text-main)'
                }}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              Target Table
            </label>
            <select
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: '0.85rem',
                background: 'var(--bg-input, #fff)',
                color: 'var(--text-main)'
              }}
            >
              <option value="">All Tables</option>
              <option value="Patients">Patients (Charts)</option>
              <option value="Encounters">Encounters (SOAP)</option>
              <option value="Prescriptions">Prescriptions</option>
              <option value="LabOrders">Lab Orders</option>
              <option value="Invoices">Invoices & Billing</option>
              <option value="Users">Users & Auth</option>
              <option value="Roles">Roles & Permissions</option>
              <option value="Appointments">Appointments</option>
              <option value="Beds">Inpatient Beds</option>
              <option value="Admissions">Admissions</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              Operation
            </label>
            <input
              type="text"
              placeholder="e.g. VIEW_CHART, CREATE"
              value={operation}
              onChange={e => setOperation(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: '0.85rem',
                background: 'var(--bg-input, #fff)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: '0.85rem',
                background: 'var(--bg-input, #fff)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: '0.85rem',
                background: 'var(--bg-input, #fff)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{
                flex: 1,
                padding: '8px 14px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Filter
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary"
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* Main Table Card */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #e2e8f0)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        {/* Table summary bar */}
        <div style={{
          padding: '12px 20px',
          background: 'var(--bg-surface, #f8fafc)',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            Showing <strong style={{ color: 'var(--text-main)' }}>{logs.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-main)' }}>{totalCount}</strong> recorded events
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Page Size:</span>
            <select
              value={pageSize}
              onChange={e => {
                const ps = Number(e.target.value);
                setPageSize(ps);
                setTimeout(() => fetchLogs(1), 0);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: '0.8rem',
                background: 'var(--bg-card, #fff)'
              }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface, #f1f5f9)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}># ID</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Timestamp</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>User / Staff</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>IP Address</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Table</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Record ID</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Operation</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Changes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No audit records found matching the current criteria.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const badge = getOperationBadge(log.operation);
                  const hasChanges = Boolean(log.oldValues || log.newValues);

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-color, #f1f5f9)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover, #f8fafc)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>
                        #{log.id}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={13} style={{ color: '#94a3b8' }} />
                          <span>{formatTimestamp(log.changedAt)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <User size={14} style={{ color: '#3b82f6' }} />
                          <span>{log.userName || 'System'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Globe size={12} style={{ color: '#94a3b8' }} />
                          <span>{log.ipAddress || '127.0.0.1'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.78rem',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: '#334155'
                        }}>
                          {log.tableName}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                        {log.recordId}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`
                        }}>
                          {log.operation}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {hasChanges ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#2563eb',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={12} />
                            Diff
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.85rem'
        }}>
          <div style={{ color: 'var(--text-muted)' }}>
            Page <strong style={{ color: 'var(--text-main)' }}>{currentPage}</strong> of{' '}
            <strong style={{ color: 'var(--text-main)' }}>{totalPages}</strong>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => fetchLogs(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              onClick={() => fetchLogs(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.5 : 1
              }}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Changes / Diff Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-color, #e2e8f0)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Audit Record Diff — #{selectedLog.id}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedLog.tableName} · Record ID: {selectedLog.recordId} · Operation: {selectedLog.operation} · User: {selectedLog.userName || 'System'}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: selectedLog.oldValues && selectedLog.newValues ? '1fr 1fr' : '1fr',
                gap: '16px'
              }}>
                {selectedLog.oldValues && (
                  <div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: '#b91c1c',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                      Before / Old State
                    </div>
                    <pre style={{
                      margin: 0,
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      padding: '14px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      maxHeight: '400px'
                    }}>
                      {formatJson(selectedLog.oldValues)}
                    </pre>
                  </div>
                )}

                {selectedLog.newValues && (
                  <div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: '#15803d',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                      After / New State
                    </div>
                    <pre style={{
                      margin: 0,
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      padding: '14px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      maxHeight: '400px'
                    }}>
                      {formatJson(selectedLog.newValues)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--bg-surface, #f8fafc)'
            }}>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="btn-primary"
                style={{ padding: '8px 20px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
