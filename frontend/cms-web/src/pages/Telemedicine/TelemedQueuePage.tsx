import React, { useState, useEffect, useCallback } from 'react';
import {
  Video, Phone, MessageSquare, Clock, CheckCircle, Search,
  RefreshCw, AlertCircle, Play, DollarSign, Calendar,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X
} from 'lucide-react';
import { api } from '../../api/apiClient';
import TelemedChatDrawer from '../../components/TelemedChatDrawer';

interface TelemedSession {
  id: number;
  sessionNumber: string;
  patientId: number;
  patientName: string;
  platform: string;
  statusId: number;
  chiefComplaint?: string;
  consultationFee: number;
  doctorName?: string;
  doctorId?: number;
  createdAt: string;
  startedAt?: string;
  endTime?: string;
  unreadCount?: number;
}

const STATUS_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Pending Payment', color: '#ff9500', bg: '#fff8eb' },
  2: { label: 'Waiting in Queue', color: '#0071e3', bg: '#eff6ff' },
  3: { label: 'In Consultation', color: '#34c759', bg: '#ecfdf5' },
  4: { label: 'Completed', color: '#6e6e73', bg: '#f5f5f7' },
  5: { label: 'Cancelled', color: '#ff3b30', bg: '#fff5f5' }
};

const getSessionLocalDate = (isoString: string) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.split('T')[0] || '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return isoString.split('T')[0] || '';
  }
};

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function TelemedQueuePage() {
  const [sessions, setSessions] = useState<TelemedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // Date Filter State
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayString());

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);

  const fetchSessions = useCallback(async () => {
    try {
      const res: any = await api.get('/telemed/sessions');
      const rawList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.Data) ? res.Data : []));
      
      const normalized: TelemedSession[] = rawList.map((s: any) => ({
        id: s.id ?? s.Id,
        sessionNumber: s.sessionNumber ?? s.SessionNumber ?? '',
        patientId: s.patientId ?? s.PatientId ?? 0,
        patientName: s.patientName ?? s.PatientName ?? 'Unknown Patient',
        platform: s.platform ?? s.Platform ?? 'Telegram',
        statusId: s.statusId ?? s.StatusId ?? 1,
        chiefComplaint: s.chiefComplaint ?? s.ChiefComplaint ?? '',
        consultationFee: s.consultationFee ?? s.ConsultationFee ?? 0,
        doctorName: s.doctorName ?? s.DoctorName,
        doctorId: s.doctorId ?? s.DoctorId,
        createdAt: s.createdAt ?? s.CreatedAt ?? '',
        startedAt: s.actualStartTime ?? s.ActualStartTime ?? s.startedAt,
        endTime: s.endTime ?? s.EndTime,
        unreadCount: s.unreadCount ?? s.UnreadCount ?? 0
      }));
      setSessions(normalized);
    } catch (err) {
      console.error('Failed to load telemed sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handlePrevDay = () => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    base.setDate(base.getDate() - 1);
    const year = base.getFullYear();
    const month = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
    setCurrentPage(1);
  };

  const handleNextDay = () => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    base.setDate(base.getDate() + 1);
    const year = base.getFullYear();
    const month = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
    setCurrentPage(1);
  };

  // Sessions filtered by date (for KPI summary)
  const dateScopedSessions = sessions.filter(s => {
    if (!selectedDate) return true;
    return getSessionLocalDate(s.createdAt) === selectedDate;
  });

  const totalWaiting = dateScopedSessions.filter(s => s.statusId === 2).length;
  const totalActive = dateScopedSessions.filter(s => s.statusId === 3).length;
  const totalCompleted = dateScopedSessions.filter(s => s.statusId === 4).length;
  const totalRevenue = dateScopedSessions
    .filter(s => s.statusId === 3 || s.statusId === 4)
    .reduce((sum, s) => sum + (s.consultationFee || 0), 0);

  const filteredSessions = sessions.filter(s => {
    if (selectedDate && getSessionLocalDate(s.createdAt) !== selectedDate) return false;
    if (filterStatus !== 'ALL' && s.statusId.toString() !== filterStatus) return false;
    if (filterPlatform !== 'ALL' && !s.platform?.toLowerCase().includes(filterPlatform.toLowerCase())) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.patientName?.toLowerCase().includes(q);
      const matchNum = s.sessionNumber?.toLowerCase().includes(q);
      const matchComplaint = s.chiefComplaint?.toLowerCase().includes(q);
      const matchDoc = s.doctorName?.toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchComplaint && !matchDoc) return false;
    }
    return true;
  });

  // Pagination calculation
  const totalItems = filteredSessions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedSessions = filteredSessions.slice(startIndex, startIndex + pageSize);

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
            Virtual Telemedicine Clinic
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            Manage remote consultations initiated via Telegram Bot & WhatsApp Business Cloud.
          </p>
        </div>
        <button
          onClick={fetchSessions}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            border: '1.5px solid var(--border-color)', background: 'var(--bg-card)',
            cursor: 'pointer', fontSize: 13, color: 'var(--text-main)'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>IN QUEUE (WAITING)</span>
            <Clock size={16} color="#0071e3" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>{totalWaiting}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>LIVE CONSULTATIONS</span>
            <Video size={16} color="#34c759" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>{totalActive}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>COMPLETED SESSIONS</span>
            <CheckCircle size={16} color="#6e6e73" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>{totalCompleted}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>SETTLED REVENUE</span>
            <DollarSign size={16} color="#ff9500" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>Br {totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Filter and Date Navigation Bar */}
      <div style={{
        background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20
      }}>
        {/* Top Filter Row: Search + Status + Platform */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search patient, doctor, session #, complaint..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%', padding: '8px 32px 8px 36px', borderRadius: 8,
                border: '1.5px solid var(--border-color)', background: 'var(--bg-input)',
                fontSize: 13, color: 'var(--text-main)', boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                style={{ position: 'absolute', right: 10, top: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)',
                background: 'var(--bg-input)', fontSize: 13, color: 'var(--text-main)'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="1">Pending Payment</option>
              <option value="2">Waiting in Queue</option>
              <option value="3">In Consultation</option>
              <option value="4">Completed</option>
            </select>

            <select
              value={filterPlatform}
              onChange={e => { setFilterPlatform(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)',
                background: 'var(--bg-input)', fontSize: 13, color: 'var(--text-main)'
              }}
            >
              <option value="ALL">All Platforms</option>
              <option value="Telegram">Telegram</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
          </div>
        </div>

        {/* Bottom Date Picker & Navigation Row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          paddingTop: 10, borderTop: '1px solid var(--border-color)'
        }}>
          {/* Date controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0071e3', fontWeight: 600, fontSize: 13, marginRight: 4 }}>
              <Calendar size={16} /> Date Filter:
            </div>

            <button
              onClick={handlePrevDay}
              title="Previous Day"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-color)',
                background: 'var(--bg-input)', color: 'var(--text-main)', cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--border-color)',
                background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 13, fontWeight: 600
              }}
            />

            <button
              onClick={handleNextDay}
              title="Next Day"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-color)',
                background: 'var(--bg-input)', color: 'var(--text-main)', cursor: 'pointer'
              }}
            >
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => { setSelectedDate(getTodayString()); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: selectedDate === getTodayString() ? '1.5px solid #0071e3' : '1px solid var(--border-color)',
                background: selectedDate === getTodayString() ? '#eff6ff' : 'var(--bg-input)',
                color: selectedDate === getTodayString() ? '#0071e3' : 'var(--text-main)'
              }}
            >
              Today
            </button>

            <button
              onClick={() => { setSelectedDate(''); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: !selectedDate ? '1.5px solid #059669' : '1px solid var(--border-color)',
                background: !selectedDate ? '#ecfdf5' : 'var(--bg-input)',
                color: !selectedDate ? '#059669' : 'var(--text-main)'
              }}
            >
              All Dates
            </button>
          </div>

          {/* Active Date & Results Badge */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>
              {selectedDate ? (
                <>Showing sessions for: <strong style={{ color: 'var(--text-main)' }}>{selectedDate === getTodayString() ? `Today (${selectedDate})` : selectedDate}</strong></>
              ) : (
                <>Showing sessions for: <strong style={{ color: 'var(--text-main)' }}>All Recorded Dates</strong></>
              )}
            </span>
            <span style={{
              background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 10,
              fontSize: 11, fontWeight: 700, color: 'var(--text-main)', border: '1px solid var(--border-color)'
            }}>
              {totalItems} total
            </span>
          </div>
        </div>
      </div>

      {/* Sessions Grid */}
      {paginatedSessions.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', padding: 48, borderRadius: 12,
          border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)'
        }}>
          <MessageSquare size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: 'var(--text-main)' }}>
            No consultations found for {selectedDate ? selectedDate : 'selected filters'}
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13 }}>
            {selectedDate
              ? 'Try picking another date, switching to "All Dates", or clearing status filters.'
              : 'Inbound messages from Telegram and WhatsApp will appear here automatically.'}
          </p>
          {selectedDate && (
            <button
              onClick={() => { setSelectedDate(''); setCurrentPage(1); }}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#0071e3', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              View All Dates
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {paginatedSessions.map(session => {
            const st = STATUS_CONFIG[session.statusId] || { label: 'Unknown', color: '#6e6e73', bg: '#f5f5f7' };
            const isTelegram = session.platform?.toLowerCase().includes('telegram');

            return (
              <div
                key={session.id}
                style={{
                  background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)',
                  padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                {/* Top Row: Session No & Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {session.sessionNumber}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12,
                    background: st.bg, color: st.color
                  }}>
                    {st.label}
                  </span>
                </div>

                {/* Patient Information */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                      {session.patientName}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                      background: isTelegram ? '#e8f4fd' : '#e6f9f0',
                      color: isTelegram ? '#0088cc' : '#25d366'
                    }}>
                      {isTelegram ? 'Telegram' : 'WhatsApp'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {session.chiefComplaint || 'Routine tele-consultation request'}
                  </div>
                  {session.doctorName && (
                    <div style={{ fontSize: 12, color: '#0071e3', fontWeight: 600, marginTop: 4 }}>
                      👨‍⚕️ {session.doctorName}
                    </div>
                  )}
                </div>

                {/* Meta details */}
                <div style={{
                  fontSize: 12, color: 'var(--text-secondary)', display: 'flex',
                  justifyContent: 'space-between', padding: '8px 0',
                  borderTop: '1px dashed var(--border-color)', borderBottom: '1px dashed var(--border-color)'
                }}>
                  <span>Fee: <strong>Br {session.consultationFee?.toFixed(2)}</strong></span>
                  <span>{session.createdAt ? new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>

                {/* Action button */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    onClick={() => setSelectedSession({
                      Id: session.id,
                      SessionNumber: session.sessionNumber,
                      PatientName: session.patientName,
                      Platform: session.platform,
                      StatusId: session.statusId,
                      ChiefComplaint: session.chiefComplaint,
                      ConsultationFee: session.consultationFee
                    })}
                    style={{
                      flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none',
                      background: session.statusId === 3 ? '#34c759' : '#0071e3',
                      color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    {session.statusId === 3 ? (
                      <>
                        <Video size={14} /> Continue Consultation
                      </>
                    ) : session.statusId === 4 ? (
                      <>
                        <CheckCircle size={14} /> View History
                      </>
                    ) : (
                      <>
                        <Play size={14} /> Open Consultation
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalItems > 0 && (
        <div style={{
          marginTop: 24, padding: '14px 18px', background: 'var(--bg-card)',
          borderRadius: 12, border: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12
        }}>
          {/* Left: Summary text */}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(startIndex + pageSize, totalItems)}</strong> of <strong>{totalItems}</strong> consultations
          </div>

          {/* Center/Right: Page size selector and page controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                style={{
                  padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 12, fontWeight: 600
                }}
              >
                <option value="6">6</option>
                <option value="9">9</option>
                <option value="15">15</option>
                <option value="30">30</option>
              </select>
            </div>

            {/* Pagination buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={validPage <= 1}
                title="First Page"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)', color: 'var(--text-main)',
                  cursor: validPage <= 1 ? 'not-allowed' : 'pointer', opacity: validPage <= 1 ? 0.4 : 1
                }}
              >
                <ChevronsLeft size={16} />
              </button>

              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={validPage <= 1}
                title="Previous Page"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)', color: 'var(--text-main)',
                  cursor: validPage <= 1 ? 'not-allowed' : 'pointer', opacity: validPage <= 1 ? 0.4 : 1
                }}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page Number Badges */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - validPage) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && (
                        <span style={{ padding: '0 4px', color: 'var(--text-secondary)', fontSize: 13 }}>…</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(p)}
                        style={{
                          minWidth: 32, height: 32, padding: '0 8px', borderRadius: 6,
                          border: p === validPage ? '1.5px solid #0071e3' : '1px solid var(--border-color)',
                          background: p === validPage ? '#0071e3' : 'var(--bg-input)',
                          color: p === validPage ? '#ffffff' : 'var(--text-main)',
                          fontWeight: p === validPage ? 700 : 500, fontSize: 13, cursor: 'pointer'
                        }}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={validPage >= totalPages}
                title="Next Page"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)', color: 'var(--text-main)',
                  cursor: validPage >= totalPages ? 'not-allowed' : 'pointer', opacity: validPage >= totalPages ? 0.4 : 1
                }}
              >
                <ChevronRight size={16} />
              </button>

              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={validPage >= totalPages}
                title="Last Page"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)', color: 'var(--text-main)',
                  cursor: validPage >= totalPages ? 'not-allowed' : 'pointer', opacity: validPage >= totalPages ? 0.4 : 1
                }}
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Consultation Cockpit Drawer */}
      {selectedSession && (
        <TelemedChatDrawer
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onCompleted={() => {
            fetchSessions();
            setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
}
