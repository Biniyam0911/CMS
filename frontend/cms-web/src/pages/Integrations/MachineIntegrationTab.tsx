import React, { useState, useEffect } from 'react';
import {
  Server, Zap, Plus, Loader2, Square, Play, Sliders,
  RefreshCw, Save, Activity, Search, Cpu, CheckCircle,
  AlertTriangle, WifiOff, Wifi, Edit3, Trash2, X
} from 'lucide-react';
import { api } from '../../api/apiClient';

export interface LabMachine {
  id: string;
  name: string;
  department: string;
  model: string;
  protocol: 'HL7 v2.5.1 MLLP' | 'HL7 v2.3.1 MLLP' | 'ASTM 1394 / E1381' | 'Serial RS-232 / TCP' | 'REST API Webhook' | 'Raw TCP Socket';
  ipAddress: string;
  port: number;
  mode: 'Bidirectional (Query + Results)' | 'Unidirectional (Results Only)';
  stationId: string;
  status: 'CONNECTED' | 'LISTENING' | 'OFFLINE' | 'STANDBY';
  lastPing?: string;
  latencyMs?: number;
  baudRate?: number;
  description?: string;
}

export const LAB_MACHINE_CATALOGUE: Record<string, string[]> = {
  'Hematology': [
    'ZYBIO Hematology Analyzer model z3',
    'Sysmex XN-550 (Automated 5-Part Diff Hematology Analyzer)',
    'Sysmex XN-350 (Compact 5-Part Diff Hematology Analyzer)',
    'Sysmex XN-1000 (Flagship Automated Hematology System)',
    'Sysmex KX-21N / XP-300 (Automated 3-Part Diff Analyzer)',
    'Mindray BC-5000 / BC-5150 (Auto 5-Part Hematology Analyzer)',
    'Mindray BC-6800Plus / BC-6200 (High-Speed Cellular Workcell)',
    'Beckman Coulter DxH 520 (Compact 5-Part Diff Analyzer)',
    'Beckman Coulter DxH 900 (High-Throughput Hematology Workcell)',
    'Abbott CELL-DYN Ruby / Emerald 22 (Hematology System)',
    'Horiba Yumizen H500 / H550 (Benchtop Hematology)',
    'Nihon Kohden Celltac G MEK-9100 (Automated Hematology)'
  ],
  'Clinical Chemistry': [
    'Linear Chemistry analyzer model: TEMIS',
    'Roche Cobas c311 (Automated Clinical Chemistry Analyzer)',
    'Roche Cobas c501 / c502 (Modular Clinical Chemistry System)',
    'Mindray BS-240 / BS-240Pro (Benchtop Chemistry Analyzer)',
    'Mindray BS-480 / BS-800 (Floor-Standing Automated Chemistry)',
    'Beckman Coulter AU480 (Automated Clinical Chemistry Analyzer)',
    'Beckman Coulter AU680 / AU5800 (High-Speed Workcell)',
    'Siemens Atellica CH 930 (Clinical Chemistry Analyzer)',
    'Siemens Dimension EXL 200 (Integrated Chemistry/Immunoassay)',
    'Abbott Alinity c (Clinical Chemistry System)',
    'Abbott Architect c4000 / c8000 (Clinical Chemistry)',
    'Erba Mannheim XL 200 / XL 640 (Automated Clinical Chemistry)'
  ],
  'Hormone / Immunoassay': [
    'Finecare immunoassay analyzer wondofa',
    'Roche Cobas e411 (ECLIA Hormone & Tumor Marker Analyzer)',
    'Roche Cobas e601 / e801 (High-Speed ECLIA Immunoassay)',
    'Abbott Architect i1000SR (Chemiluminescent Microparticle CMIA)',
    'Abbott Architect i2000SR (High-Throughput CMIA Workcell)',
    'Abbott Alinity i (Immunoassay System)',
    'Beckman Coulter Access 2 (Chemiluminescence Immunoassay)',
    'Beckman Coulter UniCel DxI 800 (Access Immunoassay System)',
    'Siemens Atellica IM 1300 / IM 1600 (Chemiluminescence)',
    'Snibe Maglumi 800 (CLIA Automated Hormone Analyzer)',
    'Snibe Maglumi 2000 Plus (High-Speed CLIA Analyzer)',
    'Tosoh AIA-360 / AIA-900 (Automated Immunoassay Analyzer)',
    'bioMérieux VIDAS 3 / miniVIDAS (ELFA Multiparametric Immunoassay)'
  ],
  'Coagulation / Hemostasis': [
    'Diagnostica Stago STA Compact Max (Automated Hemostasis)',
    'Diagnostica Stago Satellite Max (Coagulation Analyzer)',
    'Sysmex CS-2500 / CS-5100 (Automated Blood Coagulation System)',
    'Sysmex CA-660 / CA-620 (Coagulation Analyzer)',
    'Werfen ACL TOP 350 / 550 / 750 CTS (Hemostasis Testing System)'
  ],
  'Urinalysis': [
    'Sysmex UC-3500 (Automated Urine Chemistry Analyzer)',
    'Sysmex UF-4000 / UF-5000 (Fully Automated Urine Particle Flow Cytometer)',
    'Roche Cobas u411 (Semi-Automated Urine Analyzer)',
    'Roche Cobas 6500 (Integrated Urine Chemistry & Microscopy)',
    'Mindray UA-66 / UA-600T (Urine Chemistry Analyzer)',
    'Arkray Aution Max AX-4030 (Automated Urine Chemistry)'
  ],
  'Microbiology & Blood Culture': [
    'bioMérieux VITEK 2 Compact (Automated ID & AST Microbial System)',
    'BD BACTEC FX40 / FX200 (Automated Blood Culture System)',
    'bioMérieux BacT/ALERT 3D (Continuous Microbial Detection)',
    'Bruker MALDI Biotyper (Microbial Identification Mass Spectrometry)'
  ],
  'Blood Gas & Electrolytes': [
    'Radiometer ABL800 Flex / ABL90 Flex Plus (Blood Gas Analyzer)',
    'Instrumentation Laboratory GEM Premier 3500 / 4000',
    'Nova Biomedical Stat Profile Prime Plus (Critical Care Analyzer)',
    'Roche Cobas b 123 / b 221 (POC Blood Gas Analyzer)',
    'Edan i15 (Blood Gas & Electrolyte System)'
  ],
  'Molecular Diagnostics / PCR': [
    'Cepheid GeneXpert XVI / IV (Automated Real-Time PCR System)',
    'Roche Cobas 4800 / 6800 (Real-Time Molecular System)',
    'Bio-Rad CFX96 Touch (Real-Time PCR Detection System)',
    'Qiagen QIAcube Connect / Rotor-Gene Q (Automated Nucleic Acid)'
  ]
};

export const DEFAULT_LAB_MACHINES: LabMachine[] = [
  {
    id: 'MCH-01',
    name: 'ZYBIO Z3 Hematology Analyzer',
    department: 'Hematology',
    model: 'ZYBIO Hematology Analyzer model z3',
    protocol: 'HL7 v2.3.1 MLLP',
    ipAddress: '192.168.1.41',
    port: 5100,
    mode: 'Unidirectional (Results Only)',
    stationId: 'HEM-ZYBIO-Z3',
    status: 'LISTENING',
    lastPing: 'Server passively listening on port 5100',
    description: 'ZYBIO Z3 automated 3-part / 5-part hematology analyzer. Machine initiates TCP connection to server port 5100 and sends HL7 ORU^R01 CBC panels with sample ID.'
  },
  {
    id: 'MCH-02',
    name: 'Linear TEMIS Chemistry Analyzer',
    department: 'Clinical Chemistry',
    model: 'Linear Chemistry analyzer model: TEMIS',
    protocol: 'ASTM 1394 / E1381',
    ipAddress: '192.168.1.115',
    port: 5200,
    mode: 'Bidirectional (Query + Results)',
    stationId: 'CHM-LINEAR-TEMIS',
    status: 'OFFLINE',
    lastPing: 'Not connected',
    description: 'Linear TEMIS automated clinical chemistry analyzer for biochemistry panels and electrolytes'
  },
  {
    id: 'MCH-03',
    name: 'Finecare Wondfo Immunoassay',
    department: 'Hormone / Immunoassay',
    model: 'Finecare immunoassay analyzer wondofa',
    protocol: 'HL7 v2.5.1 MLLP',
    ipAddress: '192.168.1.118',
    port: 5300,
    mode: 'Bidirectional (Query + Results)',
    stationId: 'IMM-FINECARE-WOND',
    status: 'OFFLINE',
    lastPing: 'Not connected',
    description: 'Finecare Wondfo fluorescence immunoassay analyzer for quantitative hormones, cardiac markers & inflammation'
  },
  {
    id: 'MCH-04',
    name: 'Sysmex XN-550 (Main Hematology)',
    department: 'Hematology',
    model: 'Sysmex XN-550 (Automated 5-Part Diff Hematology Analyzer)',
    protocol: 'HL7 v2.5.1 MLLP',
    ipAddress: '192.168.1.140',
    port: 2575,
    mode: 'Bidirectional (Query + Results)',
    stationId: 'HEM-SYSMEX-01',
    status: 'OFFLINE',
    lastPing: 'Not connected',
    description: 'Sysmex automated 5-part differential hematology workcell with barcode pre-analytical scanner'
  }
];

export default function MachineIntegrationTab() {
  const [machines, setMachines] = useState<LabMachine[]>(() => {
    try {
      const saved = localStorage.getItem('lab_integrated_machines_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: LabMachine) => {
          if (m.name.includes('ZYBIO') || m.model?.includes('z3')) {
            return {
              ...m,
              protocol: 'HL7 v2.3.1 MLLP',
              port: 5100,
              mode: 'Unidirectional (Results Only)',
              stationId: 'HEM-ZYBIO-Z3',
              description: 'ZYBIO Z3 automated 3-part / 5-part hematology analyzer. Machine initiates TCP connection to server port 5100 and sends HL7 ORU^R01 CBC panels with sample ID.'
            };
          }
          return m;
        });
      }
    } catch {}
    return DEFAULT_LAB_MACHINES;
  });

  const [lisServerStatus, setLisServerStatus] = useState<{
    isListening: boolean;
    ports: number[];
    activeClients: { remoteEndPoint: string; connectedAt: string; lastActivityAt: string; bytesReceived: number }[];
    recentLogs: string[];
    configuredPorts?: number[];
  } | null>(null);

  const [isLisToggling, setIsLisToggling] = useState(false);
  const [showPortConfig, setShowPortConfig] = useState(false);
  const [portInputStr, setPortInputStr] = useState('8004, 10001, 10002');
  const [machineDeptFilter, setMachineDeptFilter] = useState<string>('ALL');
  const [machineSearch, setMachineSearch] = useState<string>('');
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<Record<string, { testing: boolean; message: string; success: boolean }>>({});

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4500);
  };

  // LIS Feed Simulator State
  const [showFeedSimulatorModal, setShowFeedSimulatorModal] = useState(false);
  const [simProtocol, setSimProtocol] = useState<'HL7' | 'ASTM'>('HL7');
  const [simOrderId, setSimOrderId] = useState<string>('');
  const [simMachineId, setSimMachineId] = useState('Sysmex-XN550-HEM');
  const [simPayload, setSimPayload] = useState(
    'MSH|^~\\&|ANALYZER|LAB|CMS|CLINIC|20260913210000||ORU^R01|MSG-94021|P|2.3\r' +
    'PID|1||HD-0001||Tigist^Biniyam||19940512|F\r' +
    'OBR|1|ORD-101|LAB-101|CBC^Complete Blood Count|||20260913210000\r' +
    'OBX|1|NM|WBC^White Blood Cell||7.4|10^3/uL|4.0-11.0|N|||F\r' +
    'OBX|2|NM|HGB^Hemoglobin||14.2|g/dL|12.0-16.0|N|||F'
  );
  const [feedIngestResult, setFeedIngestResult] = useState<any>(null);
  const [isIngestingFeed, setIsIngestingFeed] = useState(false);

  // Form State for Machine Add / Edit Modal
  const [formDept, setFormDept] = useState<string>('Hematology');
  const [formModel, setFormModel] = useState<string>('Sysmex XN-550 (Automated 5-Part Diff Hematology Analyzer)');
  const [customModelName, setCustomModelName] = useState<string>('');
  const [formName, setFormName] = useState<string>('Sysmex XN-550 Analyzer');
  const [formProtocol, setFormProtocol] = useState<any>('HL7 v2.5.1 MLLP');
  const [formIp, setFormIp] = useState<string>('192.168.1.140');
  const [formPort, setFormPort] = useState<number>(2575);
  const [formMode, setFormMode] = useState<any>('Bidirectional (Query + Results)');
  const [formStationId, setFormStationId] = useState<string>('HEM-01');
  const [formBaudRate, setFormBaudRate] = useState<number>(9600);
  const [formDescription, setFormDescription] = useState<string>('');

  const fetchLisListenerStatus = async () => {
    try {
      const res = await api.get<any>('/laboratory/instruments/listener-status');
      if (res) {
        setLisServerStatus(res);
        if (!showPortConfig) {
          const effectivePorts = res.configuredPorts?.length ? res.configuredPorts : (res.ports?.length ? res.ports : [8004, 10001, 10002]);
          setPortInputStr(effectivePorts.join(', '));
        }
        setMachines(prev => prev.map(m => {
          if (m.mode.includes('Unidirectional') || m.port === 5100) {
            const isClientConnected = res.activeClients?.some((c: any) => c.remoteEndPoint?.includes(m.ipAddress));
            if (isClientConnected) {
              return { ...m, status: 'CONNECTED', lastPing: 'Active TCP connection' };
            }
            if (res.isListening && (res.ports?.includes(m.port) || m.status === 'OFFLINE')) {
              return { ...m, status: 'LISTENING', lastPing: `Passively listening on port ${m.port}` };
            }
          }
          return m;
        }));
      }
    } catch (e) {
      console.warn('Could not fetch LIS listener status:', e);
    }
  };

  useEffect(() => {
    fetchLisListenerStatus();
    const interval = setInterval(fetchLisListenerStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handlePingMachine = async (mId: string, ip: string, port: number, protocol: string) => {
    const machine = machines.find(m => m.id === mId);
    const isPassive = machine ? (machine.mode.includes('Unidirectional') || machine.port === 5100) : false;

    setPingStatus(prev => ({
      ...prev,
      [mId]: {
        testing: true,
        message: isPassive
          ? `Checking LIS Server passive listener on port ${port} for ${ip}...`
          : `Probing TCP socket connection to ${ip}:${port} (${protocol})...`,
        success: false
      }
    }));

    try {
      const res = await api.post<any>('/laboratory/instruments/ping', {
        ipAddress: ip,
        port: Number(port),
        timeoutMs: 1500,
        mode: machine?.mode
      });

      const isOnline = res?.isOnline === true || res?.success === true;
      const latency = res?.latencyMs || 0;
      const msg = res?.message || (isOnline ? `ACK received in ${latency}ms` : `No ACK received from ${ip}:${port}`);

      setPingStatus(prev => ({
        ...prev,
        [mId]: {
          testing: false,
          message: isOnline ? `✓ ${msg}` : `✕ ${msg}`,
          success: isOnline
        }
      }));

      setMachines(prev => {
        const updated = prev.map(m => m.id === mId ? {
          ...m,
          status: isOnline
            ? (res?.isListening && latency === 0 ? ('LISTENING' as const) : ('CONNECTED' as const))
            : ('OFFLINE' as const),
          latencyMs: latency > 0 ? latency : undefined,
          lastPing: isOnline
            ? (res?.isListening && latency === 0 ? `Passive listener active on port ${port}` : 'Connected just now')
            : `Offline (Checked ${new Date().toLocaleTimeString()})`
        } : m);
        localStorage.setItem('lab_integrated_machines_v2', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Host unreachable';
      setPingStatus(prev => ({
        ...prev,
        [mId]: {
          testing: false,
          message: `✕ Network Error: ${errMsg}. No ACK received from ${ip}:${port}. Machine is offline.`,
          success: false
        }
      }));

      setMachines(prev => {
        const updated = prev.map(m => m.id === mId ? {
          ...m,
          status: 'OFFLINE' as const,
          lastPing: `Offline (Probe failed ${new Date().toLocaleTimeString()})`
        } : m);
        localStorage.setItem('lab_integrated_machines_v2', JSON.stringify(updated));
        return updated;
      });
    }

    setTimeout(() => {
      setPingStatus(prev => {
        const clone = { ...prev };
        delete clone[mId];
        return clone;
      });
    }, 7000);
  };

  const handleToggleMachineStatus = (mId: string) => {
    setMachines(prev => {
      const updated = prev.map(m => {
        if (m.id === mId) {
          const nextStatus = m.status === 'CONNECTED' ? 'OFFLINE' : 'CONNECTED';
          return { ...m, status: nextStatus as any, lastPing: nextStatus === 'CONNECTED' ? 'Just now' : m.lastPing };
        }
        return m;
      });
      localStorage.setItem('lab_integrated_machines_v2', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteMachine = (mId: string) => {
    if (!window.confirm('Are you sure you want to remove this lab machine integration?')) return;
    setMachines(prev => {
      const updated = prev.filter(m => m.id !== mId);
      localStorage.setItem('lab_integrated_machines_v2', JSON.stringify(updated));
      return updated;
    });
  };

  const handleStartLisListener = async () => {
    setIsLisToggling(true);
    try {
      const res = await api.post<any>('/laboratory/instruments/listener/start', {});
      if (res) {
        setLisServerStatus(res);
        showToast('LIS Passive TCP Server started successfully.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to start LIS server.', 'error');
    } finally {
      setIsLisToggling(false);
    }
  };

  const handleStopLisListener = async () => {
    setIsLisToggling(true);
    try {
      const res = await api.post<any>('/laboratory/instruments/listener/stop', {});
      if (res) {
        setLisServerStatus(res);
        showToast('LIS Passive TCP Server stopped.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to stop LIS server.', 'error');
    } finally {
      setIsLisToggling(false);
    }
  };

  const handleSavePorts = async () => {
    const rawParts = portInputStr.split(/[\s,]+/).map(p => p.trim()).filter(Boolean);
    const parsedPorts = rawParts.map(p => parseInt(p, 10)).filter(p => !isNaN(p) && p >= 1 && p <= 65535);

    if (parsedPorts.length === 0) {
      showToast('Please enter at least one valid port number (1 - 65535).', 'error');
      return;
    }

    setIsLisToggling(true);
    try {
      const res = await api.post<any>('/laboratory/instruments/listener/configure-ports', { ports: parsedPorts });
      if (res) {
        setLisServerStatus(res);
        setShowPortConfig(false);
        showToast(`LIS server ports updated: ${parsedPorts.join(', ')}`, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to configure ports.', 'error');
    } finally {
      setIsLisToggling(false);
    }
  };

  const handleOpenAddMachine = () => {
    setEditingMachineId(null);
    setFormDept('Hematology');
    const firstModel = LAB_MACHINE_CATALOGUE['Hematology'][0];
    setFormModel(firstModel);
    setCustomModelName('');
    setFormName(firstModel.split('(')[0].trim());
    setFormProtocol('HL7 v2.5.1 MLLP');
    setFormIp('192.168.1.140');
    setFormPort(2575);
    setFormMode('Bidirectional (Query + Results)');
    setFormStationId('HEM-01');
    setFormBaudRate(9600);
    setFormDescription('Standard laboratory analyzer network connection');
    setShowAddMachineModal(true);
  };

  const handleOpenEditMachine = (m: LabMachine) => {
    setEditingMachineId(m.id);
    setFormDept(m.department);
    setFormModel(m.model);
    setCustomModelName('');
    setFormName(m.name);
    setFormProtocol(m.protocol);
    setFormIp(m.ipAddress);
    setFormPort(m.port);
    setFormMode(m.mode);
    setFormStationId(m.stationId);
    setFormBaudRate(m.baudRate || 9600);
    setFormDescription(m.description || '');
    setShowAddMachineModal(true);
  };

  const handleSaveMachine = (e: React.FormEvent) => {
    e.preventDefault();
    const finalModel = formModel === 'CUSTOM' ? (customModelName || 'Custom Analyzer Model') : formModel;

    if (editingMachineId) {
      setMachines(prev => {
        const updated = prev.map(m => m.id === editingMachineId ? {
          ...m,
          name: formName,
          department: formDept,
          model: finalModel,
          protocol: formProtocol,
          ipAddress: formIp,
          port: formPort,
          mode: formMode,
          stationId: formStationId,
          baudRate: formBaudRate,
          description: formDescription,
          lastPing: 'Updated just now'
        } : m);
        localStorage.setItem('lab_integrated_machines_v2', JSON.stringify(updated));
        return updated;
      });
    } else {
      const newMachine: LabMachine = {
        id: `MCH-${Date.now().toString().slice(-4)}`,
        name: formName,
        department: formDept,
        model: finalModel,
        protocol: formProtocol,
        ipAddress: formIp,
        port: formPort,
        mode: formMode,
        stationId: formStationId,
        status: 'OFFLINE',
        lastPing: 'Not connected',
        baudRate: formBaudRate,
        description: formDescription
      };

      setMachines(prev => {
        const updated = [newMachine, ...prev];
        localStorage.setItem('lab_integrated_machines_v2', JSON.stringify(updated));
        return updated;
      });
    }

    setShowAddMachineModal(false);
  };

  const filteredMachines = machines.filter(m => {
    const matchesDept = machineDeptFilter === 'ALL' || m.department === machineDeptFilter;
    const matchesSearch = machineSearch.trim() === '' ||
      m.name.toLowerCase().includes(machineSearch.toLowerCase()) ||
      m.model.toLowerCase().includes(machineSearch.toLowerCase()) ||
      m.ipAddress.toLowerCase().includes(machineSearch.toLowerCase()) ||
      m.department.toLowerCase().includes(machineSearch.toLowerCase()) ||
      m.stationId.toLowerCase().includes(machineSearch.toLowerCase());
    return matchesDept && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          fontWeight: 700,
          background: toastMsg.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
        }}>
          {toastMsg.text}
        </div>
      )}

      {/* Header Banner & Stats */}
      <div className="glass-panel" style={{ padding: '20px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={20} color="#0284c7" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Laboratory Machine Integrations & LIS Middleware
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Manage bi-directional and uni-directional TCP/IP, MLLP, and ASTM analyzer feeds across all clinical laboratory departments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px 16px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>ONLINE ANALYZERS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
              {machines.filter(m => m.status === 'CONNECTED').length} / {machines.length}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFeedSimulatorModal(true)}
            className="btn-secondary"
            style={{ padding: '9px 14px', fontWeight: 700, borderColor: '#0284c7', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={15} /> LIS Feed Simulator
          </button>
          <button onClick={handleOpenAddMachine} className="btn-primary" style={{ padding: '9px 16px', fontWeight: 700 }}>
            <Plus size={16} /> Add Lab Machine
          </button>
        </div>
      </div>

      {/* LIS Passive TCP Server Live Status & Real-Time Analyzer Log Console */}
      <div className="glass-panel" style={{ padding: '18px 22px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: lisServerStatus?.isListening ? '#10b981' : '#ef4444', boxShadow: lisServerStatus?.isListening ? '0 0 8px #10b981' : '0 0 6px #ef4444' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  LIS Passive TCP Server ({lisServerStatus?.isListening ? 'RUNNING & LISTENING' : 'STOPPED / INACTIVE'})
                </span>
                <span style={{ fontSize: '0.72rem', background: lisServerStatus?.isListening ? '#ede9fe' : '#fee2e2', color: lisServerStatus?.isListening ? '#6d28d9' : '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  {lisServerStatus?.isListening ? 'Passive Server Mode' : 'Service Stopped'}
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {lisServerStatus?.isListening ? (
                  <>Listening on Ports: <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{(lisServerStatus?.ports?.length ? lisServerStatus.ports : (lisServerStatus?.configuredPorts || [8004, 10001, 10002])).map(p => `0.0.0.0:${p}`).join(', ')}</strong> • Waiting for machines to initiate connection</>
                ) : (
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Server is stopped. Click "Start Server" or configure ports below to begin listening.</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: (lisServerStatus?.activeClients?.length || 0) > 0 ? '#ecfdf5' : '#f8fafc', color: (lisServerStatus?.activeClients?.length || 0) > 0 ? '#059669' : '#64748b', border: '1px solid #cbd5e1' }}>
              {(lisServerStatus?.activeClients?.length || 0)} Connected Analyzer(s)
            </span>

            {/* Start / Stop Toggle Button */}
            {lisServerStatus?.isListening ? (
              <button
                type="button"
                onClick={handleStopLisListener}
                disabled={isLisToggling}
                style={{ padding: '6px 12px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                title="Stop listening on all LIS ports"
              >
                {isLisToggling ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} fill="#dc2626" />}
                Stop Listening
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartLisListener}
                disabled={isLisToggling}
                style={{ padding: '6px 12px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                title="Start listening on configured ports"
              >
                {isLisToggling ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="#059669" />}
                Start Listening
              </button>
            )}

            {/* Configure Ports Button */}
            <button
              type="button"
              onClick={() => setShowPortConfig(!showPortConfig)}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px', background: showPortConfig ? '#e0f2fe' : '#ffffff', borderColor: showPortConfig ? '#0284c7' : '#cbd5e1', color: showPortConfig ? '#0284c7' : '#334155', fontWeight: 600 }}
              title="Change listening port(s)"
            >
              <Sliders size={13} /> {showPortConfig ? 'Close Ports Config' : 'Configure Port(s)'}
            </button>

            <button
              type="button"
              onClick={fetchLisListenerStatus}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <RefreshCw size={13} /> Refresh Console
            </button>
          </div>
        </div>

        {/* Port Configuration Bar */}
        {showPortConfig && (
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #0284c7', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                Listening Port(s):
              </label>
              <input
                type="text"
                value={portInputStr}
                onChange={e => setPortInputStr(e.target.value)}
                placeholder="e.g. 8004, 10001, 10002"
                className="form-input"
                style={{ maxWidth: '240px', padding: '5px 10px', fontSize: '0.8rem', fontFamily: 'monospace' }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                (Enter comma-separated ports, e.g. 8004 or 8004, 10001, 10002)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSavePorts}
                disabled={isLisToggling}
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
              >
                {isLisToggling ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Apply & Rebind Ports
              </button>
              <button
                type="button"
                onClick={() => setShowPortConfig(false)}
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.74rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Active Clients Pills */}
        {(lisServerStatus?.activeClients && lisServerStatus.activeClients.length > 0) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {lisServerStatus.activeClients.map((client, cIdx) => (
              <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '0.74rem', color: '#047857' }}>
                <Activity size={12} color="#10b981" />
                <strong>{client.remoteEndPoint}</strong>
                <span style={{ color: '#059669', opacity: 0.8 }}>({client.bytesReceived} bytes received)</span>
              </div>
            ))}
          </div>
        )}

        {/* Real-Time Terminal Log Box */}
        <div style={{ background: '#0f172a', borderRadius: '8px', padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#e2e8f0', maxHeight: '180px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '8px', color: '#94a3b8', fontSize: '0.7rem' }}>
            <span>ANALYZER TCP SOCKET EVENT LOG (HL7 / MLLP)</span>
            <span>Auto-refreshing every 4s</span>
          </div>
          {lisServerStatus?.recentLogs && lisServerStatus.recentLogs.length > 0 ? (
            lisServerStatus.recentLogs.slice(-10).map((log, lIdx) => (
              <div key={lIdx} style={{ padding: '2px 0', color: log.includes('CONNECTED') ? '#4ade80' : log.includes('FROM') ? '#38bdf8' : log.includes('INSERTED') ? '#facc15' : log.includes('ACK') ? '#a78bfa' : '#cbd5e1' }}>
                {log}
              </div>
            ))
          ) : (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>
              [System] LIS Server listening on ports 8004, 10001, and 10002. Waiting for incoming analyzer connections (e.g. ZYBIO Z3 at 192.168.1.41)...
            </div>
          )}
        </div>
      </div>

      {/* Department Filter Pills & Search Bar */}
      <div className="glass-panel" style={{ padding: '14px 18px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
        {/* Department Chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px', maxWidth: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px', whiteSpace: 'nowrap' }}>
            Department:
          </span>
          {['ALL', ...Object.keys(LAB_MACHINE_CATALOGUE)].map(dept => (
            <button
              key={dept}
              type="button"
              onClick={() => setMachineDeptFilter(dept)}
              className={machineDeptFilter === dept ? 'btn-primary' : 'btn-secondary'}
              style={{
                padding: '4px 10px',
                fontSize: '0.74rem',
                borderRadius: '20px',
                background: machineDeptFilter === dept ? '#0284c7' : '#f8f5ee',
                color: machineDeptFilter === dept ? '#ffffff' : 'var(--text-main)',
                borderColor: machineDeptFilter === dept ? '#0284c7' : 'var(--border-color)',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              {dept === 'ALL' ? 'All Departments' : dept}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={machineSearch}
            onChange={e => setMachineSearch(e.target.value)}
            placeholder="Search machine, model, IP, port..."
            style={{ width: '100%', padding: '6px 12px 6px 30px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#ffffff' }}
          />
        </div>
      </div>

      {/* Machine Cards Grid */}
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '16px' }}>
        {filteredMachines.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', background: '#faf8f5', borderRadius: '10px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
            <Cpu size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>No Lab Analyzers Found</div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>No machines match the selected department filter or search term. Click "+ Add Lab Machine" to configure a new analyzer.</div>
          </div>
        ) : (
          filteredMachines.map(m => {
            const isPingTesting = pingStatus[m.id]?.testing;
            const pingResult = pingStatus[m.id];
            const isConnected = m.status === 'CONNECTED';
            const isListening = m.status === 'LISTENING';
            const isPassive = m.mode.includes('Unidirectional') || m.port === 5100;

            return (
              <div
                key={m.id}
                className="glass-panel"
                style={{
                  padding: '20px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  borderLeft: `4px solid ${isConnected ? '#10b981' : (isListening ? '#8b5cf6' : '#94a3b8')}`
                }}
              >
                {/* Card Top: Name & Badges */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{m.department}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{m.stationId}</span>
                      </div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px', margin: 0 }}>{m.name}</h4>
                      <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: '2px', fontWeight: 600 }}>{m.model}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span
                        className={isConnected ? 'badge badge-normal' : (isListening ? 'badge badge-info' : 'badge badge-warning')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.72rem',
                          background: isConnected ? '#ecfdf5' : (isListening ? '#f5f3ff' : undefined),
                          color: isConnected ? '#059669' : (isListening ? '#6d28d9' : undefined),
                          borderColor: isConnected ? '#a7f3d0' : (isListening ? '#ddd6fe' : undefined)
                        }}
                      >
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isConnected ? '#10b981' : (isListening ? '#8b5cf6' : '#f59e0b'), display: 'inline-block' }}></span>
                        {isConnected ? 'CONNECTED' : (isListening ? 'LISTENING (PASSIVE)' : m.status)}
                      </span>
                      {m.latencyMs && (
                        <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
                          {m.latencyMs}ms latency
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Network & Configuration Parameters */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem', marginTop: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Protocol:</span>{' '}
                      <strong style={{ color: '#0284c7' }}>{m.protocol}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>IP / Host:</span>{' '}
                      <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{m.ipAddress}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Port:</span>{' '}
                      <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{m.port}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Mode:</span>{' '}
                      <strong style={{ color: '#7c3aed' }}>{m.mode.split(' ')[0]}</strong>
                    </div>
                  </div>

                  {m.description && (
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic', marginBottom: 0 }}>
                      {m.description}
                    </p>
                  )}

                  {/* Ping Feedback Alert Banner */}
                  {pingResult && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        background: pingResult.success ? '#ecfdf5' : '#fef2f2',
                        color: pingResult.success ? '#047857' : '#b91c1c',
                        border: `1px solid ${pingResult.success ? '#a7f3d0' : '#fecaca'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {pingResult.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                      {pingResult.message}
                    </div>
                  )}
                </div>

                {/* Card Bottom: Actions & Heartbeat */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Heartbeat: {m.lastPing || 'Never'}
                  </span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handlePingMachine(m.id, m.ipAddress, m.port, m.protocol)}
                      disabled={isPingTesting}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px', background: '#ffffff' }}
                      title={isPassive ? "Verify LIS server passive listener status for this analyzer" : "Ping Analyzer and verify MLLP/ASTM socket handshake"}
                    >
                      <Activity size={13} className={isPingTesting ? 'animate-spin' : ''} color="#0284c7" />
                      {isPingTesting ? 'Checking...' : (isPassive ? 'Check Listener' : 'Test Connection')}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleMachineStatus(m.id)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.74rem', background: '#ffffff' }}
                      title={isConnected ? 'Disconnect analyzer' : 'Connect analyzer'}
                    >
                      {isConnected ? <WifiOff size={13} color="#dc2626" /> : <Wifi size={13} color="#16a34a" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditMachine(m)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                      title="Edit configuration"
                    >
                      <Edit3 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMachine(m.id)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#f87171' }}
                      title="Delete integration"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ADD / EDIT LAB MACHINE INTEGRATION */}
      {showAddMachineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', padding: '24px 20px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Server size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                    {editingMachineId ? 'Edit Lab Machine Integration' : 'Add New Laboratory Machine Integration'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    Configure LIS network driver, socket protocol, and communication parameters
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAddMachineModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveMachine} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Laboratory Department <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <select
                  value={formDept}
                  onChange={e => {
                    const dept = e.target.value;
                    setFormDept(dept);
                    const defaultModels = LAB_MACHINE_CATALOGUE[dept] || [];
                    if (defaultModels.length > 0) {
                      setFormModel(defaultModels[0]);
                      setFormName(defaultModels[0].split('(')[0].trim());
                      if (dept === 'Hematology') {
                        setFormProtocol('HL7 v2.5.1 MLLP');
                        setFormPort(2575);
                      } else if (dept === 'Clinical Chemistry') {
                        setFormProtocol('ASTM 1394 / E1381');
                        setFormPort(2576);
                      } else if (dept === 'Hormone / Immunoassay') {
                        setFormProtocol('HL7 v2.5.1 MLLP');
                        setFormPort(2577);
                      } else if (dept === 'Coagulation / Hemostasis') {
                        setFormProtocol('ASTM 1394 / E1381');
                        setFormPort(2578);
                      } else {
                        setFormProtocol('HL7 v2.5.1 MLLP');
                        setFormPort(2580);
                      }
                    }
                  }}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', background: '#1f2937', color: '#fff', border: '1px solid #374151' }}
                >
                  {Object.keys(LAB_MACHINE_CATALOGUE).map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Select Machine / Analyzer Model <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <select
                  value={formModel}
                  onChange={e => {
                    const model = e.target.value;
                    setFormModel(model);
                    if (model !== 'CUSTOM') {
                      setFormName(model.split('(')[0].trim());
                    }
                  }}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', background: '#1f2937', color: '#fff', border: '1px solid #374151' }}
                >
                  {(LAB_MACHINE_CATALOGUE[formDept] || []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="CUSTOM">-- Custom / Other Analyzer Model --</option>
                </select>
              </div>

              {formModel === 'CUSTOM' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    Custom Model Specification
                  </label>
                  <input
                    type="text"
                    value={customModelName}
                    onChange={e => {
                      setCustomModelName(e.target.value);
                      setFormName(e.target.value);
                    }}
                    placeholder="e.g. Dymind DH-76 5-Part Hematology"
                    required
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    Integration Display Name <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Sysmex XN-550 Main Lab"
                    required
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    LIS Station / Barcode ID <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formStationId}
                    onChange={e => setFormStationId(e.target.value)}
                    placeholder="e.g. HEM-01"
                    required
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 90px', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    Protocol <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <select
                    value={formProtocol}
                    onChange={e => setFormProtocol(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                  >
                    <option value="HL7 v2.5.1 MLLP">HL7 v2.5.1 MLLP</option>
                    <option value="HL7 v2.3.1 MLLP">HL7 v2.3.1 MLLP</option>
                    <option value="ASTM 1394 / E1381">ASTM 1394 / E1381</option>
                    <option value="Serial RS-232 / TCP">Serial RS-232 / TCP Bridge</option>
                    <option value="REST API Webhook">REST API Webhook</option>
                    <option value="Raw TCP Socket">Raw TCP Socket</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    IP Address / Host <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formIp}
                    onChange={e => setFormIp(e.target.value)}
                    placeholder="192.168.1.120"
                    required
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    Port <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={e => setFormPort(parseInt(e.target.value) || 2575)}
                    required
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    Communication Mode
                  </label>
                  <select
                    value={formMode}
                    onChange={e => setFormMode(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                  >
                    <option value="Bidirectional (Query + Results)">Bidirectional (Query + Results)</option>
                    <option value="Unidirectional (Results Only)">Unidirectional (Results Only)</option>
                  </select>
                </div>

                {formProtocol.includes('Serial') ? (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                      Baud Rate
                    </label>
                    <select
                      value={formBaudRate}
                      onChange={e => setFormBaudRate(parseInt(e.target.value))}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                    >
                      <option value={9600}>9600 bps</option>
                      <option value={19200}>19200 bps</option>
                      <option value={38400}>38400 bps</option>
                      <option value={115200}>115200 bps</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                      MLLP Framing Frame Type
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="VT [0x0B] ... FS [0x1C] CR [0x0D]"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', border: '1px solid #374151', borderRadius: '6px' }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Analyzer Notes & Location
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="e.g. Located in Central Hematology Room B2. Connected via Ethernet Switch 1."
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => handlePingMachine('TEST', formIp, formPort, formProtocol)}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                >
                  <Activity size={14} color="#06b6d4" /> Test Socket Connection
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowAddMachineModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" style={{ background: '#0284c7', fontWeight: 700 }}>
                    {editingMachineId ? 'Save Changes' : 'Connect & Save Machine'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT ANALYZER MACHINE LIS / HL7 / ASTM FEED SIMULATOR */}
      {showFeedSimulatorModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Direct Analyzer LIS Feed Injector</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFeedSimulatorModal(false);
                  setFeedIngestResult(null);
                }}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Directly inject raw ORU_R01 HL7 pipes or ASTM frames from connected hematology or biochemistry analyzers. The backend NHapi / ASTM parser extracts results and pairs them to the laboratory order.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Protocol Standard</label>
                  <select
                    value={simProtocol}
                    onChange={e => {
                      const proto = e.target.value as 'HL7' | 'ASTM';
                      setSimProtocol(proto);
                      if (proto === 'ASTM') {
                        setSimMachineId('Roche-Cobas-c311-CHM');
                        setSimPayload(
                          'H|\\^&|||RocheCobasC311|||||||P|1394-97|20260913210000\r' +
                          'P|1||HD-0001||Tigist^Biniyam||19940512|F\r' +
                          'O|1|LAB-101||^^^ALT\\^^^AST|R|20260913210000|||||A\r' +
                          'R|1|^^^ALT|24.5|U/L|7.0-56.0|N||F\r' +
                          'R|2|^^^AST|21.0|U/L|10.0-40.0|N||F\r' +
                          'L|1|N'
                        );
                      } else {
                        setSimMachineId('Sysmex-XN550-HEM');
                        setSimPayload(
                          'MSH|^~\\&|ANALYZER|LAB|CMS|CLINIC|20260913210000||ORU^R01|MSG-94021|P|2.3\r' +
                          'PID|1||HD-0001||Tigist^Biniyam||19940512|F\r' +
                          'OBR|1|ORD-101|LAB-101|CBC^Complete Blood Count|||20260913210000\r' +
                          'OBX|1|NM|WBC^White Blood Cell||7.4|10^3/uL|4.0-11.0|N|||F\r' +
                          'OBX|2|NM|HGB^Hemoglobin||14.2|g/dL|12.0-16.0|N|||F'
                        );
                      }
                    }}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    <option value="HL7">HL7 v2.x (Pipe Delimited ORU_R01)</option>
                    <option value="ASTM">ASTM 1394 / E1381 (Standard Clinical Chemistry)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Target Order # (Optional)</label>
                  <input
                    type="number"
                    value={simOrderId}
                    onChange={e => setSimOrderId(e.target.value)}
                    placeholder="Leave blank for latest active order"
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Analyzer Source Identifier</label>
                <input
                  type="text"
                  value={simMachineId}
                  onChange={e => setSimMachineId(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Raw Instrument Frame Payload</label>
                <textarea
                  rows={5}
                  value={simPayload}
                  onChange={e => setSimPayload(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.74rem', fontFamily: 'monospace', background: '#f8fafc' }}
                />
              </div>

              {feedIngestResult && (
                <div style={{ padding: '12px', borderRadius: '8px', background: feedIngestResult.success ? '#ecfdf5' : '#fef2f2', border: `1px solid ${feedIngestResult.success ? '#86efac' : '#fca5a5'}` }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: feedIngestResult.success ? '#15803d' : '#991b1b', marginBottom: '4px' }}>
                    {feedIngestResult.success ? '✓ Machine Result Ingestion Succeeded' : '✕ Ingestion Failed'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#334155' }}>
                    {feedIngestResult.message}
                  </div>
                  {feedIngestResult.numericValue != null && (
                    <div style={{ fontSize: '0.72rem', color: '#0369a1', marginTop: '4px', fontWeight: 600 }}>
                      Extracted Value: {feedIngestResult.numericValue} (Source: {feedIngestResult.machine})
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowFeedSimulatorModal(false);
                  setFeedIngestResult(null);
                }}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isIngestingFeed}
                onClick={async () => {
                  try {
                    setIsIngestingFeed(true);
                    setFeedIngestResult(null);
                    const res = await api.post('/laboratory/analyzer/feed', {
                      rawMessage: simPayload,
                      machineIdentifier: simMachineId,
                      protocol: simProtocol,
                      targetOrderId: simOrderId ? parseInt(simOrderId) : undefined
                    });
                    setFeedIngestResult({
                      success: true,
                      message: (res as any)?.message || 'Result payload parsed and ingested successfully.',
                      numericValue: (res as any)?.parsedData?.numericValue,
                      machine: simMachineId
                    });
                  } catch (err: any) {
                    setFeedIngestResult({
                      success: false,
                      message: err?.response?.data?.message || err?.message || 'Error processing instrument feed payload.'
                    });
                  } finally {
                    setIsIngestingFeed(false);
                  }
                }}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isIngestingFeed ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Ingest Payload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
