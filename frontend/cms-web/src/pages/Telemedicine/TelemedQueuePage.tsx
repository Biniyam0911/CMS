import React, { useState, useEffect, useCallback } from 'react';
import {
  Video, Phone, MessageSquare, Clock, CheckCircle, Search,
  RefreshCw, AlertCircle, Play, DollarSign, Calendar
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

export default function TelemedQueuePage() {
  const [sessions, setSessions] = useState<TelemedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

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

  const totalWaiting = sessions.filter(s => s.statusId === 2).length;
  const totalActive = sessions.filter(s => s.statusId === 3).length;
  const totalCompleted = sessions.filter(s => s.statusId === 4).length;
  const totalRevenue = sessions
    .filter(s => s.statusId === 3 || s.statusId === 4)
    .reduce((sum, s) => sum + (s.consultationFee || 0), 0);

  const filteredSessions = sessions.filter(s => {
    if (filterStatus !== 'ALL' && s.statusId.toString() !== filterStatus) return false;
    if (filterPlatform !== 'ALL' && !s.platform?.toLowerCase().includes(filterPlatform.toLowerCase())) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.patientName?.toLowerCase().includes(q);
      const matchNum = s.sessionNumber?.toLowerCase().includes(q);
      const matchComplaint = s.chiefComplaint?.toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchComplaint) return false;
    }
    return true;
  });

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

      {/* Filter and Search Bar */}
      <div style={{
        background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)',
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20
      }}>
        <div style={{ position: 'relative', flex: '1 1 250px' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search patient, session #, complaint..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8,
              border: '1.5px solid var(--border-color)', background: 'var(--bg-input)',
              fontSize: 13, color: 'var(--text-main)', boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
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
            onChange={e => setFilterPlatform(e.target.value)}
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

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', padding: 48, borderRadius: 12,
          border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)'
        }}>
          <MessageSquare size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: 'var(--text-main)' }}>No consultations match the filter</h3>
          <p style={{ margin: 0, fontSize: 13 }}>Inbound messages from Telegram and WhatsApp will appear here automatically.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filteredSessions.map(session => {
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
