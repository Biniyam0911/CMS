import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, Video, CheckCircle, Pill, RefreshCw, Phone,
  ExternalLink, AlertTriangle, Loader2
} from 'lucide-react';
import { api } from '../api/apiClient';

interface TelemedMessage {
  id: number;
  sessionId: number;
  senderType: string; // 'Patient' | 'Doctor' | 'SystemBot'
  messageType: string; // 'Text' | 'Image' | 'VideoLink' | 'Prescription'
  contentText: string;
  mediaUrl?: string;
  isReadByDoctor: boolean;
  sentAt: string;
}

interface TelemedSession {
  Id: number;
  SessionNumber: string;
  PatientName: string;
  Platform: string;
  StatusId: number;
  ChiefComplaint?: string;
  ConsultationFee: number;
}

interface Props {
  session: TelemedSession;
  onClose: () => void;
  onCompleted: () => void;
}

const PlatformBadge = ({ platform }: { platform: string }) => {
  const isTelegram = platform?.toLowerCase().includes('telegram');
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: isTelegram ? '#e8f4fd' : '#e6f9f0',
      color: isTelegram ? '#0088cc' : '#25d366'
    }}>
      {isTelegram ? '✈ Telegram' : '💬 WhatsApp'}
    </span>
  );
};

const MessageBubble = ({ msg }: { msg: TelemedMessage }) => {
  const [imgOpen, setImgOpen] = useState(false);
  const isPatient = msg.senderType?.toLowerCase() === 'patient';
  const isDoctor = msg.senderType?.toLowerCase() === 'doctor';
  const isSystem = msg.senderType?.toLowerCase().includes('system');

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <span style={{
          fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-dark)',
          borderRadius: 12, padding: '4px 12px'
        }}>
          {msg.contentText}
        </span>
      </div>
    );
  }

  const bubbleStyle: React.CSSProperties = {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: isPatient ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
    background: isPatient ? '#e8f4fd' : '#dcf8c6',
    color: 'var(--text-main)',
    fontSize: 13,
    lineHeight: 1.5,
    wordBreak: 'break-word',
    position: 'relative'
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: isDoctor ? 'flex-end' : 'flex-start',
      marginBottom: 8,
      padding: '0 12px'
    }}>
      <div>
        <div style={{
          fontSize: 10, color: 'var(--text-secondary)',
          marginBottom: 2, textAlign: isDoctor ? 'right' : 'left'
        }}>
          {isDoctor ? '🩺 Doctor' : '👤 Patient'}
        </div>

        <div style={bubbleStyle}>
          {msg.messageType === 'Image' && msg.mediaUrl && (
            <div>
              <img
                src={msg.mediaUrl}
                alt="Attachment"
                onClick={() => setImgOpen(true)}
                style={{
                  maxWidth: 200, maxHeight: 160, borderRadius: 8,
                  cursor: 'pointer', display: 'block', marginBottom: 4
                }}
              />
              {msg.contentText && <div style={{ fontSize: 12 }}>{msg.contentText}</div>}
            </div>
          )}

          {msg.messageType === 'VideoLink' && (
            <div style={{
              border: '1.5px solid #0071e3', borderRadius: 10, padding: '8px 12px',
              background: '#f0f7ff'
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0071e3', marginBottom: 4 }}>
                📹 Video Consultation Room
              </div>
              <div style={{ fontSize: 11, marginBottom: 8, wordBreak: 'break-all' }}>{msg.contentText}</div>
              <a
                href={msg.mediaUrl || msg.contentText}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: '#fff', background: '#0071e3',
                  borderRadius: 6, padding: '4px 10px', textDecoration: 'none', fontWeight: 600
                }}
              >
                <ExternalLink size={12} /> Join Room
              </a>
            </div>
          )}

          {msg.messageType === 'Prescription' && (
            <div style={{
              border: '1.5px solid #34c759', borderRadius: 10, padding: '8px 12px',
              background: '#f0fff4'
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#34c759', marginBottom: 4 }}>
                💊 Prescription Issued
              </div>
              <pre style={{
                margin: 0, fontFamily: 'inherit', fontSize: 12,
                whiteSpace: 'pre-wrap', lineHeight: 1.6
              }}>
                {msg.contentText}
              </pre>
            </div>
          )}

          {(msg.messageType === 'Text' || (!['Image', 'VideoLink', 'Prescription'].includes(msg.messageType))) && (
            <span>{msg.contentText}</span>
          )}

          <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'right', marginTop: 4 }}>
            {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
            {msg.isReadByDoctor && isDoctor && ' ✓✓'}
          </div>
        </div>
      </div>

      {imgOpen && msg.mediaUrl && (
        <div
          onClick={() => setImgOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}
        >
          <img
            src={msg.mediaUrl}
            alt="Full size"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setImgOpen(false)}
            style={{
              position: 'absolute', top: 20, right: 20, background: 'none',
              border: 'none', color: '#fff', cursor: 'pointer'
            }}
          >
            <X size={28} />
          </button>
        </div>
      )}
    </div>
  );
};

const CompleteModal = ({
  sessionId,
  onClose,
  onDone
}: {
  sessionId: number;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!diagnosis.trim()) { setError('Diagnosis is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(`/telemed/sessions/${sessionId}/complete`, {
        SessionId: sessionId,
        Diagnosis: diagnosis,
        DoctorNotes: notes,
        PrescriptionText: prescription
      });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Failed to complete consultation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28,
        width: 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
            ✅ Complete Consultation
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            background: '#fff5f5', border: '1px solid #ff3b30', borderRadius: 8,
            padding: '8px 12px', fontSize: 13, color: '#ff3b30', marginBottom: 16
          }}>
            <AlertTriangle size={14} style={{ marginRight: 6 }} />{error}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Diagnosis *
        </label>
        <input
          value={diagnosis}
          onChange={e => setDiagnosis(e.target.value)}
          placeholder="Primary diagnosis..."
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)',
            fontSize: 13, color: 'var(--text-main)', background: 'var(--bg-input)', marginBottom: 14,
            boxSizing: 'border-box'
          }}
        />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Clinical Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Clinical observations, history, examination findings..."
          rows={3}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)',
            fontSize: 13, color: 'var(--text-main)', background: 'var(--bg-input)', marginBottom: 14,
            resize: 'vertical', boxSizing: 'border-box'
          }}
        />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Prescription
        </label>
        <textarea
          value={prescription}
          onChange={e => setPrescription(e.target.value)}
          placeholder="Rx: Medication name, dose, frequency..."
          rows={3}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)',
            fontSize: 13, color: 'var(--text-main)', background: 'var(--bg-input)', marginBottom: 20,
            resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--border-color)',
              background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: saving ? '#ccc' : '#34c759', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
            {saving ? 'Saving...' : 'Complete Consultation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function TelemedChatDrawer({ session, onClose, onCompleted }: Props) {
  const [messages, setMessages] = useState<TelemedMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [startingCall, setStartingCall] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res: any = await api.get(`/telemed/sessions/${session.Id}/messages`);
      const rawList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.Data) ? res.Data : []));
      
      const normalized: TelemedMessage[] = rawList.map((m: any) => ({
        id: m.id ?? m.Id,
        sessionId: m.sessionId ?? m.SessionId,
        senderType: m.senderType ?? m.SenderType ?? 'Patient',
        messageType: m.messageType ?? m.MessageType ?? 'Text',
        contentText: m.contentText ?? m.ContentText ?? m.content ?? '',
        mediaUrl: m.mediaUrl ?? m.MediaUrl,
        isReadByDoctor: m.isReadByDoctor ?? m.IsReadByDoctor ?? false,
        sentAt: m.sentAt ?? m.SentAt ?? ''
      }));
      setMessages(normalized);
    } catch {}
  }, [session.Id]);

  useEffect(() => {
    fetchMessages();
    pollingRef.current = setInterval(fetchMessages, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (msgType = 'Text', content?: string) => {
    const text = content ?? replyText.trim();
    if (!text) return;
    setSending(true);
    try {
      await api.post(`/telemed/sessions/${session.Id}/messages`, {
        SessionId: session.Id,
        ContentText: text,
        MessageType: msgType
      });
      await fetchMessages();
      setReplyText('');
      inputRef.current?.focus();
    } catch (e: any) {
      alert(`Send failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStartCall = async () => {
    setStartingCall(true);
    try {
      const res: any = await api.post(`/telemed/sessions/${session.Id}/call`, {
        SessionId: session.Id,
        CallType: 'Video'
      });
      const url: string = res?.videoUrl ?? res?.VideoUrl ?? res?.data?.videoUrl ?? res?.Data?.VideoUrl;
      setVideoUrl(url);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      await fetchMessages();
    } catch (e: any) {
      alert(`Could not start video call: ${e?.message || 'Unknown error'}`);
    } finally {
      setStartingCall(false);
    }
  };

  const isCompleted = session.StatusId === 4 || session.StatusId === 5;
  const platformIsWhatsApp = session.Platform?.toLowerCase().includes('whatsapp');

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 6000
      }} onClick={onClose} />

      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 500, maxWidth: '100vw',
        background: 'var(--bg-card)', zIndex: 6001,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)'
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>
                {session.PatientName}
              </span>
              <PlatformBadge platform={session.Platform} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {session.SessionNumber} • {session.ChiefComplaint || 'No complaint noted'} • Br {session.ConsultationFee?.toFixed(2)}
            </div>
          </div>
          <button onClick={fetchMessages} title="Refresh" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4
          }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4
          }}>
            <X size={20} />
          </button>
        </div>

        {!isCompleted && (
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', gap: 8, background: '#fafafa', flexShrink: 0, flexWrap: 'wrap'
          }}>
            <button
              onClick={handleStartCall}
              disabled={startingCall}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 8, border: 'none', background: '#0071e3', color: '#fff',
                cursor: startingCall ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600
              }}
            >
              {startingCall ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Video size={13} />}
              Start Video Call
            </button>

            <button
              onClick={() => {
                const rx = prompt('Enter prescription text (Rx):');
                if (rx?.trim()) sendMessage('Prescription', rx.trim());
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 8, border: '1.5px solid #34c759', background: '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#34c759'
              }}
            >
              <Pill size={13} /> Send Prescription
            </button>

            <button
              onClick={() => setShowComplete(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 8, border: '1.5px solid #ff9500', background: '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#ff9500'
              }}
            >
              <CheckCircle size={13} /> Complete
            </button>

            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 8, border: '1.5px solid #0071e3', background: '#f0f7ff',
                  fontSize: 12, fontWeight: 600, color: '#0071e3', textDecoration: 'none'
                }}
              >
                <ExternalLink size={13} /> Rejoin
              </a>
            )}
          </div>
        )}

        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 0',
          display: 'flex', flexDirection: 'column'
        }}>
          {messages.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'
            }}>
              <Phone size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
              <div style={{ fontSize: 13 }}>No messages yet.</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Waiting for patient to connect…</div>
            </div>
          ) : (
            messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {isCompleted ? (
          <div style={{
            padding: '14px 20px', textAlign: 'center', color: 'var(--text-secondary)',
            fontSize: 13, borderTop: '1px solid var(--border-color)', background: '#fafafa'
          }}>
            <CheckCircle size={16} style={{ color: '#34c759', marginRight: 6 }} />
            Consultation completed. Chat is read-only.
          </div>
        ) : (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border-color)',
            display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
            background: 'var(--bg-card)'
          }}>
            <input
              ref={inputRef}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Reply via ${platformIsWhatsApp ? 'WhatsApp' : 'Telegram'}…`}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 24,
                border: '1.5px solid var(--border-color)',
                background: 'var(--bg-input)', fontSize: 13,
                color: 'var(--text-main)', outline: 'none'
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || !replyText.trim()}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: (sending || !replyText.trim()) ? '#ccc' : '#0071e3',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: (sending || !replyText.trim()) ? 'not-allowed' : 'pointer',
                flexShrink: 0
              }}
            >
              {sending
                ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={16} />}
            </button>
          </div>
        )}
      </div>

      {showComplete && (
        <CompleteModal
          sessionId={session.Id}
          onClose={() => setShowComplete(false)}
          onDone={() => {
            setShowComplete(false);
            onCompleted();
          }}
        />
      )}
    </>
  );
}
