/**
 * Reference Match Engine
 * Translates spectral & dynamic analysis into DSP biquad filter coefficients,
 * compressor curves, and loudness matching drive parameters.
 */

import { ISO_31_BANDS } from './analyzer.js';

export class MatchEngine {
    constructor() {
        this.matchAmount = 1.0; // 0.0 to 1.5
        this.smoothing = 0.5;   // 0.0 (sharp) to 1.0 (broad)
        this.maxBoostDb = 9.0;  // Safety limit
        this.maxCutDb = -12.0;  // Safety limit
        this.targetLoudnessOffsetDb = 0.0;
        this.activeDifferenceData = null;
    }

    setMatchAmount(amount) {
        this.matchAmount = Math.max(0.0, Math.min(2.0, amount));
    }

    setSmoothing(smoothing) {
        this.smoothing = Math.max(0.0, Math.min(1.0, smoothing));
    }

    setLimits(maxBoostDb, maxCutDb) {
        this.maxBoostDb = Math.max(1.0, maxBoostDb);
        this.maxCutDb = Math.min(-1.0, maxCutDb);
    }

    /**
     * Set the calculated difference curve data from analyzer
     */
    setDifferenceData(diffData) {
        this.activeDifferenceData = diffData;
        this.targetLoudnessOffsetDb = diffData.deltaLoudnessDb;
    }

    /**
     * Compute biquad filter coefficients for all 32 bands
     * @param {number} sampleRate 
     * @returns {Array<{b0, b1, b2, a1, a2, enabled, freq, gainDb, q}>}
     */
    computeBiquadCoefficients(sampleRate = 48000) {
        if (!this.activeDifferenceData) {
            // Flat pass-through
            return ISO_31_BANDS.map(freq => ({
                b0: 1.0, b1: 0.0, b2: 0.0,
                a1: 0.0, a2: 0.0,
                enabled: false,
                freq: freq,
                gainDb: 0.0,
                q: 1.8
            }));
        }

        const deltaGains = this.activeDifferenceData.smoothedDeltaDb;
        const filters = [];

        for (let i = 0; i < ISO_31_BANDS.length; i++) {
            const freq = ISO_31_BANDS[i];
            const rawGain = deltaGains[i] || 0.0;

            // Scale by match amount
            let scaledGain = rawGain * this.matchAmount;

            // Apply safety mastering clamps
            scaledGain = Math.max(this.maxCutDb, Math.min(this.maxBoostDb, scaledGain));

            // Q factor: optimal 1/3-octave band Q ~ 1.8
            // Edge bands use shelves for smoother sub and air control
            let filterType = 'peaking';
            let q = 1.8;

            if (i === 0) {
                filterType = 'lowshelf';
                q = 0.707;
            } else if (i === ISO_31_BANDS.length - 1) {
                filterType = 'highshelf';
                q = 0.707;
            }

            const coeffs = this.calcRbjBiquad(filterType, sampleRate, freq, scaledGain, q);
            filters.push({
                ...coeffs,
                enabled: Math.abs(scaledGain) > 0.1,
                freq,
                gainDb: scaledGain,
                q
            });
        }

        return filters;
    }

    /**
     * Robert Bristow-Johnson (RBJ) Audio EQ Cookbook Biquad Calculation
     */
    calcRbjBiquad(type, sampleRate, frequencyHz, gainDb, qFactor) {
        const nyquist = sampleRate * 0.495;
        const f0 = Math.max(10.0, Math.min(nyquist, frequencyHz));
        const Q = Math.max(0.1, Math.min(30.0, qFactor));
        const A = Math.pow(10.0, gainDb / 40.0); // sqrt of 10^(G/20)
        const w0 = (2.0 * Math.PI * f0) / sampleRate;
        const cosW = Math.cos(w0);
        const sinW = Math.sin(w0);
        const alpha = sinW / (2.0 * Q);

        let b0 = 1.0, b1 = 0.0, b2 = 0.0;
        let a0 = 1.0, a1 = 0.0, a2 = 0.0;

        switch (type) {
            case 'peaking': {
                b0 = 1.0 + alpha * A;
                b1 = -2.0 * cosW;
                b2 = 1.0 - alpha * A;
                a0 = 1.0 + alpha / A;
                a1 = -2.0 * cosW;
                a2 = 1.0 - alpha / A;
                break;
            }
            case 'lowshelf': {
                const sqrtA = Math.sqrt(A);
                b0 = A * ((A + 1.0) - (A - 1.0) * cosW + 2.0 * sqrtA * alpha);
                b1 = 2.0 * A * ((A - 1.0) - (A + 1.0) * cosW);
                b2 = A * ((A + 1.0) - (A - 1.0) * cosW - 2.0 * sqrtA * alpha);
                a0 = (A + 1.0) + (A - 1.0) * cosW + 2.0 * sqrtA * alpha;
                a1 = -2.0 * ((A - 1.0) + (A + 1.0) * cosW);
                a2 = (A + 1.0) + (A - 1.0) * cosW - 2.0 * sqrtA * alpha;
                break;
            }
            case 'highshelf': {
                const sqrtA = Math.sqrt(A);
                b0 = A * ((A + 1.0) + (A - 1.0) * cosW + 2.0 * sqrtA * alpha);
                b1 = -2.0 * A * ((A - 1.0) + (A + 1.0) * cosW);
                b2 = A * ((A + 1.0) + (A - 1.0) * cosW - 2.0 * sqrtA * alpha);
                a0 = (A + 1.0) - (A - 1.0) * cosW + 2.0 * sqrtA * alpha;
                a1 = 2.0 * ((A - 1.0) - (A + 1.0) * cosW);
                a2 = (A + 1.0) - (A - 1.0) * cosW - 2.0 * sqrtA * alpha;
                break;
            }
            default:
                b0 = 1.0; b1 = 0.0; b2 = 0.0;
                a0 = 1.0; a1 = 0.0; a2 = 0.0;
        }

        const invA0 = 1.0 / a0;
        return {
            b0: b0 * invA0,
            b1: b1 * invA0,
            b2: b2 * invA0,
            a1: a1 * invA0,
            a2: a2 * invA0
        };
    }

    /**
     * Compute magnitude response curve for UI visualizer across N log-spaced frequencies
     */
    evaluateMagnitudeResponse(filters, numPoints = 256, sampleRate = 48000) {
        const points = [];
        const minLog = Math.log10(20);
        const maxLog = Math.log10(20000);

        for (let i = 0; i < numPoints; i++) {
            const freq = Math.pow(10, minLog + (i / (numPoints - 1)) * (maxLog - minLog));
            const w = (2.0 * Math.PI * freq) / sampleRate;
            const cosW = Math.cos(w);
            const cos2W = Math.cos(2.0 * w);
            const sinW = Math.sin(w);
            const sin2W = Math.sin(2.0 * w);

            let totalMagDb = 0.0;

            for (const f of filters) {
                if (!f.enabled) continue;
                // |H(e^jw)|^2 = (b0 + b1*e^-jw + b2*e^-j2w) / (1 + a1*e^-jw + a2*e^-j2w)
                const numReal = f.b0 + f.b1 * cosW + f.b2 * cos2W;
                const numImag = -f.b1 * sinW - f.b2 * sin2W;
                const denReal = 1.0 + f.a1 * cosW + f.a2 * cos2W;
                const denImag = -f.a1 * sinW - f.a2 * sin2W;

                const numMagSq = numReal * numReal + numImag * numImag;
                const denMagSq = denReal * denReal + denImag * denImag;

                if (denMagSq > 1e-12) {
                    totalMagDb += 10.0 * Math.log10(numMagSq / denMagSq);
                }
            }

            points.push({ freq, gainDb: totalMagDb });
        }

        return points;
    }
}
