// ============================================================
// Fact Check — Type Definitions
// ============================================================

// -----------------------------------------------------------
// Verification Status (per claim)
// -----------------------------------------------------------

export type VerificationStatus =
  | 'verified'        // Confirmed by ≥2 authoritative sources
  | 'refuted'         // Contradicted by authoritative sources
  | 'partially-correct' // Core correct but details off
  | 'unverified'      // No reliable source found
  | 'unverifiable'    // Claim is inherently unverifiable (opinion, future event)
  | 'pending';        // Not yet checked (placeholder before real FC runs)

// -----------------------------------------------------------
// Evidence (per claim)
// -----------------------------------------------------------

export interface Evidence {
  /** URL of the source. Null if evidence is from internal calculation. */
  url: string | null;
  /** Human-readable source title. */
  title: string;
  /** Source type classification. */
  type: 'authority' | 'encyclopedia' | 'news' | 'academic' | 'official' | 'calculation' | 'other';
  /** Whether this evidence supports, refutes, or is neutral to the claim. */
  direction: 'supporting' | 'refuting' | 'neutral';
  /** Short excerpt or summary in Chinese. */
  excerpt: string;
}

// -----------------------------------------------------------
// Claim (a single verifiable assertion)
// -----------------------------------------------------------

export interface Claim {
  /** Unique identifier within this question. */
  id: string;
  /** The exact text of the claim (from the answer). */
  text: string;
  /** Which answerer made this claim (AIC, Ask AI, etc.). */
  sourceAnswerer: string;
  /** Current verification status. */
  status: VerificationStatus;
  /** List of evidence found (empty before FC runs). */
  evidence: Evidence[];
  /** Confidence in the verification result. */
  confidence: 'high' | 'medium' | 'low';
  /** Human-readable note about the verification. */
  note: string;
}

// -----------------------------------------------------------
// Fact Check Result (per question)
// -----------------------------------------------------------

export interface FactCheckResult {
  /** Whether fact-checking is required for this question. */
  required: 'mandatory' | 'partial' | 'skip';

  /** Overall verification result. */
  result: '通过' | '未通过' | '部分通过' | '无法验证' | '不适用';

  /** Aggregated confidence across all claims. */
  confidence: 'high' | 'medium' | 'low';

  /** All extracted claims (empty if required=skip). */
  claims: Claim[];

  /** Summary paragraph (Chinese). */
  summary: string;

  /** When the check was performed. Null if not yet checked. */
  checkedAt: string | null;
}

// -----------------------------------------------------------
// Fact Check Summary (cross-question, for Daily Summary)
// -----------------------------------------------------------

export interface FactCheckSummary {
  /** Total claims checked across all questions. */
  totalClaims: number;
  /** Claims that passed verification. */
  passedClaims: number;
  /** Claims that failed verification. */
  failedClaims: number;
  /** Claims that could not be verified. */
  unverifiedClaims: number;
  /** Questions where FC was skipped. */
  skippedQuestions: number;
  /** Overall fact-checking health assessment. */
  overallAssessment: string;
}
