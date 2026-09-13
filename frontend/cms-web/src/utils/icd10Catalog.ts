// ICD-10-CM Standard Clinical Diagnostic Catalog
// Provides searchable codes for outpatient and inpatient documentation

export interface Icd10Item {
  code: string;
  description: string;
  chapter: string;
  isChronic?: boolean;
}

export const COMMON_ICD10_CATALOG: Icd10Item[] = [
  // Infectious & Parasitic
  { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', chapter: 'Infectious' },
  { code: 'B34.9', description: 'Viral infection, unspecified', chapter: 'Infectious' },
  { code: 'B35.0', description: 'Tinea barbae and tinea capitis (Fungal scalp ringworm)', chapter: 'Dermatology' },
  { code: 'B35.3', description: 'Tinea pedis (Athlete foot)', chapter: 'Dermatology' },
  { code: 'B35.4', description: 'Tinea corporis (Ringworm of the body)', chapter: 'Dermatology' },
  { code: 'B35.6', description: 'Tinea cruris (Jock itch)', chapter: 'Dermatology' },
  { code: 'B36.0', description: 'Pityriasis versicolor', chapter: 'Dermatology' },
  { code: 'B86', description: 'Scabies infestation', chapter: 'Dermatology' },
  { code: 'B00.9', description: 'Herpesviral infection, unspecified', chapter: 'Infectious' },
  { code: 'B02.9', description: 'Zoster without complications (Shingles)', chapter: 'Infectious' },
  { code: 'B07.9', description: 'Viral wart, unspecified (Verruca vulgaris)', chapter: 'Dermatology' },

  // Dermatology (Skin & Subcutaneous)
  { code: 'L20.9', description: 'Atopic dermatitis, unspecified (Eczema)', chapter: 'Dermatology', isChronic: true },
  { code: 'L23.9', description: 'Allergic contact dermatitis, unspecified cause', chapter: 'Dermatology' },
  { code: 'L24.9', description: 'Irritant contact dermatitis, unspecified cause', chapter: 'Dermatology' },
  { code: 'L21.9', description: 'Seborrheic dermatitis, unspecified', chapter: 'Dermatology' },
  { code: 'L30.9', description: 'Dermatitis, unspecified', chapter: 'Dermatology' },
  { code: 'L40.0', description: 'Psoriasis vulgaris', chapter: 'Dermatology', isChronic: true },
  { code: 'L70.0', description: 'Acne vulgaris', chapter: 'Dermatology' },
  { code: 'L71.9', description: 'Rosacea, unspecified', chapter: 'Dermatology' },
  { code: 'L50.0', description: 'Allergic urticaria (Hives)', chapter: 'Dermatology' },
  { code: 'L80', description: 'Vitiligo', chapter: 'Dermatology', isChronic: true },
  { code: 'L82.1', description: 'Seborrheic keratosis', chapter: 'Dermatology' },
  { code: 'L03.90', description: 'Cellulitis, unspecified', chapter: 'Dermatology' },
  { code: 'L02.91', description: 'Cutaneous abscess, unspecified', chapter: 'Dermatology' },
  { code: 'L01.00', description: 'Impetigo, unspecified', chapter: 'Dermatology' },
  { code: 'L63.9', description: 'Alopecia areata, unspecified', chapter: 'Dermatology' },
  { code: 'L81.0', description: 'Postinflammatory hyperpigmentation', chapter: 'Dermatology' },
  { code: 'L81.1', description: 'Chloasma / Melasma', chapter: 'Dermatology' },
  { code: 'L73.9', description: 'Follicular disorder, unspecified (Folliculitis)', chapter: 'Dermatology' },
  { code: 'L90.5', description: 'Scar conditions and fibrosis of skin (Keloid / Hypertrophic)', chapter: 'Dermatology' },

  // Endocrine & Metabolic
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', chapter: 'Endocrine', isChronic: true },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', chapter: 'Endocrine', isChronic: true },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', chapter: 'Endocrine', isChronic: true },
  { code: 'E05.90', description: 'Thyrotoxicosis / Hyperthyroidism, unspecified', chapter: 'Endocrine', isChronic: true },
  { code: 'E66.9', description: 'Obesity, unspecified', chapter: 'Endocrine', isChronic: true },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified (High Cholesterol)', chapter: 'Endocrine', isChronic: true },

  // Circulatory / Cardiovascular
  { code: 'I10', description: 'Essential (primary) hypertension', chapter: 'Cardiovascular', isChronic: true },
  { code: 'I11.9', description: 'Hypertensive heart disease without heart failure', chapter: 'Cardiovascular', isChronic: true },
  { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery', chapter: 'Cardiovascular', isChronic: true },
  { code: 'I50.9', description: 'Heart failure, unspecified', chapter: 'Cardiovascular', isChronic: true },
  { code: 'I48.91', description: 'Unspecified atrial fibrillation', chapter: 'Cardiovascular', isChronic: true },

  // Respiratory System
  { code: 'J00', description: 'Acute nasopharyngitis (Common cold)', chapter: 'Respiratory' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified (Sore throat)', chapter: 'Respiratory' },
  { code: 'J03.90', description: 'Acute tonsillitis, unspecified', chapter: 'Respiratory' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', chapter: 'Respiratory' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', chapter: 'Respiratory' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', chapter: 'Respiratory', isChronic: true },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease (COPD), unspecified', chapter: 'Respiratory', isChronic: true },
  { code: 'J30.9', description: 'Allergic rhinitis, unspecified (Hay fever)', chapter: 'Respiratory' },

  // Digestive System
  { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis (GERD)', chapter: 'Gastrointestinal', isChronic: true },
  { code: 'K29.70', description: 'Gastritis, unspecified, without bleeding', chapter: 'Gastrointestinal' },
  { code: 'K27.9', description: 'Peptic ulcer, site unspecified', chapter: 'Gastrointestinal' },
  { code: 'K58.9', description: 'Irritable bowel syndrome without diarrhea (IBS)', chapter: 'Gastrointestinal', isChronic: true },
  { code: 'K59.00', description: 'Constipation, unspecified', chapter: 'Gastrointestinal' },

  // Musculoskeletal & Connective Tissue
  { code: 'M54.5', description: 'Low back pain (Lumbago)', chapter: 'Musculoskeletal' },
  { code: 'M54.2', description: 'Cervicalgia (Neck pain)', chapter: 'Musculoskeletal' },
  { code: 'M25.50', description: 'Pain in unspecified joint (Arthralgia)', chapter: 'Musculoskeletal' },
  { code: 'M19.90', description: 'Primary osteoarthritis, unspecified site', chapter: 'Musculoskeletal', isChronic: true },
  { code: 'M79.1', description: 'Myalgia (Muscle pain)', chapter: 'Musculoskeletal' },

  // Nervous & General
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable', chapter: 'Neurology' },
  { code: 'G44.209', description: 'Tension-type headache, unspecified', chapter: 'Neurology' },
  { code: 'R50.9', description: 'Fever, unspecified', chapter: 'Symptoms' },
  { code: 'R51.9', description: 'Headache, unspecified', chapter: 'Symptoms' },
  { code: 'R53.83', description: 'Other fatigue / Malaise', chapter: 'Symptoms' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified (UTI)', chapter: 'Genitourinary' },
  { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings', chapter: 'Wellness' }
];

export function searchIcd10(query: string, maxResults = 12): Icd10Item[] {
  if (!query || query.trim().length === 0) {
    return COMMON_ICD10_CATALOG.slice(0, maxResults);
  }

  const q = query.trim().toLowerCase();
  const directCodeMatches: Icd10Item[] = [];
  const textMatches: Icd10Item[] = [];

  for (const item of COMMON_ICD10_CATALOG) {
    const codeMatch = item.code.toLowerCase().startsWith(q);
    const descMatch = item.description.toLowerCase().includes(q);

    if (codeMatch) {
      directCodeMatches.push(item);
    } else if (descMatch) {
      textMatches.push(item);
    }
  }

  return [...directCodeMatches, ...textMatches].slice(0, maxResults);
}
