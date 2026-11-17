export interface AncPatientCheckDto {
  patientId: number;
  mrn: string;
  fullName: string;
  ageYears: number;
  gender: string;
  dateOfBirth: string;
  primaryPhone: string;
  bloodGroup?: string;
  address?: string;
  allergies?: string;
  chronicConditions?: string;
  hasActivePregnancy: boolean;
  activeEpisode?: AncEpisodeSummaryDto;
  historicalEpisodes: AncEpisodeSummaryDto[];
}

export interface AncEpisodeSummaryDto {
  id: number;
  patientId: number;
  episodeNumber: string;
  registrationDate: string;
  gravidity: number;
  parity: number;
  lmpDate?: string;
  isCycleRegular: boolean;
  eddLmp?: string;
  initialUltrasoundDate?: string;
  initialGestationalWeeks?: number;
  initialGestationalDays?: number;
  eddUltrasound?: string;
  approvedDatingMethod: string;
  establishedEdd: string;
  currentGestationalWeeks: number;
  currentGestationalDays: number;
  gestationalAgeFormatted: string;
  currentTrimester: number;
  trimesterFormatted: string;
  progressPercentage: number;
  daysRemaining: number;
  isOverdueWarning: boolean;
  requiresOverdueReview: boolean;
  status: string; // 'Active' | 'Closed'
  completedVisitsCount: number;
  lastVisitDate?: string;
  nextAppointmentDate?: string;
  closureReason?: string;
  closedAt?: string;
  closedByName?: string;
  clinicalAlerts: AncClinicalAlertDto[];
}

export interface AncClinicalAlertDto {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionPrompt?: string;
}

export interface AncHistoryItem {
  status: 'Yes' | 'No' | 'Unknown';
  remarks?: string;
}

export interface AncMedicalHistoryDto {
  diabetes: AncHistoryItem;
  hypertension: AncHistoryItem;
  renalDisease: AncHistoryItem;
  tuberculosis: AncHistoryItem;
  drugAllergy: AncHistoryItem;
  pastSurgicalHistory: AncHistoryItem;
  motherMedicalHistory: AncHistoryItem;
  fatherMedicalHistory: AncHistoryItem;
}

export interface AncGeneralExamDto {
  chest?: string;
  heart?: string;
  abdomen?: string;
  vaginalExamination?: string;
  generalFindings?: string;
  hpNotes?: string;
  additionalRemarks?: string;
}

export interface AncBaselineVitalsDto {
  systolicBp?: number;
  diastolicBp?: number;
  bpSite?: string;
  pulseRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  spO2?: number;
  oxygenSupport?: string;
  weight?: number;
  height?: number;
  muac?: number;
  headCircumference?: number;
}

export interface AncBasicModelCriteriaDto {
  historyOfStillbirth: AncHistoryItem;
  historyThreeOrMoreAbortions: AncHistoryItem;
  previousLowBirthWeight: AncHistoryItem;
  previousHighBirthWeight: AncHistoryItem;
  lastPregnancyComplications: AncHistoryItem;
  previousSurgery: AncHistoryItem;
  otherRiskCriteria: AncHistoryItem;
}

export interface AncGeneralMedicalAssessmentDto {
  insulinDependentDiabetes: AncHistoryItem;
  renalDisease: AncHistoryItem;
  cardiacDisease: AncHistoryItem;
  knownSubstanceAbuse: AncHistoryItem;
  otherSevereConditions: AncHistoryItem;
}

export interface AncPreviousPregnancyDto {
  id: number;
  pregnancyNumber: number;
  birthYear?: number;
  dateOfBirth?: string;
  modeOfDelivery?: string;
  gestationalAgeWeeks?: number;
  deliveryPlace?: string;
  birthWeightGrams?: number;
  deliveryOutcome?: string;
  complications?: string;
  remarks?: string;
}

export interface AncEncounterDto {
  id: number;
  episodeId: number;
  encounterNumber: number;
  visitCode: string;
  encounterDate: string;
  encounterTimeFormatted: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  gestationalAgeFormatted: string;
  trimester: number;
  weight?: number;
  systolicBp?: number;
  diastolicBp?: number;
  bloodPressureFormatted?: string;
  bpSite?: string;
  pulseRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  fundalHeight?: number;
  fetalHeartRate?: number;
  fetalMovement?: string;
  fetalPresentation?: string;
  anemia?: string;
  edema?: string;
  ironSupplementation?: string;
  tetanusVaccination?: string;
  dangerSigns: string[];
  clinicalNotes?: string;
  assessment?: string;
  plan?: string;
  labResultRemarks?: string;
  nextVisitDate?: string;
  appointmentRemarks?: string;
  attendingDoctorId: number;
  attendingDoctorName: string;
  isDraft: boolean;
  finalizedAt?: string;
  finalizedByName?: string;
  isCorrection: boolean;
  correctionReason?: string;
  diagnoses: AncDiagnosisDto[];
  createdAt: string;
}

export interface AncEncounterComparisonDto {
  previousEncounter?: AncEncounterDto;
  currentEncounter?: AncEncounterDto;
  weightDifference?: number;
  fundalHeightDifference?: number;
  gestationalWeeksDifference: number;
}

export interface AncUltrasoundDto {
  id: number;
  episodeId: number;
  encounterId?: number;
  ultrasoundDate: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  gestationalAgeFormatted: string;
  estimatedConceptionDate?: string;
  eddByUltrasound?: string;
  trimester: number;
  presentation?: string;
  placentalLocation?: string;
  amnioticFluid?: string;
  fetalHeartRate?: number;
  estimatedFetalWeight?: number;
  findings?: string;
  takenBy?: string;
  createdAt: string;
}

export interface AncPmtctDto {
  id: number;
  episodeId: number;
  motherConfidentialCode?: string;
  partnerConfidentialCode?: string;
  motherLetterCode?: string;
  partnerLetterCode?: string;
  hivTested?: string;
  hivTestResult?: string;
  partnerHivResult?: string;
  cd4Count?: number;
  whoClinicalStaging?: string;
  nutritionalAssessment?: string;
  infantFeedingCounseling?: string;
  linkedToArt: boolean;
  motherPmtctDate?: string;
  partnerPmtctDate?: string;
  motherPmtctResult?: string;
  partnerPmtctResult?: string;
  confidentialRemarks?: string;
  updatedAt: string;
  isRestricted: boolean;
}

export interface AncLabExaminationDto {
  id: number;
  episodeId: number;
  encounterId?: number;
  testType: string;
  testDate: string;
  resultValue?: string;
  unit?: string;
  referenceRange?: string;
  status: string; // 'Requested' | 'Pending' | 'Completed'
  isAbnormal: boolean;
  remarks?: string;
  conductedBy?: string;
}

export interface AncDiagnosisDto {
  id: number;
  episodeId: number;
  encounterId?: number;
  icdCode?: string;
  dhis2Code?: string;
  hmisCode?: string;
  description: string;
  diagnosisType: string; // 'Primary' | 'Secondary' | 'Complication'
  diagnosisDate: string;
}

export interface AncAppointmentDto {
  id: number;
  episodeId: number;
  encounterId?: number;
  patientId: number;
  patientName: string;
  patientMrn: string;
  doctorId: number;
  doctorName: string;
  appointmentDate: string;
  status: string;
  remarks?: string;
  isOverdue: boolean;
}

export interface AncOutcomeDto {
  id: number;
  episodeId: number;
  deliveryDate: string;
  deliveryTimeFormatted: string;
  deliveryPlace: string;
  modeOfDelivery: string;
  pregnancyOutcomeType: string;
  numberOfBabies: number;
  maternalOutcome: string;
  maternalComplications?: string;
  baby1Outcome: string;
  baby1Sex: string;
  baby1WeightGrams: number;
  baby1Apgar1?: number;
  baby1Apgar5?: number;
  baby2Outcome?: string;
  baby2Sex?: string;
  baby2WeightGrams?: number;
  baby2Apgar1?: number;
  baby2Apgar5?: number;
  deliveryRemarks?: string;
  referralInfo?: string;
  closingClinicianName: string;
  createdAt: string;
}

export interface AncAuditLogDto {
  id: number;
  action: string;
  changedByName: string;
  changedAt: string;
  detailsJson?: string;
}

export interface AncWorkspaceDetailDto {
  patient: AncPatientCheckDto;
  episode: AncEpisodeSummaryDto;
  initialAssessment?: AncInitialAssessmentDto;
  previousPregnancies: AncPreviousPregnancyDto[];
  encounters: AncEncounterDto[];
  latestComparison?: AncEncounterComparisonDto;
  ultrasounds: AncUltrasoundDto[];
  pmtct?: AncPmtctDto;
  labExaminations: AncLabExaminationDto[];
  diagnoses: AncDiagnosisDto[];
  appointments: AncAppointmentDto[];
  outcome?: AncOutcomeDto;
  auditLogs: AncAuditLogDto[];
}

export interface AncInitialAssessmentDto {
  id: number;
  episodeId: number;
  assessmentDate: string;
  abortions: number;
  molarPregnancies: number;
  ectopicPregnancies: number;
  livingChildren: number;
  medicalHistory?: AncMedicalHistoryDto;
  generalExam?: AncGeneralExamDto;
  baselineVitals?: AncBaselineVitalsDto;
  basicModelCriteria?: AncBasicModelCriteriaDto;
  generalMedicalAssessment?: AncGeneralMedicalAssessmentDto;
}

export interface AncDashboardDto {
  totalActivePregnancies: number;
  newRegistrationsThisMonth: number;
  followUpVisitsToday: number;
  upcomingAppointmentsCount: number;
  overdueAppointmentsCount: number;
  firstTrimesterCount: number;
  secondTrimesterCount: number;
  thirdTrimesterCount: number;
  overdueWarning42wCount: number;
  requiringReview43wCount: number;
  highRiskCount: number;
  closedThisMonthCount: number;
  activePregnanciesList: AncEpisodeSummaryDto[];
  todayWorklist: AncAppointmentDto[];
  urgentAlerts: AncClinicalAlertDto[];
}

export interface AncReportResultDto {
  reportTitle: string;
  generatedAt: string;
  totalRecords: number;
  headers: string[];
  rows: Record<string, any>[];
  summaryMetrics: Record<string, any>;
}

export interface AncRegisterEpisodeRequest {
  patientId: number;
  registrationDate: string;
  gravidity: number;
  parity: number;
  lmpDate?: string;
  isCycleRegular: boolean;
  initialUltrasoundDate?: string;
  initialUltrasoundWeeks?: number;
  initialUltrasoundDays?: number;
  approvedDatingMethod: string;
  establishedEddOverride?: string;
  abortions?: number;
  molarPregnancies?: number;
  ectopicPregnancies?: number;
  livingChildren?: number;
  medicalHistory?: AncMedicalHistoryDto;
  generalExam?: AncGeneralExamDto;
  baselineVitals?: AncBaselineVitalsDto;
  basicModelCriteria?: AncBasicModelCriteriaDto;
  generalMedicalAssessment?: AncGeneralMedicalAssessmentDto;
  previousPregnancies?: AncPreviousPregnancyDto[];
}

export interface AncCreateEncounterRequest {
  episodeId: number;
  encounterDate: string;
  weight?: number;
  systolicBp?: number;
  diastolicBp?: number;
  bpSite?: string;
  pulseRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  fundalHeight?: number;
  fetalHeartRate?: number;
  fetalMovement?: string;
  fetalPresentation?: string;
  anemia?: string;
  edema?: string;
  ironSupplementation?: string;
  tetanusVaccination?: string;
  dangerSigns: string[];
  clinicalNotes?: string;
  assessment?: string;
  plan?: string;
  labResultRemarks?: string;
  nextVisitDate?: string;
  appointmentRemarks?: string;
  isDraft: boolean;
  isCorrection?: boolean;
  correctionReason?: string;
  diagnoses?: AncDiagnosisDto[];
}

export interface AncCloseEpisodeRequest {
  episodeId: number;
  deliveryDate: string;
  deliveryTime: string;
  deliveryPlace: string;
  modeOfDelivery: string;
  pregnancyOutcomeType: string;
  numberOfBabies: number;
  maternalOutcome: string;
  maternalComplications?: string;
  baby1Outcome: string;
  baby1Sex: string;
  baby1WeightGrams: number;
  baby1Apgar1?: number;
  baby1Apgar5?: number;
  baby2Outcome?: string;
  baby2Sex?: string;
  baby2WeightGrams?: number;
  baby2Apgar1?: number;
  baby2Apgar5?: number;
  deliveryRemarks?: string;
  referralInfo?: string;
  closureReason?: string;
}

export interface AncUpdateEpisodeBaselineRequest {
  episodeId: number;
  gravidity: number;
  parity: number;
  lmpDate?: string;
  isCycleRegular: boolean;
  approvedDatingMethod: string;
  initialUltrasoundDate?: string;
  initialGestationalWeeks?: number;
  initialGestationalDays?: number;
  previousPregnancies?: AncPreviousPregnancyDto[];
}
