import React, { useState, useEffect } from 'react';
import {
  FlaskConical, ShieldAlert, Cpu, CheckCircle, Barcode, Check, Plus, X, Search,
  ChevronDown, ChevronRight, Layers, GitCommit, TrendingUp, Loader2, Calendar,
  Wifi, WifiOff, Activity, RefreshCw, Trash2, Edit3, Server, Network, Sliders, AlertTriangle, Printer,
  Save, Zap
} from 'lucide-react';
import { api } from '../../api/apiClient';

interface OrderTestItem {
  itemId: number;
  testCode: string;
  testName: string;
  sampleType: string;
  barcode: string;
  status: string;
  results: Record<string, string>;
}

interface OrderItem {
  id: number;         // OrderId
  orderNo: string;
  patientName: string;
  /** @deprecated use tests[0] for display; kept for legacy print compat */
  testCode: string;
  /** @deprecated use tests[0] for display */
  testName: string;
  sampleType: string;
  barcode: string;    // order-level barcode (BC-<orderId>)
  status: string;
  custodyStep: string;
  priority?: string | number;
  orderedAt?: string;
  prevValue?: string;
  results: Record<string, string>;
  tests: OrderTestItem[];
}

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
    protocol: 'HL7 v2.5.1 MLLP',
    ipAddress: '192.168.1.110',
    port: 5100,
    mode: 'Bidirectional (Query + Results)',
    stationId: 'HEM-ZYBIO-Z3',
    status: 'OFFLINE',
    lastPing: 'Not connected',
    description: 'ZYBIO Z3 3-part / 5-part automated differential hematology analyzer with integrated barcode reader'
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
    ipAddress: '192.168.1.120',
    port: 2575,
    mode: 'Bidirectional (Query + Results)',
    stationId: 'HEM-XN550-01',
    status: 'OFFLINE',
    lastPing: 'Not connected',
    description: 'Primary 5-Part differential hematology analyzer with sample barcode reader'
  },
  {
    id: 'MCH-05',
    name: 'Cobas c311 (Primary Biochemistry)',
    department: 'Clinical Chemistry',
    model: 'Roche Cobas c311 (Automated Clinical Chemistry Analyzer)',
    protocol: 'ASTM 1394 / E1381',
    ipAddress: '192.168.1.125',
    port: 2576,
    mode: 'Bidirectional (Query + Results)',
    stationId: 'CHM-C311-01',
    status: 'OFFLINE',
    lastPing: 'Not connected',
    description: 'Automated clinical chemistry with photometric and ISE electrolytes module'
  },
  {
    id: 'MCH-06',
    name: 'Cobas e411 (Endocrinology & Immunology)',
    department: 'Hormone / Immunoassay',
    model: 'Roche Cobas e411 (ECLIA Hormone & Tumor Marker Analyzer)',
    protocol: 'HL7 v2.5.1 MLLP',
    ipAddress: '192.168.1.130',
    port: 2577,
    mode: 'Bidirectional (Query + Results)',
    stationId: 'IMM-E411-01',
    status: 'OFFLINE',
    lastPing: 'Not connected',
    description: 'Electrochemiluminescence immunoassay for thyroid, fertility and cardiac markers'
  },
  {
    id: 'MCH-07',
    name: 'STA Compact Max (Hemostasis)',
    department: 'Coagulation / Hemostasis',
    model: 'Diagnostica Stago STA Compact Max (Automated Hemostasis)',
    protocol: 'ASTM 1394 / E1381',
    ipAddress: '192.168.1.135',
    port: 2578,
    mode: 'Unidirectional (Results Only)',
    stationId: 'COAG-STAC-01',
    status: 'OFFLINE',
    lastPing: 'Not connected',
    description: 'Clotting, chromogenic and immunological assay hemostasis analyzer'
  }
];

export default function LaboratoryPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<'worklist' | 'custody' | 'catalog' | 'instruments'>('worklist');
  const [loading, setLoading] = useState(true);

  // Date Filter State for Worklist
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAllDates, setShowAllDates] = useState(false);

  // Test Catalog State
  const [catalog, setCatalog] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [printModalOrder, setPrintModalOrder] = useState<OrderItem | null>(null);

  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // New Test Catalog Form State
  const [newTestCode, setNewTestCode] = useState('');
  const [newTestName, setNewTestName] = useState('');
  const [newTestCategory, setNewTestCategory] = useState('Biochemistry');
  const [newTestPrice, setNewTestPrice] = useState('200');
  const [newParams, setNewParams] = useState<{ code: string; name: string; unit: string; min: string; max: string }[]>([
    { code: 'PARAM1', name: 'Primary Parameter', unit: 'mg/dL', min: '70', max: '110' }
  ]);

  // ==========================================
  // LAB INSTRUMENT INTEGRATION STATE
  // ==========================================
  const [machines, setMachines] = useState<LabMachine[]>(() => {
    try {
      const saved = localStorage.getItem('lab_integrated_machines_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_LAB_MACHINES;
  });

  const [machineDeptFilter, setMachineDeptFilter] = useState<string>('ALL');
  const [machineSearch, setMachineSearch] = useState<string>('');
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<Record<string, { testing: boolean; message: string; success: boolean }>>({});

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

  const loadLabData = async (filterDate?: string, allDates?: boolean) => {
    try {
      setLoading(true);
      const activeDate = allDates ? undefined : (filterDate || selectedDate);
      const [catalogData, worklistData] = await Promise.all([
        api.get<any[]>('/laboratory/catalog').catch(() => []),
        api.get<any[]>('/laboratory/worklist', activeDate ? { date: activeDate } : {}).catch(() => [])
      ]);

      if (catalogData && catalogData.length > 0) {
        const mappedCatalog = catalogData.map((c: any) => ({
          id: c.id || c.Id,
          code: c.testCode || c.TestCode,
          name: c.testName || c.TestName,
          category: c.category || c.Category || 'Biochemistry',
          sample: c.sampleType || c.SampleType || 'Serum',
          price: c.price || c.Price || 150,
          parameters: c.testCode === 'CBC' ? [
            { code: 'WBC', name: 'White Blood Cell Count', unit: '10^3/uL', min: 4.5, max: 11.0 },
            { code: 'RBC', name: 'Red Blood Cell Count', unit: '10^6/uL', min: 4.2, max: 5.8 },
            { code: 'HGB', name: 'Hemoglobin', unit: 'g/dL', min: 12.0, max: 17.5 },
            { code: 'HCT', name: 'Hematocrit', unit: '%', min: 37.0, max: 51.0 },
            { code: 'PLT', name: 'Platelet Count', unit: '10^3/uL', min: 150.0, max: 450.0 }
          ] : [
            { code: c.testCode || 'VAL', name: c.testName || 'Result Value', unit: c.unit || 'U/L', min: c.normalRangeLow || 0, max: c.normalRangeHigh || 100 }
          ]
        }));
        setCatalog(mappedCatalog);
      } else {
        setCatalog([
          {
            id: 1, code: 'CBC', name: 'Complete Blood Count (CBC Profile)', category: 'Hematology', sample: 'Whole Blood', price: 150.0,
            parameters: [
              { code: 'WBC', name: 'White Blood Cell Count', unit: '10^3/uL', min: 4.5, max: 11.0 },
              { code: 'RBC', name: 'Red Blood Cell Count', unit: '10^6/uL', min: 4.2, max: 5.8 },
              { code: 'HGB', name: 'Hemoglobin', unit: 'g/dL', min: 12.0, max: 17.5 },
              { code: 'HCT', name: 'Hematocrit', unit: '%', min: 37.0, max: 51.0 },
              { code: 'PLT', name: 'Platelet Count', unit: '10^3/uL', min: 150.0, max: 450.0 }
            ]
          },
          {
            id: 2, code: 'LFT', name: 'Liver Function Tests', category: 'Biochemistry', sample: 'Serum', price: 350.0,
            parameters: [
              { code: 'ALT', name: 'Alanine Aminotransferase', unit: 'U/L', min: 7.0, max: 56.0 },
              { code: 'AST', name: 'Aspartate Aminotransferase', unit: 'U/L', min: 10.0, max: 40.0 }
            ]
          }
        ]);
      }

      if (worklistData && worklistData.length > 0) {
        const grouped = new Map<number, OrderItem>();
        for (const w of worklistData) {
          // Dapper can return column names in exact AS-alias case (OrderId) or camelCase via some serializers
          const ordId: number = Number(w.OrderId ?? w.orderId ?? w.orderid ?? w.order_id ?? w.id ?? 0);
          const itemId: number = Number(w.ItemId ?? w.itemId ?? w.itemid ?? w.item_id ?? 0);
          if (!ordId) continue; // skip rows without a valid order id

          const testCode: string = String(w.TestCode ?? w.testCode ?? w.testcode ?? 'TST');
          const testName: string = String(w.TestName ?? w.testName ?? w.testname ?? 'Test');
          const sampleType: string = String(w.SampleType ?? w.sampleType ?? w.sampletype ?? 'Blood');
          const itemBarcode: string = String(w.Barcode ?? w.barcode ?? `BC-${ordId}-${itemId}`);
          const rawItemStatus = w.ItemStatus ?? w.itemStatus ?? w.itemstatus ?? 0;
          const itemStatus: string = (Number(rawItemStatus) === 4) ? 'Resulted' : 'Processing';

          if (!grouped.has(ordId)) {
            grouped.set(ordId, {
              id: ordId,
              orderNo: String(w.OrderNumber ?? w.orderNumber ?? w.ordernumber ?? `LAB-${ordId}`),
              patientName: String(w.PatientName ?? w.patientName ?? w.patientname ?? 'Patient'),
              testCode: testCode,
              testName: testName,
              sampleType: sampleType,
              barcode: `BC-${ordId}`,
              status: 'Processing',
              custodyStep: 'AnalyzerRun',
              priority: w.Priority ?? w.priority,
              orderedAt: String(w.OrderedAt ?? w.orderedAt ?? w.orderedat ?? new Date().toISOString()),
              prevValue: undefined,
              results: {},
              tests: []
            });
          }

          const grp = grouped.get(ordId)!;
          grp.tests.push({ itemId, testCode, testName, sampleType, barcode: itemBarcode, status: itemStatus, results: {} });

          // Bubble up Resulted status only when ALL tests are resulted
          if (grp.tests.length > 0 && grp.tests.every(t => t.status === 'Resulted')) {
            grp.status = 'Resulted';
            grp.custodyStep = 'Verified';
          }
        }

        const mappedOrders = Array.from(grouped.values());
        setOrders(mappedOrders);
        if (mappedOrders.length > 0) setExpandedOrderId(mappedOrders[0].id);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to load lab data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabData(selectedDate, showAllDates);
  }, [selectedDate, showAllDates]);

  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4500);
  };

  const handleResultParamChange = (orderId: number, paramCode: string, val: string) => {
    setOrders(orders.map(o => {
      if (o.id === orderId) {
        return { ...o, results: { ...o.results, [paramCode]: val } };
      }
      return o;
    }));
  };

  const handleSaveOrderResults = async (orderId: number, isVerified: boolean) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      // Build results payload for all tests in this order
      const resultItems: any[] = [];

      for (const test of order.tests) {
        const testCatalogItem = catalog.find(c => c.code === test.testCode) || {
          parameters: [{ code: test.testCode, name: test.testName, unit: '', min: undefined, max: undefined }]
        };
        const params = testCatalogItem.parameters || [];

        // Collect sub-parameter values
        const paramSummaries: string[] = [];
        let primaryNum: number | null = null;
        let primaryFlag = 'Normal';
        let primaryUnit = '';
        let primaryRef = '';

        for (const p of params) {
          const resultKey = `${test.itemId}:${p.code}`;
          const val = order.results[resultKey] || order.results[p.code] || '';
          if (val) {
            const flag = calculateParamFlag(val, p.min, p.max);
            paramSummaries.push(`${p.name || p.code}: ${val} ${p.unit || ''} [${flag}]`.trim());
            const num = parseFloat(val);
            if (!isNaN(num) && primaryNum === null) {
              primaryNum = num;
              primaryFlag = flag;
              primaryUnit = p.unit || '';
              if (p.min !== undefined && p.max !== undefined) {
                primaryRef = `${p.min} - ${p.max} ${p.unit || ''}`.trim();
              }
            }
          }
        }

        const summaryText = paramSummaries.join(' | ') || (primaryNum !== null ? `${primaryNum} ${primaryUnit}` : 'Results recorded');

        resultItems.push({
          orderItemId: test.itemId,
          testCode: test.testCode,
          testName: test.testName,
          numericValue: primaryNum,
          textValue: summaryText,
          unit: primaryUnit,
          flag: primaryFlag,
          referenceRange: primaryRef,
          isCritical: primaryFlag === 'HH' || primaryFlag === 'LL',
          isVerified
        });
      }

      await api.post('/laboratory/results/save', {
        orderId,
        isVerified,
        results: resultItems
      });

      // Update local state
      setOrders(orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            status: isVerified ? 'Verified' : 'Resulted',
            custodyStep: isVerified ? 'Verified' : 'ResultsSaved',
            tests: o.tests.map(t => ({
              ...t,
              status: isVerified ? 'Verified' : 'Resulted'
            }))
          };
        }
        return o;
      }));

      showToast(
        isVerified
          ? `✓ Order #${order.orderNo} results verified & approved. Results are now live in Doctor EMR Patient History!`
          : `✓ Order #${order.orderNo} results saved successfully.`,
        'success'
      );
    } catch (err) {
      console.error('Save/Verify lab results error:', err);
      showToast(`Failed to save results for Order #${order.orderNo}. Please try again.`, 'error');
    }
  };

  const handleVerifyOrder = async (orderId: number) => {
    await handleSaveOrderResults(orderId, true);
  };

  const handleReceiveFromMachine = async (orderId: number, testCode?: string, testItemId?: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Pick connected machine (or first available machine)
    const connectedMachine = machines.find(m => m.status === 'CONNECTED') || machines[0];

    try {
      const targetTestCode = testCode || order.testCode || (order.tests[0]?.testCode) || 'CBC';
      const res = await api.post<any>('/laboratory/machine/receive', {
        orderId,
        orderItemId: testItemId,
        testCode: targetTestCode,
        machineId: connectedMachine?.id || 'MCH-01',
        machineName: connectedMachine?.name || 'Automated Laboratory Analyzer'
      });

      if (res && res.parameters) {
        const receivedParams = res.parameters as Record<string, string>;

        // Update local order results
        setOrders(orders.map(o => {
          if (o.id === orderId) {
            const updatedResults = { ...o.results };
            for (const t of o.tests) {
              if (!testItemId || t.itemId === testItemId || t.testCode === targetTestCode) {
                for (const [pCode, pVal] of Object.entries(receivedParams)) {
                  updatedResults[`${t.itemId}:${pCode}`] = pVal;
                  updatedResults[pCode] = pVal;
                }
              }
            }
            return {
              ...o,
              results: updatedResults,
              status: 'Resulted',
              custodyStep: 'ResultsSaved',
              tests: o.tests.map(t => (!testItemId || t.itemId === testItemId ? { ...t, status: 'Resulted' } : t))
            };
          }
          return o;
        }));

        showToast(
          `⚡ Live results received directly from ${connectedMachine?.name || 'Analyzer'} for ${targetTestCode}! Encoded into worklist.`,
          'success'
        );
      }
    } catch (err) {
      console.error('Receive from machine error:', err);
      showToast(`Machine communication error: Could not fetch results from analyzer.`, 'error');
    }
  };

  const handleAdvanceCustody = (orderId: number, nextStep: string) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, custodyStep: nextStep } : o));
  };

  const calculateParamFlag = (val: string, min?: number, max?: number) => {
    const num = parseFloat(val);
    if (isNaN(num) || min === undefined || max === undefined) return 'Normal';
    if (num > max * 1.3) return 'HH';
    if (num > max) return 'H';
    if (num < min * 0.7) return 'LL';
    if (num < min) return 'L';
    return 'Normal';
  };

  const calculateDeltaShift = (currentValStr: string, prevValStr?: string) => {
    const curr = parseFloat(currentValStr);
    const prev = parseFloat(prevValStr || '');
    if (!isNaN(curr) && !isNaN(prev) && prev > 0) {
      const shiftPercent = (((curr - prev) / prev) * 100).toFixed(1);
      const isLarge = Math.abs(parseFloat(shiftPercent)) > 30;
      return { shiftPercent, isLarge };
    }
    return null;
  };

  const handleAddParamRow = () => {
    setNewParams([...newParams, { code: `P${newParams.length + 1}`, name: 'New Sub-test Parameter', unit: 'U/L', min: '0', max: '100' }]);
  };

  const handleAddTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCatalogItem = {
      id: Date.now(),
      code: newTestCode.toUpperCase(),
      name: newTestName,
      category: newTestCategory,
      sample: 'Serum',
      price: parseFloat(newTestPrice) || 200,
      parameters: newParams.map(p => ({
        code: p.code,
        name: p.name,
        unit: p.unit,
        min: parseFloat(p.min) || 0,
        max: parseFloat(p.max) || 100
      }))
    };

    try {
      await api.post('/laboratory/catalog', {
        testCode: newCatalogItem.code,
        testName: newCatalogItem.name,
        category: newCatalogItem.category,
        sampleType: newCatalogItem.sample,
        price: newCatalogItem.price
      }).catch(() => {});
    } catch (err) {
      console.error('Add test error:', err);
    }

    setCatalog([...catalog, newCatalogItem]);
    setShowAddTestModal(false);
    setNewTestCode(''); setNewTestName('');
  };

  // ==========================================
  // LAB MACHINE HANDLERS
  // ==========================================
  const handlePingMachine = async (mId: string, ip: string, port: number, protocol: string) => {
    setPingStatus(prev => ({
      ...prev,
      [mId]: { testing: true, message: `Probing TCP socket connection to ${ip}:${port} (${protocol})...`, success: false }
    }));

    try {
      const res = await api.post<any>('/laboratory/instruments/ping', {
        ipAddress: ip,
        port: Number(port),
        timeoutMs: 1500
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
          status: isOnline ? ('CONNECTED' as const) : ('OFFLINE' as const),
          latencyMs: isOnline ? latency : undefined,
          lastPing: isOnline ? 'Connected just now' : `Offline (Checked ${new Date().toLocaleTimeString()})`
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
    <div>
      {/* Toast Alert */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 18px',
          borderRadius: '8px',
          background: toastMsg.type === 'error' ? '#dc2626' : toastMsg.type === 'info' ? '#0284c7' : '#059669',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}>
          {toastMsg.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          {toastMsg.text}
        </div>
      )}

      {/* 1. TOP CLINICAL KPI STATS BAR */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="glass-panel" style={{ padding: '14px 18px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lab Orders</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '3px' }}>{orders.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '2px' }}>{showAllDates ? 'All-time requisitions' : `Orders for ${selectedDate}`}</div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '4px solid #f59e0b', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Runs</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706', marginTop: '3px' }}>
            {orders.filter(o => o.status !== 'Resulted' && o.status !== 'Verified').length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Awaiting test results or review</div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '4px solid #10b981', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed & Resulted</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669', marginTop: '3px' }}>
            {orders.filter(o => o.status === 'Resulted' || o.status === 'Verified').length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Verified clinical test reports</div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '4px solid #0284c7', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Connected Analyzers</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0284c7', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: machines.some(m => m.status === 'CONNECTED') ? '#10b981' : '#ef4444', display: 'inline-block' }} />
            {machines.filter(m => m.status === 'CONNECTED').length} / {machines.length} Online
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Active LIS network interfaces</div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px', maxWidth: '100%' }}>
          <button onClick={() => setActiveTab('worklist')} className={activeTab === 'worklist' ? 'btn-primary' : 'btn-secondary'} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Layers size={15} /> Order Worklist ({orders.length})
          </button>
          <button onClick={() => setActiveTab('custody')} className={activeTab === 'custody' ? 'btn-primary' : 'btn-secondary'} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            <GitCommit size={15} /> Chain of Custody Tracker
          </button>
          <button onClick={() => setActiveTab('catalog')} className={activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            <FlaskConical size={15} /> Test Catalog ({catalog.length})
          </button>
          <button onClick={() => setActiveTab('instruments')} className={activeTab === 'instruments' ? 'btn-primary' : 'btn-secondary'} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Network size={15} /> Machine Integration ({machines.length})
          </button>
        </div>

        {activeTab === 'catalog' && (
          <button onClick={() => setShowAddTestModal(true)} className="btn-primary">
            <Plus size={16} /> Add Test / Profile
          </button>
        )}

        {activeTab === 'instruments' && (
          <button onClick={handleOpenAddMachine} className="btn-primary" style={{ background: 'linear-gradient(135deg, #0284c7, #0891b2)' }}>
            <Plus size={16} /> + Add Machine Integration
          </button>
        )}
      </div>

      {/* TAB 1: Worklist with Modern Date Picker & Delta Checking */}
      {activeTab === 'worklist' && (
        <div className="glass-panel" style={{ padding: '22px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          
          {/* Worklist Date Filter Toolbar with Native Date Picker */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            padding: '12px 16px',
            background: '#f8f5ee',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={17} color="#0284c7" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Select Date:</span>
              </div>
              
              {/* Native Date Picker */}
              <input
                type="date"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  setShowAllDates(false);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1.5px solid #0284c7',
                  background: '#ffffff',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              />

              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setSelectedDate(today);
                  setShowAllDates(false);
                }}
                className="btn-secondary"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  background: (!showAllDates && selectedDate === new Date().toISOString().split('T')[0]) ? '#0284c7' : '#ffffff',
                  color: (!showAllDates && selectedDate === new Date().toISOString().split('T')[0]) ? '#ffffff' : undefined,
                  borderColor: (!showAllDates && selectedDate === new Date().toISOString().split('T')[0]) ? '#0284c7' : undefined
                }}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setShowAllDates(!showAllDates)}
                className="btn-secondary"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  background: showAllDates ? '#0284c7' : '#ffffff',
                  color: showAllDates ? '#ffffff' : undefined,
                  borderColor: showAllDates ? '#0284c7' : undefined
                }}
              >
                {showAllDates ? '✓ Viewing All Dates' : 'All Orders'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-info" style={{ fontSize: '0.76rem', padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                {orders.length} Order{orders.length === 1 ? '' : 's'} {showAllDates ? '(All Time)' : `on ${selectedDate}`}
              </span>
              <button
                type="button"
                onClick={() => loadLabData(selectedDate, showAllDates)}
                className="btn-secondary"
                style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', background: '#ffffff' }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {orders.length === 0 ? (
              <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--text-muted)', background: '#faf8f5', borderRadius: '10px', border: '1px dashed var(--border-color)' }}>
                <FlaskConical size={42} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>No Laboratory Orders Found</div>
                <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                  There are no lab diagnostic requisitions recorded for {showAllDates ? 'any date' : selectedDate}. Choose a different date using the datepicker or click "All Orders".
                </div>
              </div>
            ) : (
              orders.map(o => {
                const isExpanded = expandedOrderId === o.id;
                const isStat = o.priority === 1 || o.priority === 'STAT';

                return (
                  <div
                    key={o.id}
                    style={{
                      borderRadius: '10px',
                      background: '#ffffff',
                      border: isExpanded ? '1.5px solid #0284c7' : '1px solid var(--border-color)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Order Header Row */}
                    <div
                      onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: isExpanded ? '#f0f9ff' : '#ffffff'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isExpanded ? <ChevronDown size={18} color="#0284c7" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace', fontSize: '0.88rem' }}>{o.orderNo}</span>
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{o.patientName}</strong>
                            {isStat ? (
                              <span style={{ padding: '2px 7px', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.68rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <AlertTriangle size={11} /> STAT
                              </span>
                            ) : (
                              <span style={{ padding: '2px 7px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.68rem', fontWeight: 700 }}>
                                Routine
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span><strong>Tests ({o.tests.length}):</strong> {o.tests.map(t => t.testCode).join(', ')}</span>
                            <span>•</span>
                            <span><strong>Order Barcode:</strong> <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', color: '#334155' }}>{o.barcode}</code></span>
                            {o.orderedAt && (
                              <>
                                <span>•</span>
                                <span><strong>Ordered:</strong> {String(o.orderedAt).split('T')[0]}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '5px', background: '#dcfce7', color: '#15803d', fontSize: '0.68rem', fontWeight: 800, border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={11} /> PAID
                        </span>
                        <span style={{ padding: '4px 9px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', fontSize: '0.72rem', fontWeight: 700, border: '1px solid #e2e8f0' }}>
                          {o.custodyStep}
                        </span>
                        <span className={o.status === 'Resulted' || o.status === 'Verified' ? 'badge badge-normal' : 'badge badge-warning'} style={{ fontSize: '0.72rem' }}>
                          {o.status}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPrintModalOrder(o); }}
                          className="btn-secondary"
                          style={{ padding: '5px 9px', fontSize: '0.73rem', background: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                        >
                          <Printer size={13} color="#0284c7" /> Print
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSaveOrderResults(o.id, false); }}
                          className="btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.73rem', background: '#f8fafc', borderColor: '#94a3b8', color: '#1e293b', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Save encoded / received results to database"
                        >
                          <Save size={13} color="#475569" /> Save Results
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSaveOrderResults(o.id, true); }}
                          className="btn-primary"
                          style={{ padding: '5px 11px', fontSize: '0.73rem', background: '#059669', borderColor: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Verify and approve results — makes them visible to Doctor in EMR"
                        >
                          <Check size={13} /> Verify &amp; Approve
                        </button>
                      </div>
                    </div>

                    {/* Sub-Tests Result Table with Delta Checking */}
                    {isExpanded && (
                      <div style={{ padding: '18px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0284c7', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Layers size={15} /> Tests in this Order ({o.tests.length})
                          </div>
                          {machines.some(m => m.status === 'CONNECTED') && (
                            <button
                              type="button"
                              onClick={() => handleReceiveFromMachine(o.id)}
                              className="btn-secondary"
                              style={{ padding: '3px 9px', fontSize: '0.72rem', background: '#ecfdf5', borderColor: '#6ee7b7', color: '#047857', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                              title="Receive results directly from connected analyzer machine"
                            >
                              <Zap size={12} color="#059669" /> Receive from Analyzer
                            </button>
                          )}
                        </div>

                        {o.tests.map((test, tIdx) => {
                          const testCatalogItem = catalog.find(c => c.code === test.testCode) || { parameters: [{ code: test.testCode, name: test.testName, unit: '', min: undefined, max: undefined }] };
                          return (
                            <div key={test.itemId || tIdx} style={{ marginBottom: tIdx < o.tests.length - 1 ? '18px' : 0 }}>
                              {/* Per-test header */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '6px 10px', background: '#e0f2fe', borderRadius: '6px' }}>
                                <FlaskConical size={14} color="#0284c7" />
                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0369a1' }}>{test.testName}</span>
                                <code style={{ fontSize: '0.72rem', color: '#334155', background: '#f1f5f9', padding: '1px 6px', borderRadius: '3px' }}>{test.barcode}</code>
                                <button
                                  type="button"
                                  onClick={() => handleReceiveFromMachine(o.id, test.testCode, test.itemId)}
                                  className="btn-secondary"
                                  style={{ padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700, background: '#ffffff', color: '#0284c7', borderColor: '#93c5fd', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}
                                  title={`Pull live analyzer reading for ${test.testCode}`}
                                >
                                  <Zap size={11} color="#0284c7" /> Get Machine Result
                                </button>
                                <span className={test.status === 'Resulted' || test.status === 'Verified' ? 'badge badge-normal' : 'badge badge-warning'} style={{ fontSize: '0.68rem', marginLeft: 'auto' }}>{test.status}</span>
                              </div>
                              <div className="table-responsive" style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <table className="cms-table" style={{ background: '#ffffff', margin: 0 }}>
                                  <thead style={{ background: '#f1f5f9' }}>
                                    <tr>
                                      <th>Parameter</th>
                                      <th>Code</th>
                                      <th>Reference Range</th>
                                      <th>Measured Result</th>
                                      <th>Delta Check</th>
                                      <th>Flag</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(testCatalogItem.parameters || []).map((p: any) => {
                                      const resultKey = `${test.itemId}:${p.code}`;
                                      const currentVal = o.results[resultKey] || '';
                                      const flag = calculateParamFlag(currentVal, p.min, p.max);
                                      const delta = calculateDeltaShift(currentVal, o.prevValue);
                                      return (
                                        <tr key={p.code}>
                                          <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</td>
                                          <td style={{ fontFamily: 'monospace', color: '#0284c7', fontWeight: 600 }}>{p.code}</td>
                                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.min} – {p.max} {p.unit}</td>
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <input
                                                type="text"
                                                value={currentVal}
                                                onChange={e => handleResultParamChange(o.id, resultKey, e.target.value)}
                                                placeholder="Enter val..."
                                                style={{ width: '120px', padding: '5px 8px', fontWeight: 700, borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#1e293b' }}
                                              />
                                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.unit}</span>
                                            </div>
                                          </td>
                                          <td>
                                            {delta ? (
                                              <span className={delta.isLarge ? 'badge badge-critical' : 'badge badge-info'} style={{ fontSize: '0.72rem' }}>
                                                {parseFloat(delta.shiftPercent) > 0 ? `+${delta.shiftPercent}%` : `${delta.shiftPercent}%`} Shift
                                              </span>
                                            ) : (
                                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>First Result</span>
                                            )}
                                          </td>
                                          <td>
                                            <span className={flag === 'HH' || flag === 'LL' ? 'badge badge-critical' : (flag === 'H' || flag === 'L' ? 'badge badge-warning' : 'badge badge-normal')}>
                                              {flag}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Chain of Custody Barcode Tracker */}
      {activeTab === 'custody' && (
        <div className="glass-panel" style={{ padding: '24px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <GitCommit color="#059669" size={20} /> Sample Chain of Custody & Barcode Lifecycle
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Track diagnostic specimen tubes through phased verification checkpoints with real-time audit logging.
              </p>
            </div>
            <span className="badge badge-normal" style={{ fontSize: '0.75rem' }}>{orders.length} Specimen Tubes In-Queue</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {orders.map(o => (
              <div
                key={o.id}
                style={{
                  padding: '16px 18px',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <code style={{ fontWeight: 800, color: '#0284c7', background: '#f0f9ff', padding: '3px 8px', borderRadius: '4px', border: '1px solid #bae6fd', fontSize: '0.84rem' }}>
                      {o.barcode}
                    </code>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>({o.sampleType || 'EDTA Whole Blood'})</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-main)' }}>{o.patientName} — {o.testName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Current Milestone: <strong style={{ color: '#0284c7' }}>{o.custodyStep}</strong> • Order #{o.orderNo}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['Collected', 'ReceivedInLab', 'Aliquoted', 'ResultsSaved', 'Verified', 'Archived'].map(step => (
                    <button
                      key={step}
                      onClick={() => handleAdvanceCustody(o.id, step)}
                      className={o.custodyStep === step ? 'btn-primary' : 'btn-secondary'}
                      style={{
                        padding: '5px 9px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: o.custodyStep === step ? '#0284c7' : '#ffffff',
                        color: o.custodyStep === step ? '#ffffff' : undefined,
                        borderColor: o.custodyStep === step ? '#0284c7' : undefined
                      }}
                    >
                      {step}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* TAB 4: Test Catalog with Sub-Tests Definition */}
      {activeTab === 'catalog' && (
        <div className="glass-panel" style={{ padding: '24px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FlaskConical color="#0284c7" size={20} /> Master Lab Test Profiles & Reference Ranges
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Standardized diagnostic profiles, analyte sub-parameters, and age/gender normalized biological reference limits.
              </p>
            </div>
            <button onClick={() => setShowAddTestModal(true)} className="btn-primary" style={{ padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600 }}>
              <Plus size={15} /> Add Test Profile
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {catalog.map(t => (
              <div
                key={t.id}
                style={{
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  padding: '16px 18px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace', fontSize: '0.88rem' }}>{t.code}</span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>{t.name}</strong>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{t.category}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      Specimen: <strong>{t.sample}</strong> • Base Charge: <strong style={{ color: '#059669' }}>ETB {t.price}</strong>
                    </div>
                  </div>
                  <span className="badge badge-normal" style={{ fontSize: '0.72rem' }}>{t.parameters.length} Analyte Parameters</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {t.parameters.map((p: any) => (
                    <div
                      key={p.code}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.75rem'
                      }}
                    >
                      <strong style={{ color: '#0284c7' }}>{p.name}</strong> <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>({p.code})</span>: {p.min} – {p.max} {p.unit}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CONNECTED ANALYZERS & LABORATORY MACHINE INTEGRATION GATEWAY        */}
      {/* ========================================================================= */}
      {activeTab === 'instruments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner & Stats */}
          <div className="glass-panel" style={{ padding: '20px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={20} color="#0284c7" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Laboratory Machine Integrations & LIS Middleware
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Manage bi-directional and uni-directional TCP/IP, MLLP, and ASTM analyzer feeds across all clinical departments.
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
                      borderLeft: `4px solid ${isConnected ? '#10b981' : '#94a3b8'}`
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
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>{m.name}</h4>
                          <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: '2px', fontWeight: 600 }}>{m.model}</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span
                            className={isConnected ? 'badge badge-normal' : 'badge badge-warning'}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem' }}
                          >
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isConnected ? '#10b981' : '#f59e0b', display: 'inline-block' }}></span>
                            {m.status}
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
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
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
                          title="Ping Analyzer and verify MLLP/ASTM socket handshake"
                        >
                          <Activity size={13} className={isPingTesting ? 'animate-spin' : ''} color="#0284c7" />
                          {isPingTesting ? 'Testing...' : 'Test Connection'}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT LAB MACHINE INTEGRATION                                  */}
      {/* ========================================================================= */}
      {showAddMachineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', padding: '24px 20px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Server size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                    {editingMachineId ? 'Edit Lab Machine Integration' : 'Add New Laboratory Machine Integration'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Configure LIS network driver, socket protocol, and communication parameters
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAddMachineModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveMachine} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Department Dropdown */}
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
                      // Auto configure port/protocol based on department standard
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
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px' }}
                >
                  {Object.keys(LAB_MACHINE_CATALOGUE).map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Machine Model Dropdown Filtered by Department */}
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
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px' }}
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
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                  />
                </div>
              )}

              {/* Display Name & Station ID */}
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
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
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
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* Protocol, IP, Port, Transmission Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 90px', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    Protocol <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <select
                    value={formProtocol}
                    onChange={e => setFormProtocol(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
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
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace' }}
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
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* Mode & Description */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                    Communication Mode
                  </label>
                  <select
                    value={formMode}
                    onChange={e => setFormMode(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
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
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
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
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)' }}
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
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Form Action Buttons */}
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

      {/* Modal: Add Test Profile with Sub-Test Parameters */}
      {showAddTestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '560px', padding: '24px 20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add Diagnostic Profile & Sub-Test Parameters</h3>
              <button onClick={() => setShowAddTestModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleAddTestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Profile Code</label>
                  <input type="text" value={newTestCode} onChange={e => setNewTestCode(e.target.value)} placeholder="e.g. LFT-02" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Profile Name</label>
                  <input type="text" value={newTestName} onChange={e => setNewTestName(e.target.value)} placeholder="e.g. Comprehensive Liver Panel" required />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Price (ETB)</label>
                <input type="number" value={newTestPrice} onChange={e => setNewTestPrice(e.target.value)} required />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#06b6d4', fontWeight: 700 }}>Sub-Test Parameters & Ranges</label>
                  <button type="button" onClick={handleAddParamRow} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>+ Add Parameter</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {newParams.map((p, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px 60px 60px', gap: '6px' }}>
                      <input type="text" value={p.code} onChange={e => { const updated = [...newParams]; updated[idx].code = e.target.value; setNewParams(updated); }} placeholder="Code" />
                      <input type="text" value={p.name} onChange={e => { const updated = [...newParams]; updated[idx].name = e.target.value; setNewParams(updated); }} placeholder="Name" />
                      <input type="text" value={p.unit} onChange={e => { const updated = [...newParams]; updated[idx].unit = e.target.value; setNewParams(updated); }} placeholder="Unit" />
                      <input type="text" value={p.min} onChange={e => { const updated = [...newParams]; updated[idx].min = e.target.value; setNewParams(updated); }} placeholder="Min" />
                      <input type="text" value={p.max} onChange={e => { const updated = [...newParams]; updated[idx].max = e.target.value; setNewParams(updated); }} placeholder="Max" />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowAddTestModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Test Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLINICAL LABORATORY REPORT PRINT MODAL */}
      {printModalOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Header / Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0284c7', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0369a1', margin: 0, letterSpacing: '-0.02em' }}>
                  HUDERMA SPECIALIZED CLINIC & LABORATORY
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Department of Clinical Pathology & Automated Diagnostic Medicine • ISO 15189 Standard
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-primary"
                  style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 700 }}
                >
                  <Printer size={16} /> Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalOrder(null)}
                  className="btn-secondary"
                  style={{ padding: '8px 14px' }}
                >
                  <X size={16} /> Close
                </button>
              </div>
            </div>

            {/* Patient & Requisition Demographics */}
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Patient Name:</span>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{printModalOrder.patientName}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Order / Barcode No:</span>
                <div style={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>{printModalOrder.orderNo} ({printModalOrder.barcode})</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Specimen Type:</span>
                <div style={{ fontWeight: 700 }}>{printModalOrder.sampleType || 'Whole Blood (EDTA)'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Requisition Date:</span>
                <div style={{ fontWeight: 600 }}>{printModalOrder.orderedAt ? new Date(printModalOrder.orderedAt).toLocaleString() : new Date().toLocaleDateString()}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Verification Status:</span>
                <div>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: '0.72rem' }}>
                    CERTIFIED & VERIFIED
                  </span>
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Payment Status:</span>
                <div>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 800, fontSize: '0.72rem' }}>
                    PAID / SETTLED
                  </span>
                </div>
              </div>
            </div>

            {/* Test Profile Results - one section per test */}
            {(printModalOrder.tests && printModalOrder.tests.length > 0
              ? printModalOrder.tests
              : [{ itemId: 0, testCode: printModalOrder.testCode, testName: printModalOrder.testName, barcode: printModalOrder.barcode, sampleType: printModalOrder.sampleType, status: printModalOrder.status, results: {} }]
            ).map((test: OrderTestItem, tIdx: number) => {
              const testCatalogItem = catalog.find(c => c.code === test.testCode) || { parameters: [{ code: test.testCode, name: test.testName, unit: 'U/L', min: 0, max: 100 }] };
              const params = testCatalogItem.parameters || [];
              return (
                <div key={test.itemId || tIdx} style={{ marginBottom: tIdx < (printModalOrder.tests?.length ?? 1) - 1 ? '24px' : 0 }}>
                  <div style={{ fontSize: '1.0rem', fontWeight: 800, color: 'var(--text-main)', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span>Test: {test.testName} ({test.testCode})</span>
                    <code style={{ fontSize: '0.72rem', color: '#334155', background: '#f1f5f9', padding: '1px 6px', borderRadius: '3px' }}>{test.barcode}</code>
                  </div>
                  <table className="cms-table" style={{ background: '#ffffff', margin: 0 }}>
                    <thead style={{ background: '#f1f5f9' }}>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Analyte / Test Parameter</th>
                        <th style={{ textAlign: 'left' }}>Code</th>
                        <th style={{ textAlign: 'center' }}>Observed Result</th>
                        <th style={{ textAlign: 'center' }}>Unit</th>
                        <th style={{ textAlign: 'center' }}>Reference Interval</th>
                        <th style={{ textAlign: 'center' }}>Interpretation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {params.map((p: any) => {
                        const resultKey = `${test.itemId}:${p.code}`;
                        const val = printModalOrder.results[resultKey] || printModalOrder.results[p.code] || '---';
                        const flag = calculateParamFlag(val, p.min, p.max);
                        const isAbnormal = flag !== 'Normal' && val !== '---';
                        return (
                          <tr key={p.code}>
                            <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</td>
                            <td style={{ fontFamily: 'monospace', color: '#0284c7' }}>{p.code}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', color: isAbnormal ? '#dc2626' : '#0f172a' }}>{val}</td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.unit}</td>
                            <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {p.min !== undefined && p.max !== undefined ? `${p.min} – ${p.max}` : 'Normative'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: isAbnormal ? '#fee2e2' : '#dcfce7', color: isAbnormal ? '#b91c1c' : '#15803d' }}>
                                {val === '---' ? 'Pending' : flag}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Pathologist / Laboratory Director Signatures */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed #cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', fontSize: '0.78rem' }}>
              <div>
                <div style={{ height: '36px', borderBottom: '1px solid #64748b', width: '180px', marginBottom: '4px' }} />
                <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>Medical Laboratory Technologist</div>
                <div style={{ color: 'var(--text-muted)' }}>License # ETH-MLT-84920 • LIS System Verified</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ height: '36px', borderBottom: '1px solid #64748b', width: '180px', marginLeft: 'auto', marginBottom: '4px' }} />
                <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>Consultant Clinical Pathologist</div>
                <div style={{ color: 'var(--text-muted)' }}>HUDERMA Central Laboratories</div>
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              Notice: This electronic medical laboratory document was authenticated via HUDERMA Clinic Management LIS. Results relate only to the specimen tested.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DIRECT ANALYZER MACHINE LIS / HL7 / ASTM FEED SIMULATOR            */}
      {/* ========================================================================= */}
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
                    {feedIngestResult.success ? '✓ Machine Result Ingestion Succeeded' : '✗ Ingestion Failed'}
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
                      protocol: simProtocol,
                      rawPayload: simPayload,
                      orderId: simOrderId ? parseInt(simOrderId) : null,
                      machineIdentifier: simMachineId
                    });
                    setFeedIngestResult(res);
                    loadLabData();
                  } catch (err: any) {
                    setFeedIngestResult({ success: false, message: err.message || 'Transmission failed.' });
                  } finally {
                    setIsIngestingFeed(false);
                  }
                }}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isIngestingFeed ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Send Live Feed to Backend LIS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
