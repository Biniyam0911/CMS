import React, { useState } from 'react';
import {
  Baby, Calendar, Clock, HeartPulse, Activity, AlertTriangle, ShieldAlert,
  CheckCircle2, Plus, Save, Lock, Edit3, Trash2, ChevronRight,
  Eye, EyeOff, User, Stethoscope, FileText, FileHeart, FlaskConical,
  ClipboardList, ShieldCheck, Check, Sparkles, AlertCircle, RefreshCw, Printer, X
} from 'lucide-react';
import {
  AncWorkspaceDetailDto, AncEncounterDto, AncPreviousPregnancyDto,
  AncUltrasoundDto, AncPmtctDto, AncLabExaminationDto, AncDiagnosisDto,
  AncAppointmentDto, AncRegisterEpisodeRequest, AncCreateEncounterRequest,
  AncCloseEpisodeRequest, AncUpdateEpisodeBaselineRequest
} from './ancTypes';

interface AncWorkspaceViewProps {
  workspace: AncWorkspaceDetailDto;
  isNewRegistrationMode?: boolean;
  onRefresh: () => void;
  onSaveNewEpisode: (req: AncRegisterEpisodeRequest) => Promise<void>;
  onCreateEncounter: (req: AncCreateEncounterRequest) => Promise<void>;
  onFinalizeEncounter: (encounterId: number) => Promise<void>;
  onAddUltrasound: (dto: AncUltrasoundDto) => Promise<void>;
  onSavePmtct: (dto: AncPmtctDto) => Promise<void>;
  onAddLab: (dto: AncLabExaminationDto) => Promise<void>;
  onAddDiagnosis: (dto: AncDiagnosisDto) => Promise<void>;
  onScheduleAppointment: (dto: AncAppointmentDto) => Promise<void>;
  onCloseEpisode: (req: AncCloseEpisodeRequest) => Promise<void>;
  onApproveOverdueReview: (reviewNotes: string) => Promise<void>;
  onUpdateDating: (method: string, lmp?: string, usDate?: string, usWeeks?: number, usDays?: number) => Promise<void>;
  onUpdateBaseline?: (req: AncUpdateEpisodeBaselineRequest) => Promise<void>;
  onPrintSummary: () => void;
}

export default function AncWorkspaceView({
  workspace,
  isNewRegistrationMode = false,
  onRefresh,
  onSaveNewEpisode,
  onCreateEncounter,
  onFinalizeEncounter,
  onAddUltrasound,
  onSavePmtct,
  onAddLab,
  onAddDiagnosis,
  onScheduleAppointment,
  onCloseEpisode,
  onApproveOverdueReview,
  onUpdateDating,
  onUpdateBaseline,
  onPrintSummary
}: AncWorkspaceViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  // When filling follow-up for an existing pregnancy, registration & remaining parameters are hidden by default!
  const [showExtendedParams, setShowExtendedParams] = useState<boolean>(isNewRegistrationMode || !workspace.episode.id);

  React.useEffect(() => {
    setShowExtendedParams(isNewRegistrationMode || !workspace.episode.id);
  }, [isNewRegistrationMode, workspace.episode.id]);

  // 1. Baseline Registration / Obstetric Profile State
  const [regGravida, setRegGravida] = useState<number>(workspace.episode.gravidity || 1);
  const [regPara, setRegPara] = useState<number>(workspace.episode.parity || 0);
  const [regLmp, setRegLmp] = useState<string>(workspace.episode.lmpDate ? workspace.episode.lmpDate.split('T')[0] : '');
  const [regCycleRegular, setRegCycleRegular] = useState<boolean>(workspace.episode.isCycleRegular ?? true);
  const [regDatingMethod, setRegDatingMethod] = useState<string>(workspace.episode.approvedDatingMethod || 'LMP');

  // Baseline Medical History States
  const [histDiabetes, setHistDiabetes] = useState<{ status: 'Yes' | 'No' | 'Unknown'; remarks?: string }>({ status: 'No' });
  const [histHypertension, setHistHypertension] = useState<{ status: 'Yes' | 'No' | 'Unknown'; remarks?: string }>({ status: 'No' });
  const [histRenal, setHistRenal] = useState<{ status: 'Yes' | 'No' | 'Unknown'; remarks?: string }>({ status: 'No' });
  const [histTb, setHistTb] = useState<{ status: 'Yes' | 'No' | 'Unknown'; remarks?: string }>({ status: 'No' });
  const [histAllergy, setHistAllergy] = useState<{ status: 'Yes' | 'No' | 'Unknown'; remarks?: string }>({ status: 'No' });
  const [histSurgery, setHistSurgery] = useState<{ status: 'Yes' | 'No' | 'Unknown'; remarks?: string }>({ status: 'No' });

  // In-line Past Pregnancy quick add state
  const [pastPregnanciesList, setPastPregnanciesList] = useState<AncPreviousPregnancyDto[]>(workspace.previousPregnancies || []);
  const [inlinePrevYear, setInlinePrevYear] = useState<string>('');
  const [inlinePrevMode, setInlinePrevMode] = useState<string>('Spontaneous Vaginal Delivery (SVD)');
  const [inlinePrevWeeks, setInlinePrevWeeks] = useState<string>('40');
  const [inlinePrevOutcome, setInlinePrevOutcome] = useState<string>('Live Birth');
  const [inlinePrevWeight, setInlinePrevWeight] = useState<string>('3200');

  // 2. Encounter Form State (Current Follow-up Visit matching legacy video parameters)
  const [encounterWeight, setEncounterWeight] = useState<string>('');
  const [encounterHeight, setEncounterHeight] = useState<string>('');
  const [encounterSysBp, setEncounterSysBp] = useState<string>('');
  const [encounterDiaBp, setEncounterDiaBp] = useState<string>('');
  const [encounterPulseRate, setEncounterPulseRate] = useState<string>('');
  const [encounterRespRate, setEncounterRespRate] = useState<string>('');
  const [encounterTemp, setEncounterTemp] = useState<string>('');
  const [encounterFundalHeight, setEncounterFundalHeight] = useState<string>('');
  const [encounterFhr, setEncounterFhr] = useState<string>('');
  const [encounterPresentation, setEncounterPresentation] = useState<string>('Cephalic');
  const [encounterFetalMovement, setEncounterFetalMovement] = useState<string>('Normal');
  const [encounterAnemia, setEncounterAnemia] = useState<string>('None');
  const [encounterEdema, setEncounterEdema] = useState<string>('None');
  const [encounterIron, setEncounterIron] = useState<string>('Prescribed');
  const [encounterTetanus, setEncounterTetanus] = useState<string>('TT1 Given');
  const [encounterLabRemarks, setEncounterLabRemarks] = useState<string>('');
  const [encounterClinicalNotes, setEncounterClinicalNotes] = useState<string>('');
  const [encounterAssessment, setEncounterAssessment] = useState<string>('');
  const [encounterPlan, setEncounterPlan] = useState<string>('');
  const [encounterNextVisitDate, setEncounterNextVisitDate] = useState<string>('');
  const [encounterAppointmentRemarks, setEncounterAppointmentRemarks] = useState<string>('Routine ANC Follow-up');
  const [encounterDangerSigns, setEncounterDangerSigns] = useState<string[]>([]);
  const [isDraftMode, setIsDraftMode] = useState<boolean>(false);
  const [isCorrectionMode, setIsCorrectionMode] = useState<boolean>(false);
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // In-line Diagnosis State
  const [inlineDiagDesc, setInlineDiagDesc] = useState<string>('');
  const [inlineDiagIcd, setInlineDiagIcd] = useState<string>('');
  const [inlineDiagDhis, setInlineDiagDhis] = useState<string>('');

  // 4. In-line Ultrasound Form State (On Page)
  const [inlineUsDate, setInlineUsDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inlineUsWeeks, setInlineUsWeeks] = useState<number>(workspace.episode.currentGestationalWeeks || 0);
  const [inlineUsDays, setInlineUsDays] = useState<number>(workspace.episode.currentGestationalDays || 0);
  const [inlineUsPres, setInlineUsPres] = useState<string>('Cephalic');
  const [inlineUsPlacenta, setInlineUsPlacenta] = useState<string>('Fundal Posterior (High)');
  const [inlineUsFluid, setInlineUsFluid] = useState<string>('Normal (AFI 14 cm)');
  const [inlineUsFhr, setInlineUsFhr] = useState<string>('');
  const [inlineUsWeight, setInlineUsWeight] = useState<string>('');

  // 5. In-line Laboratory Form State (On Page)
  const [inlineLabType, setInlineLabType] = useState<string>('Hemoglobin (Hb)');
  const [inlineLabDate, setInlineLabDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inlineLabValue, setInlineLabValue] = useState<string>('');
  const [inlineLabUnit, setInlineLabUnit] = useState<string>('g/dL');
  const [inlineLabRef, setInlineLabRef] = useState<string>('11.0 - 15.0');
  const [inlineLabAbnormal, setInlineLabAbnormal] = useState<boolean>(false);

  // 6. PMTCT Form State (On Page)
  const [pmtctMotherCode, setPmtctMotherCode] = useState(workspace.pmtct?.motherConfidentialCode || '');
  const [pmtctPartnerCode, setPmtctPartnerCode] = useState(workspace.pmtct?.partnerConfidentialCode || '');
  const [pmtctMotherLetter, setPmtctMotherLetter] = useState(workspace.pmtct?.motherLetterCode || '');
  const [pmtctPartnerLetter, setPmtctPartnerLetter] = useState(workspace.pmtct?.partnerLetterCode || '');
  const [pmtctHivTested, setPmtctHivTested] = useState(workspace.pmtct?.hivTested || 'Yes');
  const [pmtctHivResult, setPmtctHivResult] = useState(workspace.pmtct?.hivTestResult || 'Negative');
  const [pmtctPartnerResult, setPmtctPartnerResult] = useState(workspace.pmtct?.partnerHivResult || 'Negative');
  const [pmtctCd4, setPmtctCd4] = useState<string>(workspace.pmtct?.cd4Count ? String(workspace.pmtct.cd4Count) : '');
  const [pmtctStage, setPmtctStage] = useState(workspace.pmtct?.whoClinicalStaging || 'Stage 1');
  const [pmtctInfantFeed, setPmtctInfantFeed] = useState(workspace.pmtct?.infantFeedingCounseling || 'Exclusive Breastfeeding');
  const [pmtctArtLinked, setPmtctArtLinked] = useState<boolean>(workspace.pmtct?.linkedToArt || false);
  const [pmtctRemarks, setPmtctRemarks] = useState(workspace.pmtct?.confidentialRemarks || '');
  const [isPmtctVisible, setIsPmtctVisible] = useState<boolean>(true);

  // 7. In-line Delivery Outcome Form State (On Page)
  const [isDeliveryClosureActive, setIsDeliveryClosureActive] = useState<boolean>(false);
  const [delDate, setDelDate] = useState(new Date().toISOString().split('T')[0]);
  const [delTime, setDelTime] = useState('12:00');
  const [delPlace, setDelPlace] = useState('Hospital Labor Ward');
  const [delMode, setDelMode] = useState('Spontaneous Vaginal Delivery (SVD)');
  const [delOutcome, setDelOutcome] = useState('Live Birth');
  const [delNumBabies, setDelNumBabies] = useState<number>(1);
  const [delMatOutcome, setDelMatOutcome] = useState('Discharged alive in good condition');
  const [delMatComp, setDelMatComp] = useState('None');
  const [delB1Outcome, setDelB1Outcome] = useState('Alive & Healthy');
  const [delB1Sex, setDelB1Sex] = useState('Female');
  const [delB1Weight, setDelB1Weight] = useState('3250');
  const [delB1Apgar1, setDelB1Apgar1] = useState('8');
  const [delB1Apgar5, setDelB1Apgar5] = useState('9');
  const [delRemarks, setDelRemarks] = useState('');

  // Quick Jump Scroll Helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const DANGER_SIGNS_LIST = [
    'Vaginal bleeding',
    'Severe headache / visual blur',
    'Severe abdominal pain',
    'High fever / chills',
    'Reduced / absent fetal movement',
    'Fluid leakage (ROM)',
    'Convulsions / fits',
    'Facial / severe hand edema'
  ];

  const handleToggleDangerSign = (sign: string) => {
    if (encounterDangerSigns.includes(sign)) {
      setEncounterDangerSigns(encounterDangerSigns.filter(s => s !== sign));
    } else {
      setEncounterDangerSigns([...encounterDangerSigns, sign]);
    }
  };

  // Add past delivery in-line
  const handleAddPastPregnancyInline = () => {
    if (!inlinePrevYear) {
      alert('Please enter birth year.');
      return;
    }
    const newEntry: AncPreviousPregnancyDto = {
      id: Date.now(),
      pregnancyNumber: pastPregnanciesList.length + 1,
      birthYear: Number(inlinePrevYear),
      modeOfDelivery: inlinePrevMode,
      gestationalAgeWeeks: Number(inlinePrevWeeks),
      deliveryOutcome: inlinePrevOutcome,
      birthWeightGrams: Number(inlinePrevWeight)
    };
    setPastPregnanciesList([...pastPregnanciesList, newEntry]);
    setInlinePrevYear('');
  };

  // Dedicated handler to save baseline registration corrections directly from Section 1
  const handleSaveBaselineOnly = async () => {
    if (!onUpdateBaseline || !workspace.episode.id) return;
    setIsSubmitting(true);
    try {
      await onUpdateBaseline({
        episodeId: workspace.episode.id,
        gravidity: regGravida,
        parity: regPara,
        lmpDate: regLmp || undefined,
        isCycleRegular: regCycleRegular,
        approvedDatingMethod: regDatingMethod,
        previousPregnancies: pastPregnanciesList
      });
      setShowExtendedParams(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to update registration parameters.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // ONE MASTER SAVE BUTTON HANDLER FOR ALL SECTIONS (ON TOP & BOTTOM)
  // =========================================================================
  const handleMasterSave = async () => {
    setIsSubmitting(true);
    try {
      // MODE A: Registering a brand new pregnancy episode
      if (isNewRegistrationMode || !workspace.episode.id) {
        await onSaveNewEpisode({
          patientId: workspace.patient.patientId,
          registrationDate: new Date().toISOString().split('T')[0],
          gravidity: regGravida,
          parity: regPara,
          lmpDate: regLmp || undefined,
          isCycleRegular: regCycleRegular,
          approvedDatingMethod: regDatingMethod,
          previousPregnancies: pastPregnanciesList
        });
        return;
      }

      // MODE B: Active or established episode - Commit all updated sections
      let actionsCount = 0;

      // 1. Follow-up Encounter Save (if any metrics, vitals, or clinical notes entered)
      const hasEncounterData = Boolean(
        encounterSysBp || encounterDiaBp || encounterWeight || encounterPulseRate || encounterRespRate ||
        encounterTemp || encounterFundalHeight || encounterFhr || encounterAssessment || encounterPlan ||
        encounterClinicalNotes || encounterLabRemarks || encounterDangerSigns.length > 0 || encounterNextVisitDate
      );

      if (hasEncounterData) {
        if (!encounterSysBp || !encounterDiaBp) {
          alert('Blood Pressure (Systolic and Diastolic) is required to document this clinical follow-up encounter.');
          setIsSubmitting(false);
          return;
        }

        await onCreateEncounter({
          episodeId: workspace.episode.id,
          encounterDate: new Date().toISOString().split('T')[0],
          weight: encounterWeight ? Number(encounterWeight) : undefined,
          systolicBp: Number(encounterSysBp),
          diastolicBp: Number(encounterDiaBp),
          pulseRate: encounterPulseRate ? Number(encounterPulseRate) : undefined,
          respiratoryRate: encounterRespRate ? Number(encounterRespRate) : undefined,
          temperature: encounterTemp ? Number(encounterTemp) : undefined,
          fundalHeight: encounterFundalHeight ? Number(encounterFundalHeight) : undefined,
          fetalHeartRate: encounterFhr ? Number(encounterFhr) : undefined,
          fetalPresentation: encounterPresentation,
          fetalMovement: encounterFetalMovement,
          anemia: encounterAnemia,
          edema: encounterEdema,
          ironSupplementation: encounterIron,
          tetanusVaccination: encounterTetanus,
          dangerSigns: encounterDangerSigns,
          clinicalNotes: encounterClinicalNotes,
          assessment: encounterAssessment,
          plan: encounterPlan,
          labResultRemarks: encounterLabRemarks,
          nextVisitDate: encounterNextVisitDate || undefined,
          appointmentRemarks: encounterAppointmentRemarks,
          isDraft: isDraftMode,
          isCorrection: isCorrectionMode,
          correctionReason: isCorrectionMode ? correctionReason : undefined
        });

        // Reset follow-up encounter inputs
        setEncounterWeight('');
        setEncounterHeight('');
        setEncounterSysBp('');
        setEncounterDiaBp('');
        setEncounterPulseRate('');
        setEncounterRespRate('');
        setEncounterTemp('');
        setEncounterFundalHeight('');
        setEncounterFhr('');
        setEncounterLabRemarks('');
        setEncounterClinicalNotes('');
        setEncounterAssessment('');
        setEncounterPlan('');
        setEncounterDangerSigns([]);
        setIsCorrectionMode(false);
        setCorrectionReason('');
        actionsCount++;
      }

      // 2. In-line Diagnosis Save (if description entered)
      if (inlineDiagDesc.trim()) {
        await onAddDiagnosis({
          id: 0,
          episodeId: workspace.episode.id,
          description: inlineDiagDesc.trim(),
          icdCode: inlineDiagIcd.trim() || undefined,
          dhis2Code: inlineDiagDhis.trim() || undefined,
          diagnosisType: 'Primary',
          diagnosisDate: new Date().toISOString().split('T')[0]
        });
        setInlineDiagDesc('');
        setInlineDiagIcd('');
        setInlineDiagDhis('');
        actionsCount++;
      }

      // 3. In-line Biometric Ultrasound Save (if performed today)
      if (inlineUsFhr || inlineUsWeight || (inlineUsWeeks > 0 && inlineUsWeeks !== workspace.episode.currentGestationalWeeks)) {
        await onAddUltrasound({
          id: 0,
          episodeId: workspace.episode.id,
          ultrasoundDate: inlineUsDate,
          gestationalAgeWeeks: inlineUsWeeks || workspace.episode.currentGestationalWeeks,
          gestationalAgeDays: inlineUsDays,
          gestationalAgeFormatted: `${inlineUsWeeks || workspace.episode.currentGestationalWeeks}w ${inlineUsDays}d`,
          trimester: (inlineUsWeeks || workspace.episode.currentGestationalWeeks) < 14 ? 1 : (inlineUsWeeks || workspace.episode.currentGestationalWeeks) < 28 ? 2 : 3,
          presentation: inlineUsPres,
          placentalLocation: inlineUsPlacenta,
          amnioticFluid: inlineUsFluid,
          fetalHeartRate: inlineUsFhr ? Number(inlineUsFhr) : undefined,
          estimatedFetalWeight: inlineUsWeight ? Number(inlineUsWeight) : undefined,
          createdAt: new Date().toISOString()
        });
        setInlineUsFhr('');
        setInlineUsWeight('');
        actionsCount++;
      }

      // 4. In-line Laboratory Result Save (if result value provided)
      if (inlineLabValue.trim()) {
        await onAddLab({
          id: 0,
          episodeId: workspace.episode.id,
          testType: inlineLabType,
          testDate: inlineLabDate,
          resultValue: inlineLabValue.trim(),
          unit: inlineLabUnit.trim(),
          referenceRange: inlineLabRef.trim() || undefined,
          status: 'Completed',
          isAbnormal: inlineLabAbnormal
        });
        setInlineLabValue('');
        setInlineLabAbnormal(false);
        actionsCount++;
      }

      // 5. Baseline Profile & Registration Updates (if Gravida, Para, Cycle, LMP, Dating Method, or Past Deliveries were corrected)
      const hasBaselineChanged =
        regGravida !== workspace.episode.gravidity ||
        regPara !== workspace.episode.parity ||
        regCycleRegular !== (workspace.episode.isCycleRegular ?? true) ||
        regDatingMethod !== workspace.episode.approvedDatingMethod ||
        (regLmp && regLmp !== (workspace.episode.lmpDate ? workspace.episode.lmpDate.split('T')[0] : '')) ||
        pastPregnanciesList.length !== (workspace.previousPregnancies?.length || 0);

      if (hasBaselineChanged) {
        if (onUpdateBaseline) {
          await onUpdateBaseline({
            episodeId: workspace.episode.id,
            gravidity: regGravida,
            parity: regPara,
            lmpDate: regLmp || undefined,
            isCycleRegular: regCycleRegular,
            approvedDatingMethod: regDatingMethod,
            previousPregnancies: pastPregnanciesList
          });
          actionsCount++;
        } else {
          await onUpdateDating(regDatingMethod, regLmp || undefined);
          actionsCount++;
        }
      }

      // 6. Confidential PMTCT Updates
      if (
        pmtctMotherCode !== (workspace.pmtct?.motherConfidentialCode || '') ||
        pmtctPartnerCode !== (workspace.pmtct?.partnerConfidentialCode || '') ||
        pmtctHivResult !== (workspace.pmtct?.hivTestResult || 'Negative') ||
        pmtctCd4 !== (workspace.pmtct?.cd4Count ? String(workspace.pmtct.cd4Count) : '') ||
        pmtctArtLinked !== (workspace.pmtct?.linkedToArt || false) ||
        pmtctRemarks !== (workspace.pmtct?.confidentialRemarks || '')
      ) {
        await onSavePmtct({
          id: workspace.pmtct?.id || 0,
          episodeId: workspace.episode.id,
          motherConfidentialCode: pmtctMotherCode,
          partnerConfidentialCode: pmtctPartnerCode,
          motherLetterCode: pmtctMotherLetter,
          partnerLetterCode: pmtctPartnerLetter,
          hivTested: pmtctHivTested,
          hivTestResult: pmtctHivResult,
          partnerHivResult: pmtctPartnerResult,
          cd4Count: pmtctCd4 ? Number(pmtctCd4) : undefined,
          whoClinicalStaging: pmtctStage,
          infantFeedingCounseling: pmtctInfantFeed,
          linkedToArt: pmtctArtLinked,
          confidentialRemarks: pmtctRemarks,
          updatedAt: new Date().toISOString(),
          isRestricted: false
        });
        actionsCount++;
      }

      // 7. Delivery Outcome & Episode Closure (if enabled on page)
      if (isDeliveryClosureActive && workspace.episode.status === 'Active') {
        await onCloseEpisode({
          episodeId: workspace.episode.id,
          deliveryDate: delDate,
          deliveryTime: `${delTime}:00`,
          deliveryPlace: delPlace,
          modeOfDelivery: delMode,
          pregnancyOutcomeType: delOutcome,
          numberOfBabies: delNumBabies,
          maternalOutcome: delMatOutcome,
          maternalComplications: delMatComp,
          baby1Outcome: delB1Outcome,
          baby1Sex: delB1Sex,
          baby1WeightGrams: Number(delB1Weight),
          baby1Apgar1: delB1Apgar1 ? Number(delB1Apgar1) : undefined,
          baby1Apgar5: delB1Apgar5 ? Number(delB1Apgar5) : undefined,
          deliveryRemarks: delRemarks,
          closureReason: 'Delivery'
        });
        setIsDeliveryClosureActive(false);
        actionsCount++;
      }

      if (actionsCount === 0) {
        alert('No changes or clinical findings were entered. Type new visit findings or test results, then click Save.');
      } else {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Error during master save:', err);
      alert(err?.message || 'Failed to save clinical record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReview = async () => {
    if (!reviewNotes.trim()) {
      alert('Please provide clinical justification notes for continuing the pregnancy beyond 43 weeks.');
      return;
    }
    try {
      setIsSubmitting(true);
      await onApproveOverdueReview(reviewNotes);
      setShowReviewModal(false);
      setReviewNotes('');
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const prevEnc = workspace.latestComparison?.previousEncounter;

  const calcBmi = () => {
    if (!encounterWeight || !encounterHeight) return null;
    const w = Number(encounterWeight);
    let h = Number(encounterHeight);
    if (h > 3) h = h / 100; // convert cm to meters
    if (w <= 0 || h <= 0) return null;
    const val = w / (h * h);
    let status = 'Normal';
    let badgeClass = 'badge-normal';
    if (val < 18.5) { status = 'Underweight'; badgeClass = 'badge-warning'; }
    else if (val >= 25 && val < 30) { status = 'Overweight'; badgeClass = 'badge-info'; }
    else if (val >= 30) { status = 'Obese'; badgeClass = 'badge-critical'; }
    return { val: val.toFixed(1), status, badgeClass };
  };
  const bmiInfo = calcBmi();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ========================================================================= */}
      {/* 1. PERSISTENT PATIENT & PREGNANCY CONTEXT HEADER WITH TOP MASTER SAVE     */}
      {/* ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          background: '#ffffff',
          borderBottom: '2px solid #0071e3',
          padding: '16px 22px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Patient Identification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0071e3 0%, #30b0c7 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.1rem',
                boxShadow: '0 3px 10px rgba(0, 113, 227, 0.3)'
              }}
            >
              {workspace.patient.fullName.charAt(0)}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  {workspace.patient.fullName}
                </span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(0, 113, 227, 0.1)', color: '#0071e3', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  MRN: {workspace.patient.mrn}
                </span>
                {workspace.patient.bloodGroup && (
                  <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    Blood: {workspace.patient.bloodGroup}
                  </span>
                )}
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    background: workspace.episode.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                    color: workspace.episode.status === 'Active' ? '#15803d' : '#64748b'
                  }}
                >
                  {workspace.episode.status}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <span>Age: <strong>{workspace.patient.ageYears} yrs</strong></span>
                <span>•</span>
                <span>Gravida: <strong>{regGravida}</strong>, Para: <strong>{regPara}</strong></span>
                <span>•</span>
                <span>Episode: <strong>{workspace.episode.episodeNumber}</strong></span>
                <span>•</span>
                <span>Phone: <strong>{workspace.patient.primaryPhone}</strong></span>
              </div>
            </div>
          </div>

          {/* Metric Badges & Top Master Save Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Gestational Age Badge */}
            <div style={{ background: 'rgba(0, 113, 227, 0.08)', border: '1px solid rgba(0, 113, 227, 0.25)', borderRadius: '10px', padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 700, color: '#0071e3' }}>
                Gestational Age
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0071e3', lineHeight: 1.15 }}>
                {workspace.episode.gestationalAgeFormatted}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                {workspace.episode.trimesterFormatted}
              </div>
            </div>

            {/* EDD Badge */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)' }}>
                EDD ({regDatingMethod})
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.15 }}>
                {new Date(workspace.episode.establishedEdd).toLocaleDateString()}
              </div>
              <div style={{ fontSize: '0.68rem', color: workspace.episode.isOverdueWarning ? '#dc2626' : 'var(--text-secondary)', fontWeight: workspace.episode.isOverdueWarning ? 700 : 400 }}>
                {workspace.episode.daysRemaining >= 0 ? `${workspace.episode.daysRemaining}d remaining` : `${Math.abs(workspace.episode.daysRemaining)}d overdue`}
              </div>
            </div>

            {/* TOP MASTER SAVE BUTTON */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleMasterSave}
              className="btn-primary"
              style={{
                padding: '10px 22px',
                fontSize: '0.875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#0071e3',
                boxShadow: '0 4px 12px rgba(0, 113, 227, 0.35)'
              }}
              title="Save all changes on this page (Encounter, Labs, Ultrasounds, PMTCT, Baseline)"
            >
              <Save size={16} />
              {isSubmitting ? 'Saving Clinical Record...' : 'Save Clinical Record (Top)'}
            </button>

            {/* Referral Print Button */}
            <button
              type="button"
              onClick={onPrintSummary}
              className="btn-secondary"
              style={{ padding: '8px 12px', fontSize: '0.8rem' }}
              title="Print ANC Clinical Summary for Referral"
            >
              <Printer size={15} />
              Referral Note
            </button>
          </div>
        </div>

        {/* Progress Bar towards EDD */}
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span>Progress to EDD ({workspace.episode.progressPercentage}%)</span>
            <span>{workspace.episode.daysRemaining >= 0 ? `${workspace.episode.daysRemaining} days remaining` : `${Math.abs(workspace.episode.daysRemaining)} days overdue`}</span>
          </div>
          <div style={{ height: '5px', borderRadius: '4px', background: '#e2e8f0', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, workspace.episode.progressPercentage)}%`,
                background: workspace.episode.isOverdueWarning ? 'linear-gradient(90deg, #f59e0b, #dc2626)' : 'linear-gradient(90deg, #30b0c7, #0071e3)',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>

        {/* Clinical Alerts Strip */}
        {workspace.episode.clinicalAlerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            {workspace.episode.clinicalAlerts.map((alt, i) => (
              <div
                key={i}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: alt.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${alt.severity === 'critical' ? '#fecaca' : '#fde68a'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: alt.severity === 'critical' ? '#991b1b' : '#92400e'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {alt.severity === 'critical' ? <ShieldAlert size={14} /> : <AlertTriangle size={14} />}
                  <span><strong>{alt.title}:</strong> {alt.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. STICKY QUICK JUMP IN-PAGE NAVIGATION BAR                               */}
      {/* ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          position: 'sticky',
          top: '0',
          zIndex: 35,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          padding: '8px 14px',
          gap: '8px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
          scrollbarWidth: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
            Quick Jump:
          </span>

          {showExtendedParams && (
            <button
              type="button"
              onClick={() => scrollToSection('sec-registration')}
              className="btn-secondary"
              style={{ padding: '5px 12px', fontSize: '0.76rem' }}
            >
              <Baby size={13} style={{ color: '#0071e3' }} /> 1. Registration & Baseline
            </button>
          )}

          <button
            type="button"
            onClick={() => scrollToSection('sec-followup')}
            className="btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.76rem', background: 'rgba(0, 113, 227, 0.08)', borderColor: '#0071e3', color: '#0071e3', fontWeight: 600 }}
          >
            <HeartPulse size={13} /> {showExtendedParams ? '2. Follow-up Encounter' : 'Follow-up Encounter'}
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('sec-history')}
            className="btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.76rem' }}
          >
            <Clock size={13} /> {showExtendedParams ? `3. Prior Visits (${workspace.encounters.length})` : `Prior Visits (${workspace.encounters.length})`}
          </button>

          {showExtendedParams && (
            <>
              <button
                type="button"
                onClick={() => scrollToSection('sec-ultrasounds')}
                className="btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.76rem' }}
              >
                <Activity size={13} /> 4. Ultrasounds ({workspace.ultrasounds.length})
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('sec-labs')}
                className="btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.76rem' }}
              >
                <FlaskConical size={13} /> 5. Labs ({workspace.labExaminations.length})
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('sec-pmtct')}
                className="btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.76rem' }}
              >
                <ShieldCheck size={13} /> 6. PMTCT / HIV
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('sec-outcome')}
                className="btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.76rem' }}
              >
                <CheckCircle2 size={13} /> 7. Delivery Outcome
              </button>
            </>
          )}
        </div>

        {/* Toggle Button in the sticky jump bar */}
        {!isNewRegistrationMode && workspace.episode.id > 0 && (
          <button
            type="button"
            onClick={() => setShowExtendedParams(!showExtendedParams)}
            className="btn-secondary"
            style={{
              padding: '5px 12px',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: showExtendedParams ? 'var(--text-muted)' : '#0071e3',
              borderColor: showExtendedParams ? 'var(--border-color)' : '#0071e3',
              background: showExtendedParams ? 'transparent' : 'rgba(0, 113, 227, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            {showExtendedParams ? (
              <>
                <EyeOff size={13} /> Hide Registration & Extended Parameters
              </>
            ) : (
              <>
                <Eye size={13} /> View Registration & Extended Parameters
              </>
            )}
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION 1: PREGNANCY REGISTRATION & BASELINE PROFILE (Hidden by default) */}
      {/* ========================================================================= */}
      {showExtendedParams && (
        <section id="sec-registration" className="glass-panel" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Baby size={18} style={{ color: '#0071e3' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  1. Pregnancy Registration & Baseline Obstetric Profile
                </h3>
                <span className={`badge ${workspace.episode.status === 'Active' ? 'badge-normal' : 'badge-info'}`}>
                  {isNewRegistrationMode ? 'New Pregnancy Registration' : 'Episode Baseline (Active)'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isNewRegistrationMode
                  ? 'Obstetric gravidity/parity, last menstrual period, approved dating source, baseline medical risks, and prior delivery records.'
                  : `Baseline: Gravida ${regGravida}, Para ${regPara} • LMP: ${regLmp || 'N/A'} • Dating: ${regDatingMethod} • ${pastPregnanciesList.length} Prior Deliveries recorded`}
              </p>
            </div>

            {!isNewRegistrationMode && workspace.episode.id > 0 && (
              <button
                type="button"
                onClick={() => setShowExtendedParams(false)}
                className="btn-secondary"
                style={{
                  fontSize: '0.75rem',
                  padding: '5px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  color: 'var(--text-muted)'
                }}
              >
                <EyeOff size={13} /> Hide Registration Parameters
              </button>
            )}
          </div>

          {/* Full Baseline Obstetric Input Surface */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Gravidity (Total Pregnancies)
              </label>
              <input
                type="number"
                min={1}
                value={regGravida}
                onChange={(e) => setRegGravida(Number(e.target.value))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Parity (Deliveries &gt; 28w)
              </label>
              <input
                type="number"
                min={0}
                value={regPara}
                onChange={(e) => setRegPara(Number(e.target.value))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Last Menstrual Period (LMP)
              </label>
              <input
                type="date"
                value={regLmp}
                onChange={(e) => setRegLmp(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Menstrual Cycle Regularity
              </label>
              <select
                value={regCycleRegular ? 'Regular' : 'Irregular'}
                onChange={(e) => setRegCycleRegular(e.target.value === 'Regular')}
              >
                <option value="Regular">Regular (28 - 30 days)</option>
                <option value="Irregular">Irregular</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Approved Dating Source
              </label>
              <select
                value={regDatingMethod}
                onChange={(e) => setRegDatingMethod(e.target.value)}
                style={{ fontWeight: 600, color: '#0071e3' }}
              >
                <option value="LMP">LMP (Naegele's Rule: LMP + 280d)</option>
                <option value="Ultrasound">First Trimester Ultrasound</option>
              </select>
            </div>
          </div>

          {/* Medical & Surgical History Toggles */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>
              Baseline Medical & Surgical Risk Evaluation:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {[
                { label: 'Diabetes Mellitus', state: histDiabetes, set: setHistDiabetes },
                { label: 'Chronic Hypertension', state: histHypertension, set: setHistHypertension },
                { label: 'Renal Disease', state: histRenal, set: setHistRenal },
                { label: 'Tuberculosis (TB)', state: histTb, set: setHistTb },
                { label: 'Drug Allergy', state: histAllergy, set: setHistAllergy },
                { label: 'Past Surgeries / C-Section', state: histSurgery, set: setHistSurgery }
              ].map((item, idx) => (
                <div key={idx} style={{ padding: '8px 12px', background: '#fbfbfd', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <span style={{ fontWeight: 600 }}>{item.label}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['No', 'Yes', 'Unknown'] as const).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => item.set({ ...item.state, status: opt })}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: item.state.status === opt ? '1px solid #0071e3' : '1px solid #d2d2d7',
                          background: item.state.status === opt ? '#0071e3' : '#ffffff',
                          color: item.state.status === opt ? '#ffffff' : 'var(--text-secondary)',
                          fontSize: '0.7rem',
                          fontWeight: item.state.status === opt ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prior Deliveries Table & In-line Quick Add */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Previous Pregnancy History ({pastPregnanciesList.length} recorded):
              </span>
            </div>

            {pastPregnanciesList.length === 0 ? (
              <div style={{ padding: '10px 14px', background: '#fbfbfd', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                No prior pregnancies recorded (Primigravida / First pregnancy). Use the row below to document any past deliveries.
              </div>
            ) : (
              <div className="table-responsive" style={{ margin: 0 }}>
                <table className="cms-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Year</th>
                      <th>Delivery Mode</th>
                      <th>GA</th>
                      <th>Outcome</th>
                      <th>Birth Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastPregnanciesList.map((p, i) => (
                      <tr key={p.id || i}>
                        <td>#{p.pregnancyNumber || i + 1}</td>
                        <td>{p.birthYear || '-'}</td>
                        <td>{p.modeOfDelivery || 'SVD'}</td>
                        <td>{p.gestationalAgeWeeks ? `${p.gestationalAgeWeeks}w` : '-'}</td>
                        <td><span className="badge badge-normal">{p.deliveryOutcome || 'Live'}</span></td>
                        <td>{p.birthWeightGrams ? `${p.birthWeightGrams} g` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* In-line Quick Add Row for Past Deliveries (On Page, No Dialog) */}
            <div
              style={{
                marginTop: '8px',
                padding: '10px 14px',
                background: '#f8fafc',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                fontSize: '0.78rem'
              }}
            >
              <span style={{ fontWeight: 700, color: '#0071e3' }}>+ Add Past Delivery In-Line:</span>
              <input
                type="number"
                placeholder="Birth Year"
                value={inlinePrevYear}
                onChange={(e) => setInlinePrevYear(e.target.value)}
                style={{ width: '90px' }}
              />
              <select
                value={inlinePrevMode}
                onChange={(e) => setInlinePrevMode(e.target.value)}
                style={{ width: '160px' }}
              >
                <option value="Spontaneous Vaginal Delivery (SVD)">SVD</option>
                <option value="Cesarean Section">Cesarean Section</option>
                <option value="Vacuum Extraction">Vacuum</option>
              </select>
              <input
                type="number"
                placeholder="GA Weeks"
                value={inlinePrevWeeks}
                onChange={(e) => setInlinePrevWeeks(e.target.value)}
                style={{ width: '85px' }}
              />
              <select
                value={inlinePrevOutcome}
                onChange={(e) => setInlinePrevOutcome(e.target.value)}
                style={{ width: '110px' }}
              >
                <option value="Live Birth">Live Birth</option>
                <option value="Stillbirth">Stillbirth</option>
                <option value="Abortion">Abortion</option>
              </select>
              <input
                type="number"
                placeholder="Weight (g)"
                value={inlinePrevWeight}
                onChange={(e) => setInlinePrevWeight(e.target.value)}
                style={{ width: '90px' }}
              />
              <button
                type="button"
                onClick={handleAddPastPregnancyInline}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
              >
                Add Row
              </button>
            </div>

            {!isNewRegistrationMode && workspace.episode.id > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowExtendedParams(false)}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBaselineOnly}
                  className="btn-primary"
                  disabled={isSubmitting}
                  style={{ padding: '6px 16px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={13} /> {isSubmitting ? 'Saving...' : 'Save Baseline Corrections'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    )}

      {/* ========================================================================= */}
      {/* 4. SECTION 2: CURRENT FOLLOW-UP ENCOUNTER DOCUMENTATION                   */}
      {/* ========================================================================= */}
      <section id="sec-followup" className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartPulse size={18} style={{ color: '#0071e3' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                2. Current Follow-up Encounter & Side-by-Side Comparison
              </h3>
              <span className="badge badge-info">
                Visit #{workspace.encounters.length + 1}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Side-by-side longitudinal tracking comparing previous findings against today's encounter (GA: <strong>{workspace.episode.gestationalAgeFormatted}</strong>).
            </p>
          </div>
        </div>

        {/* Side-by-Side Clinical Parameters Table */}
        <div className="table-responsive" style={{ margin: 0 }}>
          <table className="cms-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Clinical Parameter</th>
                <th style={{ width: '32%', background: '#f5f5f7' }}>
                  Previous Visit {prevEnc ? `(#${prevEnc.encounterNumber} • ${new Date(prevEnc.encounterDate).toLocaleDateString()})` : '(Baseline)'}
                </th>
                <th style={{ width: '46%', background: 'rgba(0, 113, 227, 0.04)', color: '#0071e3' }}>
                  Current Documentation (Today • {new Date().toLocaleDateString()})
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Gestational Age */}
              <tr>
                <td><strong>Gestational Age</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc ? prevEnc.gestationalAgeFormatted : 'Initial baseline'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <strong style={{ color: '#0071e3' }}>{workspace.episode.gestationalAgeFormatted}</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    ({workspace.episode.trimesterFormatted})
                  </span>
                </td>
              </tr>

              {/* Maternal Weight & Height (Anthropometrics from Video) */}
              <tr>
                <td><strong>Maternal Weight & Height</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc?.weight ? `${prevEnc.weight} kg` : '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Weight (kg)"
                        value={encounterWeight}
                        onChange={(e) => setEncounterWeight(e.target.value)}
                        style={{ width: '110px' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>kg</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Height (m/cm)"
                        value={encounterHeight}
                        onChange={(e) => setEncounterHeight(e.target.value)}
                        style={{ width: '110px' }}
                      />
                    </div>

                    {bmiInfo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0071e3' }}>
                          BMI: {bmiInfo.val}
                        </span>
                        <span className={`badge ${bmiInfo.badgeClass}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          {bmiInfo.status}
                        </span>
                      </div>
                    )}

                    {encounterWeight && prevEnc?.weight && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: Number(encounterWeight) >= prevEnc.weight ? '#16a34a' : '#d97706' }}>
                        Δ {(Number(encounterWeight) - prevEnc.weight).toFixed(1)} kg
                      </span>
                    )}
                  </div>
                </td>
              </tr>

              {/* Blood Pressure */}
              <tr>
                <td><strong>Blood Pressure (mmHg) *</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc?.systolicBp ? `${prevEnc.systolicBp} / ${prevEnc.diastolicBp}` : '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      placeholder="Systolic"
                      value={encounterSysBp}
                      onChange={(e) => setEncounterSysBp(e.target.value)}
                      style={{ width: '90px' }}
                    />
                    <span>/</span>
                    <input
                      type="number"
                      placeholder="Diastolic"
                      value={encounterDiaBp}
                      onChange={(e) => setEncounterDiaBp(e.target.value)}
                      style={{ width: '90px' }}
                    />
                    {encounterSysBp && encounterDiaBp && (
                      Number(encounterSysBp) >= 140 || Number(encounterDiaBp) >= 90 ? (
                        <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                          <AlertTriangle size={12} /> Hypertension Warning
                        </span>
                      ) : (
                        <span className="badge badge-normal" style={{ fontSize: '0.7rem' }}>
                          Normal
                        </span>
                      )
                    )}
                  </div>
                </td>
              </tr>

              {/* Vital Signs: Pulse Rate, Respiratory Rate, Body Temperature (from Video) */}
              <tr>
                <td><strong>PR, RR & Temperature</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc ? `PR: ${prevEnc.pulseRate || '-'} • RR: ${prevEnc.respiratoryRate || '-'} • Temp: ${prevEnc.temperature || '-'}°C` : '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PR:</span>
                      <input
                        type="number"
                        placeholder="bpm (60-100)"
                        value={encounterPulseRate}
                        onChange={(e) => setEncounterPulseRate(e.target.value)}
                        style={{ width: '95px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>RR:</span>
                      <input
                        type="number"
                        placeholder="/min (12-20)"
                        value={encounterRespRate}
                        onChange={(e) => setEncounterRespRate(e.target.value)}
                        style={{ width: '95px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Temp:</span>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="°C (36.5)"
                        value={encounterTemp}
                        onChange={(e) => setEncounterTemp(e.target.value)}
                        style={{ width: '90px' }}
                      />
                    </div>
                  </div>
                </td>
              </tr>

              {/* Fundal Height */}
              <tr>
                <td><strong>Fundal Height (cm)</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc?.fundalHeight ? `${prevEnc.fundalHeight} cm` : '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="e.g. 32.0"
                      value={encounterFundalHeight}
                      onChange={(e) => setEncounterFundalHeight(e.target.value)}
                      style={{ width: '130px' }}
                    />
                    {encounterFundalHeight && prevEnc?.fundalHeight && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0071e3' }}>
                        Δ {(Number(encounterFundalHeight) - prevEnc.fundalHeight).toFixed(1)} cm
                      </span>
                    )}
                  </div>
                </td>
              </tr>

              {/* Fetal Heart Rate */}
              <tr>
                <td><strong>Fetal Heart Rate (bpm)</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc?.fetalHeartRate ? `${prevEnc.fetalHeartRate} bpm` : '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <input
                    type="number"
                    placeholder="e.g. 142 (110 - 160)"
                    value={encounterFhr}
                    onChange={(e) => setEncounterFhr(e.target.value)}
                    style={{ width: '150px' }}
                  />
                </td>
              </tr>

              {/* Fetal Presentation & Movement */}
              <tr>
                <td><strong>Presentation & Movement</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc ? `${prevEnc.fetalPresentation || 'Cephalic'} • ${prevEnc.fetalMovement || 'Normal'}` : '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      value={encounterPresentation}
                      onChange={(e) => setEncounterPresentation(e.target.value)}
                      style={{ width: '130px' }}
                    >
                      <option value="Cephalic">Cephalic</option>
                      <option value="Breech">Breech</option>
                      <option value="Transverse">Transverse</option>
                    </select>

                    <select
                      value={encounterFetalMovement}
                      onChange={(e) => setEncounterFetalMovement(e.target.value)}
                      style={{ width: '130px' }}
                    >
                      <option value="Normal">Movement: Normal</option>
                      <option value="Decreased">Movement: Decreased</option>
                      <option value="Absent">Movement: Absent</option>
                    </select>
                  </div>
                </td>
              </tr>

              {/* Anemia & Edema */}
              <tr>
                <td><strong>Anemia & Edema</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc ? `Anemia: ${prevEnc.anemia || 'None'} • Edema: ${prevEnc.edema || 'None'}` : '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      value={encounterAnemia}
                      onChange={(e) => setEncounterAnemia(e.target.value)}
                      style={{ width: '130px' }}
                    >
                      <option value="None">Anemia: None</option>
                      <option value="Mild">Anemia: Mild</option>
                      <option value="Moderate">Anemia: Moderate</option>
                      <option value="Severe">Anemia: Severe</option>
                    </select>

                    <select
                      value={encounterEdema}
                      onChange={(e) => setEncounterEdema(e.target.value)}
                      style={{ width: '130px' }}
                    >
                      <option value="None">Edema: None</option>
                      <option value="Mild (+1)">Edema: Mild (+1)</option>
                      <option value="Moderate (+2)">Edema: Moderate (+2)</option>
                      <option value="Severe (+3)">Edema: Severe (+3)</option>
                    </select>
                  </div>
                </td>
              </tr>

              {/* Supplementation */}
              <tr>
                <td><strong>Iron & Tetanus</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc ? `Iron: ${prevEnc.ironSupplementation || 'Given'} • TT: ${prevEnc.tetanusVaccination || 'TT1'}` : '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      value={encounterIron}
                      onChange={(e) => setEncounterIron(e.target.value)}
                      style={{ width: '140px' }}
                    >
                      <option value="Prescribed">Iron/Folate: Prescribed</option>
                      <option value="Dispensed">Iron/Folate: Dispensed</option>
                      <option value="Not Given">Not Given</option>
                    </select>

                    <select
                      value={encounterTetanus}
                      onChange={(e) => setEncounterTetanus(e.target.value)}
                      style={{ width: '140px' }}
                    >
                      <option value="TT1 Given">Tetanus: TT1 Given</option>
                      <option value="TT2 Given">Tetanus: TT2 Given</option>
                      <option value="TT3 Given">Tetanus: TT3 Given</option>
                      <option value="Completed">Tetanus: Completed</option>
                    </select>
                  </div>
                </td>
              </tr>

              {/* Lab Result Remarks (from Video Followup Parameters) */}
              <tr>
                <td><strong>Lab Result Remarks</strong></td>
                <td style={{ background: '#f9f9fb' }}>
                  {prevEnc?.labResultRemarks || '-'}
                </td>
                <td style={{ background: 'rgba(0, 113, 227, 0.02)' }}>
                  <input
                    type="text"
                    placeholder="Clinical remarks on lab tests (e.g. Hb 11.5 normal, Urinalysis protein negative)"
                    value={encounterLabRemarks}
                    onChange={(e) => setEncounterLabRemarks(e.target.value)}
                    style={{ width: '100%', fontSize: '0.78rem' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Obstetric Danger Signs Assessment Chips */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            Obstetric Danger Signs Assessment (Select any present today):
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {DANGER_SIGNS_LIST.map((sign, idx) => {
              const isChecked = encounterDangerSigns.includes(sign);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleToggleDangerSign(sign)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: isChecked ? '1px solid #dc2626' : '1px solid var(--border-color)',
                    background: isChecked ? '#fef2f2' : '#ffffff',
                    color: isChecked ? '#dc2626' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: isChecked ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isChecked ? <ShieldAlert size={13} color="#dc2626" /> : null}
                  {sign}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clinical SOAP Notes & Management Plan */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Clinical Assessment & Observations</label>
            <textarea
              rows={3}
              placeholder="Physical findings, fetal growth adequacy, maternal wellbeing..."
              value={encounterAssessment}
              onChange={(e) => setEncounterAssessment(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Management Plan & Interventions</label>
            <textarea
              rows={3}
              placeholder="Medications prescribed, diagnostic orders, dietary counsel, danger signs reviewed..."
              value={encounterPlan}
              onChange={(e) => setEncounterPlan(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>H&P & General Notes</label>
            <textarea
              rows={3}
              placeholder="Subjective complaints, fetal movements, nutritional counseling..."
              value={encounterClinicalNotes}
              onChange={(e) => setEncounterClinicalNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Diagnoses & In-line Multi-Coding (On Page, No Dialog) */}
        <div style={{ background: '#fbfbfd', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Clinical Diagnoses & Multi-Coding ({workspace.diagnoses.length}):
            </span>
          </div>

          {/* Currently attached diagnoses */}
          {workspace.diagnoses.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {workspace.diagnoses.map(d => (
                <div key={d.id} style={{ padding: '4px 10px', background: '#ffffff', border: '1px solid #d2d2d7', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <strong>{d.description}</strong>
                  {d.icdCode && <span style={{ color: '#0071e3', marginLeft: '6px', fontFamily: 'monospace' }}>[{d.icdCode}]</span>}
                </div>
              ))}
            </div>
          )}

          {/* In-Line Diagnosis Entry Strip (On Page) */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0071e3' }}>+ Attach Diagnosis In-Line:</span>
            <input
              type="text"
              placeholder="Diagnosis Description (e.g. Mild Preeclampsia, Gestational DM)"
              value={inlineDiagDesc}
              onChange={(e) => setInlineDiagDesc(e.target.value)}
              style={{ flex: 1, minWidth: '220px', fontSize: '0.75rem' }}
            />
            <input
              type="text"
              placeholder="ICD-10 Code"
              value={inlineDiagIcd}
              onChange={(e) => setInlineDiagIcd(e.target.value)}
              style={{ width: '100px', fontSize: '0.75rem' }}
            />
            <input
              type="text"
              placeholder="DHIS2 Code"
              value={inlineDiagDhis}
              onChange={(e) => setInlineDiagDhis(e.target.value)}
              style={{ width: '100px', fontSize: '0.75rem' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              (Included in Master Save)
            </span>
          </div>
        </div>

        {/* Next Visit Scheduling & Draft Mode */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Next ANC Visit:</span>
              <input
                type="date"
                value={encounterNextVisitDate}
                onChange={(e) => setEncounterNextVisitDate(e.target.value)}
                style={{ width: 'auto', padding: '6px 10px', fontSize: '0.75rem' }}
              />
            </div>
            <input
              type="text"
              placeholder="Appointment remarks (e.g. 4-week routine review, repeat labs)"
              value={encounterAppointmentRemarks}
              onChange={(e) => setEncounterAppointmentRemarks(e.target.value)}
              style={{ flex: 1, minWidth: '200px', fontSize: '0.75rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isDraftMode}
                onChange={(e) => setIsDraftMode(e.target.checked)}
              />
              <span>Save Encounter as In-Progress Draft</span>
            </label>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SECTION 3: LONGITUDINAL ENCOUNTER TIMELINE                             */}
      {/* ========================================================================= */}
      <section id="sec-history" className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: '#0071e3' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                3. Longitudinal Encounter Timeline & Clinical History
              </h3>
              <span className="badge badge-info">{workspace.encounters.length} Encounters</span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Chronological log of all finalized and draft clinical encounters recorded under this pregnancy episode.
            </p>
          </div>
        </div>

        {workspace.encounters.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No prior follow-up encounters recorded yet. Document today's visit using Section 2 above and click Save.
          </div>
        ) : (
          <div className="table-responsive" style={{ margin: 0 }}>
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Visit #</th>
                  <th>Visit Code</th>
                  <th>Encounter Date</th>
                  <th>Gestational Age</th>
                  <th>Weight</th>
                  <th>BP</th>
                  <th>Fundal Height</th>
                  <th>FHR</th>
                  <th>Attending Doctor</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {workspace.encounters.map(enc => (
                  <tr key={enc.id}>
                    <td>#{enc.encounterNumber}</td>
                    <td><strong style={{ fontFamily: 'monospace' }}>{enc.visitCode}</strong></td>
                    <td>{new Date(enc.encounterDate).toLocaleDateString()}</td>
                    <td><span className="badge badge-info">{enc.gestationalAgeFormatted}</span></td>
                    <td>{enc.weight ? `${enc.weight} kg` : '-'}</td>
                    <td>
                      <strong>{enc.systolicBp ? `${enc.systolicBp}/${enc.diastolicBp}` : '-'}</strong>
                    </td>
                    <td>{enc.fundalHeight ? `${enc.fundalHeight} cm` : '-'}</td>
                    <td>{enc.fetalHeartRate ? `${enc.fetalHeartRate} bpm` : '-'}</td>
                    <td>{enc.attendingDoctorName}</td>
                    <td>
                      <span className={`badge ${enc.isDraft ? 'badge-warning' : 'badge-normal'}`}>
                        {enc.isDraft ? 'Draft' : 'Finalized'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {enc.isDraft && (
                        <button
                          type="button"
                          onClick={() => onFinalizeEncounter(enc.id)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          <Lock size={12} /> Finalize
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Registration Baseline & Extended Parameters Toggle Banner (When Hidden) */}
      {!showExtendedParams && (
        <div
          style={{
            margin: '20px 0 12px',
            padding: '18px 24px',
            background: 'rgba(0, 113, 227, 0.04)',
            border: '1px dashed #0071e3',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#0071e3" />
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                Baseline Registration & Extended Specialized Care Parameters
              </strong>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Registration baseline (LMP, Gravida/Para, prior deliveries), biometric ultrasound scans, lab investigations, PMTCT HIV care, and delivery closure.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowExtendedParams(true);
              setTimeout(() => scrollToSection('sec-registration'), 80);
            }}
            className="btn-secondary"
            style={{
              padding: '9px 18px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#0071e3',
              borderColor: '#0071e3',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0, 113, 227, 0.08)'
            }}
          >
            <Eye size={14} />
            View Registration & Extended Parameters
          </button>
        </div>
      )}

      {showExtendedParams && (
        <>
          {/* ========================================================================= */}
          {/* 6. SECTION 4: BIOMETRIC ULTRASOUNDS (IN-LINE ON PAGE, NO DIALOG)          */}
          {/* ========================================================================= */}
          <section id="sec-ultrasounds" className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: '#0071e3' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                4. Repeatable Biometric Ultrasound Scans ({workspace.ultrasounds.length})
              </h3>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Obstetric sonography, biometry, placental localization, and amniotic fluid index.
            </p>
          </div>
        </div>

        {/* Existing Ultrasounds Table */}
        {workspace.ultrasounds.length > 0 && (
          <div className="table-responsive" style={{ margin: 0 }}>
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Scan Date</th>
                  <th>GA at Scan</th>
                  <th>EDD by Scan</th>
                  <th>Presentation</th>
                  <th>Placental Site</th>
                  <th>Amniotic Fluid</th>
                  <th>FHR</th>
                  <th>Estimated Wt</th>
                </tr>
              </thead>
              <tbody>
                {workspace.ultrasounds.map(u => (
                  <tr key={u.id}>
                    <td>{new Date(u.ultrasoundDate).toLocaleDateString()}</td>
                    <td><strong>{u.gestationalAgeFormatted}</strong></td>
                    <td>{u.eddByUltrasound ? new Date(u.eddByUltrasound).toLocaleDateString() : '-'}</td>
                    <td>{u.presentation || 'Cephalic'}</td>
                    <td>{u.placentalLocation || 'Fundal/Posterior'}</td>
                    <td>{u.amnioticFluid || 'Normal (AFI 14cm)'}</td>
                    <td>{u.fetalHeartRate ? `${u.fetalHeartRate} bpm` : '-'}</td>
                    <td>{u.estimatedFetalWeight ? `${u.estimatedFetalWeight} g` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* In-Line Ultrasound Entry Form on the Page (No Dialog) */}
        <div style={{ background: '#f8fafc', border: '1px dashed #0071e3', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#0071e3" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0071e3' }}>
              Document Biometric Ultrasound (If Performed Today — Saved with Master Save):
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', fontSize: '0.78rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Scan Date</label>
              <input type="date" value={inlineUsDate} onChange={(e) => setInlineUsDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>GA Weeks</label>
              <input type="number" value={inlineUsWeeks} onChange={(e) => setInlineUsWeeks(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>GA Days</label>
              <input type="number" value={inlineUsDays} onChange={(e) => setInlineUsDays(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Presentation</label>
              <select value={inlineUsPres} onChange={(e) => setInlineUsPres(e.target.value)}>
                <option value="Cephalic">Cephalic</option>
                <option value="Breech">Breech</option>
                <option value="Transverse">Transverse</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Placental Site</label>
              <input type="text" value={inlineUsPlacenta} onChange={(e) => setInlineUsPlacenta(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Amniotic Fluid</label>
              <input type="text" value={inlineUsFluid} onChange={(e) => setInlineUsFluid(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>FHR (bpm)</label>
              <input type="number" placeholder="e.g. 140" value={inlineUsFhr} onChange={(e) => setInlineUsFhr(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Est. Weight (g)</label>
              <input type="number" placeholder="e.g. 1950" value={inlineUsWeight} onChange={(e) => setInlineUsWeight(e.target.value)} />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. SECTION 5: LABORATORY & INVESTIGATIONS (IN-LINE ON PAGE, NO DIALOG)    */}
      {/* ========================================================================= */}
      <section id="sec-labs" className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FlaskConical size={18} style={{ color: '#0071e3' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                5. Antenatal Laboratory & Diagnostic Tracking ({workspace.labExaminations.length})
              </h3>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Standard antenatal panel (Hemoglobin, Blood Group, Syphilis/RPR, HIV Rapid, Urinalysis, Hepatitis B, Glucose).
            </p>
          </div>
        </div>

        {/* Existing Labs Table */}
        {workspace.labExaminations.length > 0 && (
          <div className="table-responsive" style={{ margin: 0 }}>
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Test Date</th>
                  <th>Investigation</th>
                  <th>Result</th>
                  <th>Reference Range</th>
                  <th>Status</th>
                  <th>Findings</th>
                </tr>
              </thead>
              <tbody>
                {workspace.labExaminations.map(l => (
                  <tr key={l.id}>
                    <td>{new Date(l.testDate).toLocaleDateString()}</td>
                    <td><strong>{l.testType}</strong></td>
                    <td><strong style={{ color: l.isAbnormal ? '#dc2626' : 'var(--text-main)' }}>{l.resultValue} {l.unit}</strong></td>
                    <td>{l.referenceRange || '-'}</td>
                    <td><span className="badge badge-normal">{l.status}</span></td>
                    <td>
                      {l.isAbnormal ? (
                        <span className="badge badge-critical">Abnormal</span>
                      ) : (
                        <span className="badge badge-normal">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* In-Line Laboratory Entry Form on the Page (No Dialog) */}
        <div style={{ background: '#f8fafc', border: '1px dashed #0071e3', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlaskConical size={16} color="#0071e3" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0071e3' }}>
              Document Laboratory Test Result (If Performed Today — Saved with Master Save):
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.78rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Test Type</label>
              <select value={inlineLabType} onChange={(e) => setInlineLabType(e.target.value)}>
                <option value="Hemoglobin (Hb)">Hemoglobin (Hb)</option>
                <option value="Blood Group & Rh">Blood Group & Rh</option>
                <option value="RPR / VDRL (Syphilis)">RPR / VDRL (Syphilis)</option>
                <option value="HIV Rapid Diagnostic Test">HIV Rapid Diagnostic Test</option>
                <option value="Urinalysis (Protein/Glucose)">Urinalysis (Protein/Glucose)</option>
                <option value="Hepatitis B Surface Antigen (HBsAg)">Hepatitis B (HBsAg)</option>
                <option value="Random Blood Sugar (RBS)">Random Blood Sugar (RBS)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Result Value</label>
              <input type="text" placeholder="e.g. 12.4" value={inlineLabValue} onChange={(e) => setInlineLabValue(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Unit</label>
              <input type="text" placeholder="e.g. g/dL" value={inlineLabUnit} onChange={(e) => setInlineLabUnit(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Reference Range</label>
              <input type="text" placeholder="e.g. 11.0 - 15.0" value={inlineLabRef} onChange={(e) => setInlineLabRef(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={inlineLabAbnormal} onChange={(e) => setInlineLabAbnormal(e.target.checked)} />
                <span style={{ fontWeight: 600, color: inlineLabAbnormal ? '#dc2626' : 'var(--text-secondary)' }}>
                  Flag as Abnormal Finding
                </span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. SECTION 6: CONFIDENTIAL PMTCT & HIV CARE (IN-LINE ON PAGE)             */}
      {/* ========================================================================= */}
      <section id="sec-pmtct" className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} style={{ color: '#0071e3' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                6. Confidential PMTCT & HIV Maternal Care
              </h3>
              <span className="badge badge-warning">Confidential Record</span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Prevention of Mother-to-Child Transmission, couple voluntary counseling, ART linkage, and CD4 staging.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPmtctVisible(!isPmtctVisible)}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            {isPmtctVisible ? <EyeOff size={13} /> : <Eye size={13} />}
            {isPmtctVisible ? 'Mask Sensitive Data' : 'Reveal Sensitive Data'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', filter: isPmtctVisible ? 'none' : 'blur(4px)', transition: 'filter 0.2s ease' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Maternal Confidential Code</label>
            <input
              type="text"
              value={pmtctMotherCode}
              onChange={(e) => setPmtctMotherCode(e.target.value)}
              placeholder="e.g. CONF-M-270606"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Partner Confidential Code</label>
            <input
              type="text"
              value={pmtctPartnerCode}
              onChange={(e) => setPmtctPartnerCode(e.target.value)}
              placeholder="e.g. CONF-P-99120"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Maternal HIV Test Result</label>
            <select value={pmtctHivResult} onChange={(e) => setPmtctHivResult(e.target.value)}>
              <option value="Negative">Negative</option>
              <option value="Positive / Reactive">Positive / Reactive</option>
              <option value="Declined">Declined</option>
              <option value="Known Positive on ART">Known Positive on ART</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Partner HIV Test Result</label>
            <select value={pmtctPartnerResult} onChange={(e) => setPmtctPartnerResult(e.target.value)}>
              <option value="Negative">Negative</option>
              <option value="Positive">Positive</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>CD4 Count (cells/mm³)</label>
            <input
              type="number"
              value={pmtctCd4}
              onChange={(e) => setPmtctCd4(e.target.value)}
              placeholder="e.g. 520"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Infant Feeding Counseling</label>
            <select value={pmtctInfantFeed} onChange={(e) => setPmtctInfantFeed(e.target.value)}>
              <option value="Exclusive Breastfeeding">Exclusive Breastfeeding</option>
              <option value="Exclusive Replacement Feeding">Exclusive Replacement Feeding</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', filter: isPmtctVisible ? 'none' : 'blur(4px)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={pmtctArtLinked}
              onChange={(e) => setPmtctArtLinked(e.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>Linked to Antiretroviral Therapy (ART) Clinic</span>
          </label>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. SECTION 7: PREGNANCY DELIVERY OUTCOME (IN-LINE ON PAGE, NO DIALOG)     */}
      {/* ========================================================================= */}
      <section id="sec-outcome" className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                7. Pregnancy Delivery Outcome & Formal Episode Closure
              </h3>
              <span className={`badge ${workspace.outcome ? 'badge-normal' : 'badge-info'}`}>
                {workspace.outcome ? 'Episode Formally Closed' : 'Active Pregnancy Episode'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Documents final delivery findings, newborn status, maternal recovery, and closes the clinical pregnancy episode.
            </p>
          </div>
        </div>

        {/* Closed Episode Outcome Display */}
        {workspace.outcome ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', background: '#f9f9fb', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
            <div>Delivery Date: <strong>{new Date(workspace.outcome.deliveryDate).toLocaleDateString()} {workspace.outcome.deliveryTimeFormatted}</strong></div>
            <div>Mode of Delivery: <strong>{workspace.outcome.modeOfDelivery}</strong></div>
            <div>Place: <strong>{workspace.outcome.deliveryPlace}</strong></div>
            <div>Outcome: <strong style={{ color: '#16a34a' }}>{workspace.outcome.pregnancyOutcomeType}</strong></div>
            <div>Maternal Outcome: <strong>{workspace.outcome.maternalOutcome}</strong></div>
            <div>Baby Sex / Weight: <strong>{workspace.outcome.baby1Sex} • {workspace.outcome.baby1WeightGrams} g</strong></div>
            <div>APGAR 1m / 5m: <strong>{workspace.outcome.baby1Apgar1 ?? 'N/A'} / {workspace.outcome.baby1Apgar5 ?? 'N/A'}</strong></div>
            <div>Closing Clinician: <strong>{workspace.outcome.closingClinicianName}</strong></div>
          </div>
        ) : (
          /* Active Episode: In-line Delivery Closure Form Directly on the Page */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: isDeliveryClosureActive ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isDeliveryClosureActive ? '#86efac' : 'var(--border-color)'}`, borderRadius: '8px' }}>
              <input
                type="checkbox"
                id="toggleDeliveryClosure"
                checked={isDeliveryClosureActive}
                onChange={(e) => setIsDeliveryClosureActive(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="toggleDeliveryClosure" style={{ fontSize: '0.82rem', fontWeight: 700, color: isDeliveryClosureActive ? '#15803d' : 'var(--text-main)', cursor: 'pointer' }}>
                Patient Has Delivered — Record Delivery Outcome & Formally Close Episode (On This Page)
              </label>
            </div>

            {isDeliveryClosureActive && (
              <div style={{ background: '#ffffff', border: '1px solid #86efac', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.78rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Delivery Date</label>
                    <input type="date" value={delDate} onChange={(e) => setDelDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Delivery Time</label>
                    <input type="time" value={delTime} onChange={(e) => setDelTime(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Delivery Place</label>
                    <input type="text" value={delPlace} onChange={(e) => setDelPlace(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Mode of Delivery</label>
                    <select value={delMode} onChange={(e) => setDelMode(e.target.value)}>
                      <option value="Spontaneous Vaginal Delivery (SVD)">Spontaneous Vaginal Delivery (SVD)</option>
                      <option value="Emergency Cesarean Section">Emergency Cesarean Section</option>
                      <option value="Elective Cesarean Section">Elective Cesarean Section</option>
                      <option value="Assisted Vacuum Delivery">Assisted Vacuum Delivery</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Baby Outcome</label>
                    <select value={delB1Outcome} onChange={(e) => setDelB1Outcome(e.target.value)}>
                      <option value="Alive & Healthy">Alive & Healthy</option>
                      <option value="NICU Admission">NICU Admission</option>
                      <option value="Stillbirth">Stillbirth</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Baby Birth Weight (g)</label>
                    <input type="number" value={delB1Weight} onChange={(e) => setDelB1Weight(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>APGAR 1m / 5m</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input type="number" placeholder="1m" value={delB1Apgar1} onChange={(e) => setDelB1Apgar1(e.target.value)} style={{ width: '60px' }} />
                      <input type="number" placeholder="5m" value={delB1Apgar5} onChange={(e) => setDelB1Apgar5(e.target.value)} style={{ width: '60px' }} />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '4px' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px', fontSize: '0.78rem' }}>Delivery Remarks & Perineal Status</label>
                  <textarea
                    rows={2}
                    value={delRemarks}
                    onChange={(e) => setDelRemarks(e.target.value)}
                    placeholder="Maternal condition, perineal tears, placenta completeness, infant vitals..."
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Collapsible Hide Button for Extended Parameters */}
      {!isNewRegistrationMode && workspace.episode.id > 0 && (
        <div style={{ textAlign: 'center', margin: '14px 0 6px' }}>
          <button
            type="button"
            onClick={() => {
              setShowExtendedParams(false);
              scrollToSection('sec-followup');
            }}
            className="btn-secondary"
            style={{ padding: '8px 20px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}
          >
            <EyeOff size={14} style={{ marginRight: '6px' }} />
            Hide Registration & Extended Parameters (Follow-up Only)
          </button>
        </div>
      )}
    </>
  )}

      {/* ========================================================================= */}
      {/* 10. BOTTOM MASTER SAVE ACTION BAR (ONE SAVE BUTTON ON BOTTOM)             */}
      {/* ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          borderTop: '2px solid #0071e3',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
          marginBottom: '30px'
        }}
      >
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleMasterSave}
          className="btn-primary"
          style={{
            padding: '14px 44px',
            fontSize: '1rem',
            fontWeight: 800,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#0071e3',
            boxShadow: '0 6px 18px rgba(0, 113, 227, 0.4)'
          }}
        >
          <Save size={20} />
          {isSubmitting ? 'Saving All Clinical Data...' : 'Save Clinical Record (Bottom)'}
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Saves current follow-up visit, in-line ultrasound scans, in-line lab investigations, PMTCT updates, and baseline data in one unified operation.
        </span>
      </div>

      {/* Overdue Review Modal (Preserved for Clinical Authorization Safeguard) */}
      {showReviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-panel" style={{ background: '#fff', width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <ShieldAlert size={20} color="#dc2626" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#991b1b' }}>
                43-Week Authorized Review Approval
              </h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#b91c1c', margin: '0 0 12px' }}>
              Hospital policy requires formal documented clinician authorization to allow pregnancy to continue beyond 43 weeks without induction/closure.
            </p>
            <textarea
              rows={3}
              placeholder="Clinical justification, Bishop score, biophysical profile findings, maternal consent..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #f87171', fontSize: '0.8rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button type="button" onClick={() => setShowReviewModal(false)} className="btn-secondary">Cancel</button>
              <button type="button" disabled={isSubmitting} onClick={handleApproveReview} className="btn-primary" style={{ background: '#dc2626' }}>
                Authorize Continuation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
