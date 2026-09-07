// grading-engine.util.ts
export type RubricKey =
    | 'projectDelivery'
    | 'clientFeedback'
    | 'documentationQuality'
    | 'verifiedExperience'
    | 'communityInvestment'
    | 'certifications'
    | 'responsiveness';

export type RubricState = Record<RubricKey, number>;
export type RubricWeights = Record<RubricKey, number>;

export const DEFAULT_WEIGHTS: RubricWeights = {
    projectDelivery: 0.22,
    clientFeedback: 0.18,
    documentationQuality: 0.12,
    verifiedExperience: 0.18,
    communityInvestment: 0.06,
    certifications: 0.08,
    responsiveness: 0.16,
};

export function computeWeightedScore (
    rubric: RubricState,
    weights: RubricWeights = DEFAULT_WEIGHTS
): number {
    let score = 0, wsum = 0;
    ( Object.keys( weights ) as RubricKey[] ).forEach( k => {
        const w = weights[k] ?? 0;
        const v = rubric[k] ?? 1;           // sliders 1–5
        score += ( ( v - 1 ) / 4 ) * 100 * w;   // 1→0%, 5→100%
        wsum += w;
    } );
    return Math.round( score / ( wsum || 1 ) );
}

export function toLetter ( score: number ): 'A' | 'B' | 'C' | 'D' | 'F' {
    if ( score >= 90 ) return 'A';
    if ( score >= 80 ) return 'B';
    if ( score >= 70 ) return 'C';
    if ( score >= 60 ) return 'D';
    return 'F';
}