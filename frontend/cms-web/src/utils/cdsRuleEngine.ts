// Clinical Decision Support (CDS) Rule Engine
// Cross-checks patient allergies and drug-drug interactions

export interface CdsAlert {
  id: string;
  type: 'ALLERGY' | 'INTERACTION';
  severity: 'CRITICAL' | 'MODERATE' | 'INFO';
  title: string;
  drugA: string;
  drugB?: string;
  allergen?: string;
  mechanism: string;
  clinicalRecommendation: string;
}

// Drug class to allergen keywords map
const ALLERGY_CLASS_MAP: Record<string, { classKeywords: string[]; allergens: string[] }> = {
  penicillin: {
    classKeywords: ['amoxicillin', 'ampicillin', 'augmentin', 'penicillin', 'piperacillin', 'cloxacillin'],
    allergens: ['penicillin', 'penicillins', 'amox', 'beta-lactam', 'ampicillin']
  },
  sulfa: {
    classKeywords: ['bactrim', 'cotrimoxazole', 'co-trimoxazole', 'sulfamethoxazole', 'sulfadiazine', 'dapsone'],
    allergens: ['sulfa', 'sulfonamide', 'bactrim', 'septra']
  },
  nsaid: {
    classKeywords: ['ibuprofen', 'diclofenac', 'aspirin', 'naproxen', 'indomethacin', 'meloxicam', 'ketorolac', 'celecoxib'],
    allergens: ['nsaid', 'nsaids', 'aspirin', 'ibuprofen', 'diclofenac']
  },
  cephalosporin: {
    classKeywords: ['ceftriaxone', 'cefuroxime', 'cephalexin', 'cefepime', 'cefixime'],
    allergens: ['cephalosporin', 'ceftriaxone', 'keflex', 'penicillin'] // Note: cross-allergy risk
  },
  macrolide: {
    classKeywords: ['azithromycin', 'clarithromycin', 'erythromycin'],
    allergens: ['macrolide', 'azithromycin', 'erythromycin']
  },
  fluoroquinolone: {
    classKeywords: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin'],
    allergens: ['fluoroquinolone', 'cipro', 'ciprofloxacin', 'quinolone']
  },
  opioid: {
    classKeywords: ['morphine', 'tramadol', 'codeine', 'fentanyl', 'pethidine'],
    allergens: ['opioid', 'morphine', 'tramadol', 'codeine']
  }
};

// Common high-yield clinical drug-drug interactions
const DRUG_INTERACTIONS: Array<{
  drug1: string[];
  drug2: string[];
  severity: 'CRITICAL' | 'MODERATE' | 'INFO';
  title: string;
  mechanism: string;
  recommendation: string;
}> = [
  {
    drug1: ['warfarin', 'heparin', 'enoxaparin', 'rivaroxaban', 'apixaban'],
    drug2: ['aspirin', 'ibuprofen', 'diclofenac', 'naproxen', 'meloxicam', 'ketorolac'],
    severity: 'CRITICAL',
    title: 'Severe Bleeding & Hemorrhage Risk',
    mechanism: 'Anticoagulant combined with NSAID significantly increases gastric ulceration and fatal internal bleeding.',
    recommendation: 'Avoid NSAIDs in patients on anticoagulants. Consider Paracetamol or topical analgesics.'
  },
  {
    drug1: ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'losartan', 'valsartan'],
    drug2: ['spironolactone', 'potassium', 'k-dur'],
    severity: 'CRITICAL',
    title: 'Severe Hyperkalemia Risk',
    mechanism: 'ACE inhibitors/ARBs combined with potassium-sparing diuretics produce additive potassium retention, leading to cardiac arrhythmias.',
    recommendation: 'Monitor serum potassium and renal function closely. Adjust doses or avoid co-administration.'
  },
  {
    drug1: ['metformin'],
    drug2: ['contrast', 'iodinated', 'alcohol'],
    severity: 'MODERATE',
    title: 'Risk of Lactic Acidosis',
    mechanism: 'Concomitant renal impairment or contrast imaging may lead to toxic metformin accumulation.',
    recommendation: 'Withhold Metformin 48 hours prior to IV contrast procedures. Check eGFR.'
  },
  {
    drug1: ['ciprofloxacin', 'levofloxacin'],
    drug2: ['antacid', 'calcium', 'magnesium', 'iron', 'ferrous'],
    severity: 'MODERATE',
    title: 'Reduced Quinolone Bioavailability (Chelation)',
    mechanism: 'Divalent and trivalent cations form non-absorbable chelates with fluoroquinolones, causing antibiotic failure.',
    recommendation: 'Separate administration by at least 2 hours before or 4 hours after mineral/antacid ingestion.'
  },
  {
    drug1: ['tramadol'],
    drug2: ['fluoxetine', 'sertraline', 'amitriptyline', 'escitalopram'],
    severity: 'CRITICAL',
    title: 'Risk of Serotonin Syndrome & Seizures',
    mechanism: 'Both agents increase synaptic serotonin and reduce the seizure threshold.',
    recommendation: 'Avoid combination or use lowest doses. Monitor for agitation, tremor, hyperreflexia, and fever.'
  },
  {
    drug1: ['amoxicillin', 'ampicillin'],
    drug2: ['allopurinol'],
    severity: 'MODERATE',
    title: 'High Risk of Drug Rash',
    mechanism: 'Concurrent allopurinol and aminopenicillin markedly increases the incidence of severe exanthematous skin eruptions.',
    recommendation: 'Consider alternative antibiotic (e.g. macrolide or cephalosporin).'
  },
  {
    drug1: ['clarithromycin', 'erythromycin'],
    drug2: ['simvastatin', 'atorvastatin'],
    severity: 'CRITICAL',
    title: 'Severe Rhabdomyolysis & Statin Toxicity',
    mechanism: 'Strong CYP3A4 inhibition by macrolides causes drastic elevation in serum statin concentrations.',
    recommendation: 'Temporarily pause statin during macrolide antibiotic course or switch to Azithromycin.'
  }
];

export function evaluateCdsAlerts(
  patientAllergiesRaw: string | undefined | null,
  activePrescriptionNames: string[],
  newCandidateDrugName: string
): CdsAlert[] {
  const alerts: CdsAlert[] = [];
  const candidateLower = newCandidateDrugName.toLowerCase();

  // 1. Evaluate Drug-Allergy Cross-Reactions
  if (patientAllergiesRaw && patientAllergiesRaw.trim().length > 0) {
    const rawAllergies = patientAllergiesRaw.toLowerCase();
    
    for (const [className, rule] of Object.entries(ALLERGY_CLASS_MAP)) {
      const patientHasAllergy = rule.allergens.some(a => rawAllergies.includes(a));
      const drugInClass = rule.classKeywords.some(k => candidateLower.includes(k));

      if (patientHasAllergy && drugInClass) {
        alerts.push({
          id: `allergy-${className}-${Date.now()}`,
          type: 'ALLERGY',
          severity: 'CRITICAL',
          title: `Documented Patient Allergy Conflict (${className.toUpperCase()})`,
          drugA: newCandidateDrugName,
          allergen: patientAllergiesRaw,
          mechanism: `Patient record indicates known sensitivity to "${patientAllergiesRaw}". "${newCandidateDrugName}" belongs to or cross-reacts with the ${className} pharmaceutical class.`,
          clinicalRecommendation: 'Do NOT administer. High risk of acute anaphylaxis, urticaria, or severe hypersensitivity reaction. Select an alternate antibiotic/agent class.'
        });
      }
    }
  }

  // 2. Evaluate Drug-Drug Interactions
  const allCurrent = [...activePrescriptionNames.map(d => d.toLowerCase())];

  for (const rule of DRUG_INTERACTIONS) {
    const candidateMatches1 = rule.drug1.some(d => candidateLower.includes(d));
    const candidateMatches2 = rule.drug2.some(d => candidateLower.includes(d));

    if (candidateMatches1) {
      const interacting = allCurrent.find(c => rule.drug2.some(d => c.includes(d)));
      if (interacting) {
        alerts.push({
          id: `ddi-${Date.now()}-${Math.random()}`,
          type: 'INTERACTION',
          severity: rule.severity,
          title: rule.title,
          drugA: newCandidateDrugName,
          drugB: interacting,
          mechanism: rule.mechanism,
          clinicalRecommendation: rule.recommendation
        });
      }
    } else if (candidateMatches2) {
      const interacting = allCurrent.find(c => rule.drug1.some(d => c.includes(d)));
      if (interacting) {
        alerts.push({
          id: `ddi-${Date.now()}-${Math.random()}`,
          type: 'INTERACTION',
          severity: rule.severity,
          title: rule.title,
          drugA: newCandidateDrugName,
          drugB: interacting,
          mechanism: rule.mechanism,
          clinicalRecommendation: rule.recommendation
        });
      }
    }
  }

  return alerts;
}
