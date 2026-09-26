/**
 * High-Precision Frequency Spectrum & Long-Term Average Spectrum (LTAS) Analyzer
 * Computes average frequency response, 1/3-octave energy bins,
 * and the EQ Difference Curve (Reference - Target).
 */

import { LUFSMeter } from './lufsMeter.js';

export const ISO_31_BANDS = [
    20, 25, 31.5, 40, 50, 63, 80, 100,
    125, 160, 200, 250, 315, 400, 500, 630,
    800, 1000, 1250, 1600, 2000, 2500, 3150, 4000,
    5000, 6300, 8000, 10000, 12500, 16000, 18500, 20000
];

export class AudioTrackAnalyzer {
    constructor() {
        this.fftSize = 4096;
        this.halfFft = this.fftSize / 2;
        this.lufsMeter = new LUFSMeter();
        this.hannWindow = new Float32Array(this.fftSize);
        for (let i = 0; i < this.fftSize; i++) {
            this.hannWindow[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (this.fftSize - 1)));
        }
    }

    /**
     * Complete analysis of an AudioBuffer (spectral LTAS + LUFS + Dynamics)
     */
    async analyze(audioBuffer, onProgress = null) {
        const sampleRate = audioBuffer.sampleRate;
        const channelL = audioBuffer.getChannelData(0);
        const channelR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : channelL;
        const totalSamples = channelL.length;

        // 1. Calculate Loudness and Dynamics
        if (onProgress) onProgress(0.1, 'Analyzing loudness & dynamic range...');
        const dynamics = this.lufsMeter.analyzeAudioBuffer(audioBuffer);

        // 2. Perform LTAS (Long Term Average Spectrum) across entire track
        if (onProgress) onProgress(0.3, 'Computing spectral frequency profile...');
        const hopSize = this.fftSize; // non-overlapping or 50% overlap for speed across large files
        const numHops = Math.max(1, Math.floor((totalSamples - this.fftSize) / hopSize));

        const avgPowerSpectrum = new Float64Array(this.halfFft);
        let activeWindows = 0;

        const inputReal = new Float32Array(this.fftSize);
        const inputImag = new Float32Array(this.fftSize);

        for (let hop = 0; hop < numHops; hop++) {
            const offset = hop * hopSize;

            // Check if window is not complete silence
            let sumSq = 0;
            for (let i = 0; i < this.fftSize; i++) {
                const s = 0.5 * (channelL[offset + i] + channelR[offset + i]);
                inputReal[i] = s * this.hannWindow[i];
                inputImag[i] = 0.0;
                sumSq += s * s;
            }

            const rms = Math.sqrt(sumSq / this.fftSize);
            // Skip silent windows (below -70 dB)
            if (rms < 0.0003) continue;

            // Compute FFT
            this.fftRadix2(inputReal, inputImag);

            // Accumulate power spectrum
            for (let k = 0; k < this.halfFft; k++) {
                const re = inputReal[k];
                const im = inputImag[k];
                avgPowerSpectrum[k] += re * re + im * im;
            }
            activeWindows++;

            if (onProgress && hop % 40 === 0) {
                const p = 0.3 + 0.6 * (hop / numHops);
                onProgress(p, `Analyzing frequency response (${Math.round((hop / numHops) * 100)}%)...`);
            }
        }

        // Convert power spectrum to dBFS
        const spectrumDb = new Float32Array(this.halfFft);
        const norm = activeWindows > 0 ? 1.0 / (activeWindows * (this.fftSize / 2)) : 1.0;
        for (let k = 0; k < this.halfFft; k++) {
            const p = avgPowerSpectrum[k] * norm;
            spectrumDb[k] = p > 1e-12 ? 10.0 * Math.log10(p) : -120.0;
        }

        // 3. Map to standard 32 ISO 1/3-octave bands
        if (onProgress) onProgress(0.95, 'Mapping frequency bands...');
        const isoBandEnergies = this.mapToIsoBands(spectrumDb, sampleRate);

        if (onProgress) onProgress(1.0, 'Analysis complete');

        return {
            duration: audioBuffer.duration,
            sampleRate: sampleRate,
            channels: audioBuffer.numberOfChannels,
            dynamics: dynamics,
            spectrumDb: spectrumDb, // full FFT resolution bins
            isoBandEnergies: isoBandEnergies // 32 ISO band values in dB
        };
    }

    /**
     * Map full FFT spectrum into standard 32 ISO 1/3-octave bands
     */
    mapToIsoBands(spectrumDb, sampleRate) {
        const binWidthHz = (sampleRate / 2) / this.halfFft;
        const bandValues = new Float32Array(ISO_31_BANDS.length);

        for (let i = 0; i < ISO_31_BANDS.length; i++) {
            const centerHz = ISO_31_BANDS[i];
            // 1/3 octave band limits: fl = f0 * 2^(-1/6), fh = f0 * 2^(+1/6)
            const fl = centerHz * 0.8908987;
            const fh = centerHz * 1.1224620;

            const startBin = Math.max(0, Math.floor(fl / binWidthHz));
            const endBin = Math.min(this.halfFft - 1, Math.ceil(fh / binWidthHz));

            let powerSum = 0;
            let count = 0;
            for (let b = startBin; b <= endBin; b++) {
                powerSum += Math.pow(10.0, spectrumDb[b] / 10.0);
                count++;
            }

            if (count > 0 && powerSum > 1e-12) {
                bandValues[i] = 10.0 * Math.log10(powerSum / count);
            } else {
                bandValues[i] = -100.0;
            }
        }

        return bandValues;
    }

    /**
     * Generate EQ Difference Curve: Reference - Target
     * Normalizes overall loudness offset so the EQ curve only shapes tonal balance.
     */
    computeDifferenceCurve(targetAnalysis, referenceAnalysis, smoothingFactor = 0.5) {
        const targetBands = targetAnalysis.isoBandEnergies;
        const refBands = referenceAnalysis.isoBandEnergies;
        const numBands = ISO_31_BANDS.length;

        // 1. Calculate average mid-frequency energy (300 Hz - 3000 Hz) to normalize tonal baseline
        let targetMidSum = 0, refMidSum = 0, midCount = 0;
        for (let i = 0; i < numBands; i++) {
            const f = ISO_31_BANDS[i];
            if (f >= 300 && f <= 3000) {
                targetMidSum += targetBands[i];
                refMidSum += refBands[i];
                midCount++;
            }
        }
        const targetMidAvg = midCount > 0 ? targetMidSum / midCount : 0;
        const refMidAvg = midCount > 0 ? refMidSum / midCount : 0;
        const tonalOffsetDb = refMidAvg - targetMidAvg;

        // 2. Raw delta per band in dB
        const rawDeltaDb = new Float32Array(numBands);
        for (let i = 0; i < numBands; i++) {
            // Subtract target from reference and remove broadband level offset
            const rawDiff = (refBands[i] - targetBands[i]) - tonalOffsetDb;
            // Safety mastering clamp: limit max boost to +12 dB and cut to -15 dB
            rawDeltaDb[i] = Math.max(-15.0, Math.min(12.0, rawDiff));
        }

        // 3. Apply Musical Smoothing (Gaussian-weighted filter) across neighboring bands
        const smoothedDeltaDb = new Float32Array(numBands);
        const radius = Math.max(1, Math.round(1 + smoothingFactor * 4)); // 1 to 5 neighbor radius

        for (let i = 0; i < numBands; i++) {
            let weightSum = 0;
            let valSum = 0;

            for (let r = -radius; r <= radius; r++) {
                const idx = i + r;
                if (idx >= 0 && idx < numBands) {
                    // Gaussian bell weighting
                    const sigma = 1.0 + smoothingFactor * 2.0;
                    const weight = Math.exp(-(r * r) / (2.0 * sigma * sigma));
                    valSum += rawDeltaDb[idx] * weight;
                    weightSum += weight;
                }
            }

            smoothedDeltaDb[i] = Math.round((valSum / weightSum) * 10) / 10;
        }

        // 4. Output Loudness Delta and Dynamics Target
        const targetLUFS = targetAnalysis.dynamics.integratedLUFS;
        const refLUFS = referenceAnalysis.dynamics.integratedLUFS;
        const deltaLoudnessDb = Math.round((refLUFS - targetLUFS) * 10) / 10;

        // Compressor matching: compare dynamic range (crest factor)
        const targetDR = targetAnalysis.dynamics.dynamicRangeDb;
        const refDR = referenceAnalysis.dynamics.dynamicRangeDb;
        const drDifference = targetDR - refDR; // positive means target is more dynamic than reference

        // Calculate suggested compressor parameters
        let suggestedCompThreshold = -16.0;
        let suggestedCompRatio = 2.0;
        if (drDifference > 4.0) {
            // Target is significantly less compressed than reference -> tighten dynamics
            suggestedCompThreshold = Math.max(-28.0, -14.0 - drDifference * 1.2);
            suggestedCompRatio = Math.min(4.5, 2.0 + drDifference * 0.3);
        } else if (drDifference < -2.0) {
            // Target is already more squashed than reference -> gentle compression
            suggestedCompThreshold = -10.0;
            suggestedCompRatio = 1.4;
        }

        return {
            rawDeltaDb,
            smoothedDeltaDb,
            tonalOffsetDb: Math.round(tonalOffsetDb * 10) / 10,
            deltaLoudnessDb,
            targetLUFS,
            referenceLUFS: refLUFS,
            suggestedCompThreshold: Math.round(suggestedCompThreshold * 10) / 10,
            suggestedCompRatio: Math.round(suggestedCompRatio * 10) / 10,
            suggestedLimiterCeiling: -0.2
        };
    }

    /**
     * In-place Radix-2 Cooley-Tukey FFT algorithm
     */
    fftRadix2(real, imag) {
        const n = real.length;

        // Bit reversal permutation
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) {
                j ^= bit;
            }
            j ^= bit;
            if (i < j) {
                const tr = real[i]; real[i] = real[j]; real[j] = tr;
                const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
            }
        }

        // Cooley-Tukey butterflies
        for (let len = 2; len <= n; len <<= 1) {
            const ang = (-2.0 * Math.PI) / len;
            const wlen_r = Math.cos(ang);
            const wlen_i = Math.sin(ang);

            for (let i = 0; i < n; i += len) {
                let w_r = 1.0;
                let w_i = 0.0;
                const halfLen = len >> 1;

                for (let j = 0; j < halfLen; j++) {
                    const u_r = real[i + j];
                    const u_i = imag[i + j];

                    const v_r = real[i + j + halfLen] * w_r - imag[i + j + halfLen] * w_i;
                    const v_i = real[i + j + halfLen] * w_i + imag[i + j + halfLen] * w_r;

                    real[i + j] = u_r + v_r;
                    imag[i + j] = u_i + v_i;
                    real[i + j + halfLen] = u_r - v_r;
                    imag[i + j + halfLen] = u_i - v_i;

                    const next_w_r = w_r * wlen_r - w_i * wlen_i;
                    w_i = w_r * wlen_i + w_i * wlen_r;
                    w_r = next_w_r;
                }
            }
        }
    }
}
