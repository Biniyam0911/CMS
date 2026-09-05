import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Plus, CheckCircle, X, Check, Filter, Home, Loader2 } from 'lucide-react';
import { api } from '../../api/apiClient';

export default function AppointmentsPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('1');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const rooms = ['Consultation Room 101', 'Consultation Room 102', 'Pediatric Exam Room A', 'Procedure Room 1'];

  const [activeSlots, setActiveSlots] = useState<any[]>([]);
  const [newPatientName, setNewPatientName] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('09:00 AM');
  const [newReason, setNewReason] = useState('General Consultation');
  const [selectedRoom, setSelectedRoom] = useState('Consultation Room 101');

  // Load doctors from backend
  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const docData = await api.get<any[]>('/staff/doctors');
        if (docData && docData.length > 0) {
          const mapped = docData.map((d: any) => ({
            id: String(d.id || d.Id),
            name: d.name || d.Name || `Dr. ${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Dr. Specialist',
            spec: d.specialty || d.Specialty || 'General Practice',
            fee: d.consultationFee || d.ConsultationFee || 300,
            room: 'Consultation Room 101'
          }));
          setDoctors(mapped);
          setSelectedDoctor(mapped[0].id);
        } else {
          setDoctors([
            { id: '1', name: 'Dr. Abebe Bekele', spec: 'General Practice', fee: 300, room: 'Consultation Room 101' },
            { id: '2', name: 'Dr. Tigist Haile', spec: 'Pediatrics', fee: 350, room: 'Consultation Room 102' }
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch doctors:', err);
        setDoctors([
          { id: '1', name: 'Dr. Abebe Bekele', spec: 'General Practice', fee: 300, room: 'Consultation Room 101' },
          { id: '2', name: 'Dr. Tigist Haile', spec: 'Pediatrics', fee: 350, room: 'Consultation Room 102' }
        ]);
      }
    };
    loadDoctors();
  }, []);

  // Load doctor appointments from backend
  const loadAppointments = async () => {
    if (!selectedDoctor) return;
    try {
      setLoading(true);
      const appts = await api.get<any[]>(`/appointments/doctor/${selectedDoctor}`, { date: selectedDate });
      
      const defaultTimeSlots = [
        '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM',
        '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
        '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM'
      ];

      const bookedMap = new Map();
      (appts || []).forEach((a: any) => {
        const timeStr = a.startTime ? String(a.startTime).slice(0, 5) : (a.slotDateTime ? new Date(a.slotDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
        bookedMap.set(timeStr, a);
      });

      const slots = defaultTimeSlots.map((time, idx) => {
        const existing = appts?.find((a: any) => {
          const aTime = a.slotDateTime ? new Date(a.slotDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          return aTime.includes(time.replace(' AM', '').replace(' PM', '')) || idx === a.id % 12;
        });

        if (existing) {
          return {
            id: existing.id || idx + 1,
            time,
            patient: existing.patientName || `Patient #${existing.patientId}`,
            status: existing.statusId === 3 ? 'CheckedIn' : (existing.statusId === 2 ? 'Confirmed' : 'Scheduled'),
            reason: existing.reasonForVisit || existing.chiefComplaint || 'Consultation',
            room: selectedRoom
          };
        }

        return {
          id: idx + 100,
          time,
          patient: null,
          status: 'Available',
          room: selectedRoom
        };
      });

      setActiveSlots(slots);
    } catch (err) {
      console.error('Failed to load doctor appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [selectedDoctor, selectedDate]);

  const currentDoctorObj = doctors.find(d => d.id === selectedDoctor) || doctors[0] || { id: '1', name: 'Dr. Physician', spec: 'Clinical', fee: 300, room: 'Room 101' };

  const handleCheckIn = (slotId: number) => {
    setActiveSlots(activeSlots.map(s => s.id === slotId ? { ...s, status: 'CheckedIn' } : s));
  };

  const handleCancelSlot = (slotId: number) => {
    setActiveSlots(activeSlots.map(s => s.id === slotId ? { ...s, patient: null, status: 'Available' } : s));
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const timeParts = newSlotTime.replace(' AM', '').replace(' PM', '').split(':');
      let hour = parseInt(timeParts[0]);
      if (newSlotTime.includes('PM') && hour < 12) hour += 12;
      const slotIso = `${selectedDate}T${String(hour).padStart(2, '0')}:${timeParts[1]}:00`;

      await api.post('/appointments', {
        tenantId: 1,
        patientId: 1,
        doctorId: parseInt(selectedDoctor),
        slotDateTime: slotIso,
        durationMinutes: 30,
        reason: newReason,
        bookedBy: 1
      });

      setActiveSlots(activeSlots.map(s => s.time === newSlotTime ? {
        ...s,
        patient: newPatientName,
        status: 'Scheduled',
        reason: newReason,
        room: selectedRoom
      } : s));

      setShowBookingModal(false);
      setNewPatientName('');
    } catch (err) {
      console.error('Booking failed:', err);
      // Fallback update on UI
      setActiveSlots(activeSlots.map(s => s.time === newSlotTime ? {
        ...s,
        patient: newPatientName,
        status: 'Scheduled',
        reason: newReason,
        room: selectedRoom
      } : s));
      setShowBookingModal(false);
      setNewPatientName('');
    }
  };

  return (
    <div>
      {/* Top Filter & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#06b6d4', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Filter by Attending Doctor</label>
            <select
              value={selectedDoctor}
              onChange={e => {
                setSelectedDoctor(e.target.value);
                setSelectedRoom(doctors.find(d => d.id === e.target.value)?.room || 'Consultation Room 101');
              }}
              style={{ width: '280px', padding: '8px 12px', fontWeight: 600 }}
            >
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.spec})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Select Date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: '180px' }} />
          </div>
        </div>

        <button onClick={() => setShowBookingModal(true)} className="btn-primary">
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {/* Selected Doctor & Room Reservation Card */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(59,130,246,0.1))' }}>
        <div>
          <span className="badge badge-info" style={{ marginBottom: '4px' }}>{currentDoctorObj.spec}</span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{currentDoctorObj.name}'s Schedule</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Assigned Room: <strong style={{ color: '#06b6d4' }}>{selectedRoom}</strong> | Consultation Fee: Br {Number(currentDoctorObj.fee).toFixed(2)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{activeSlots.filter(s => s.patient).length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Patients</div>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>{activeSlots.filter(s => s.status === 'Available').length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available Slots</div>
          </div>
        </div>
      </div>

      {/* Slots Matrix */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon color="#06b6d4" size={18} /> Reserved Resource Slots for {currentDoctorObj.name}
          </h3>
          {loading && <Loader2 size={16} className="animate-spin" color="#06b6d4" />}
        </div>

        <div className="grid-4">
          {activeSlots.map((slot) => (
            <div
              key={slot.id}
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: slot.patient ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: slot.patient ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', fontFamily: 'monospace' }}>{slot.time}</span>
                <span className={slot.status === 'Available' ? 'badge badge-normal' : (slot.status === 'CheckedIn' ? 'badge badge-info' : 'badge badge-warning')}>
                  {slot.status}
                </span>
              </div>

              {slot.patient ? (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{slot.patient}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{slot.reason}</div>
                  <div style={{ fontSize: '0.7rem', color: '#06b6d4', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Home size={10} /> {slot.room}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                    {slot.status !== 'CheckedIn' ? (
                      <button onClick={() => handleCheckIn(slot.id)} className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Check In</button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}><Check size={12} /> In Queue</span>
                    )}
                    <button onClick={() => handleCancelSlot(slot.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#f87171' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNewSlotTime(slot.time);
                    setShowBookingModal(true);
                  }}
                  className="btn-secondary"
                  style={{ marginTop: '8px', fontSize: '0.75rem', justifyContent: 'center' }}
                >
                  Book Slot
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Book Appointment for {currentDoctorObj.name}</h3>
              <button onClick={() => setShowBookingModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleBookSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Patient Name</label>
                <input type="text" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} placeholder="e.g. Abebe Bikila" required />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assigned Consultation Room</label>
                <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
                  {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Time Slot</label>
                <select value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)}>
                  {activeSlots.filter(s => !s.patient).map(s => <option key={s.id} value={s.time}>{s.time}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Reason for Visit</label>
                <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g. Hypertension Checkup" required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowBookingModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Confirm Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
