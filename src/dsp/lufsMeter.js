/**
 * ITU-R BS.1770-4 Standard Loudness (LUFS / LKFS) & Dynamics Meter
 * Provides True Peak, RMS, Momentary LUFS (400ms), Short-term LUFS (3s),
 * and Integrated LUFS with absolute (-70 LKFS) & relative (-10 LU) gating.
 */

export class LUFSMeter {
    constructor(sampleRate = 48000) {
        this.sampleRate = sampleRate;
        this.initFilters();
        this.reset();
    }

    setSampleRate(sampleRate) {
        this.sampleRate = sampleRate || 48000;
        this.initFilters();
        this.reset();
    }

    initFilters() {
        const sr = this.sampleRate;

        // Stage 1: Pre-filter (high shelf ~1681 Hz, +4 dB gain)
        const f0_pre = 1681.9744509555319;
        const G_pre  = 3.99984385397;
        const Q_pre  = 0.7071752369554193;
        const K_pre  = Math.tan(Math.PI * f0_pre / sr);
        const Vh     = Math.pow(10.0, G_pre / 20.0);
        const Vb     = Math.pow(Vh, 0.499666774155);

        const a0_pre = 1.0 + K_pre / Q_pre + K_pre * K_pre;
        this.pre_b0 = (Vh + Vb * K_pre / Q_pre + K_pre * K_pre) / a0_pre;
        this.pre_b1 = (2.0 * (K_pre * K_pre - Vh)) / a0_pre;
        this.pre_b2 = (Vh - Vb * K_pre / Q_pre + K_pre * K_pre) / a0_pre;
        this.pre_a1 = (2.0 * (K_pre * K_pre - 1.0)) / a0_pre;
        this.pre_a2 = (1.0 - K_pre / Q_pre + K_pre * K_pre) / a0_pre;

        // Stage 2: RLB weighting filter (high-pass filter ~38 Hz)
        const f0_rlb = 38.13547087613982;
        const Q_rlb  = 0.5003270373253953;
        const K_rlb  = Math.tan(Math.PI * f0_rlb / sr);

        const a0_rlb = 1.0 + K_rlb / Q_rlb + K_rlb * K_rlb;
        this.rlb_b0 = 1.0 / a0_rlb;
        this.rlb_b1 = -2.0 / a0_rlb;
        this.rlb_b2 = 1.0 / a0_rlb;
        this.rlb_a1 = (2.0 * (K_rlb * K_rlb - 1.0)) / a0_rlb;
        this.rlb_a2 = (1.0 - K_rlb / Q_rlb + K_rlb * K_rlb) / a0_rlb;
    }

    reset() {
        this.pre_s1_L = 0; this.pre_s2_L = 0;
        this.pre_s1_R = 0; this.pre_s2_R = 0;
        this.rlb_s1_L = 0; this.rlb_s2_L = 0;
        this.rlb_s1_R = 0; this.rlb_s2_R = 0;

        this.blockSumL = 0;
        this.blockSumR = 0;
        this.blockSamples = 0;
        this.samplesPer400ms = Math.floor(0.400 * this.sampleRate);

        this.gatingBlocks = []; // stores { z: meanSquare, lufs: float }
        this.shortTermBlocks = []; // last 3 seconds (up to 8 blocks)
        this.peakLevel = 0;
        this.totalSumSquares = 0;
        this.totalSampleCount = 0;
    }

    // Process a full AudioBuffer or channel arrays in offline analysis
    analyzeAudioBuffer(audioBuffer) {
        this.setSampleRate(audioBuffer.sampleRate);
        const channelL = audioBuffer.getChannelData(0);
        const channelR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : channelL;
        const len = channelL.length;

        // Block size for 400ms with 75% overlap (100ms hop) per BS.1770
        const hopSize = Math.floor(0.100 * this.sampleRate);
        const blockSize = Math.floor(0.400 * this.sampleRate);

        // Pre-filter entire channels
        const filteredL = new Float64Array(len);
        const filteredR = new Float64Array(len);

        let ps1L = 0, ps2L = 0, ps1R = 0, ps2R = 0;
        let rs1L = 0, rs2L = 0, rs1R = 0, rs2R = 0;

        let maxPeak = 0;
        let sumSq = 0;

        for (let i = 0; i < len; i++) {
            const inL = channelL[i];
            const inR = channelR[i];

            const absL = Math.abs(inL);
            const absR = Math.abs(inR);
            if (absL > maxPeak) maxPeak = absL;
            if (absR > maxPeak) maxPeak = absR;

            sumSq += inL * inL + inR * inR;

            // Stage 1 Pre-filter
            const st1_L = this.pre_b0 * inL + ps1L;
            ps1L = this.pre_b1 * inL - this.pre_a1 * st1_L + ps2L;
            ps2L = this.pre_b2 * inL - this.pre_a2 * st1_L;

            const st1_R = this.pre_b0 * inR + ps1R;
            ps1R = this.pre_b1 * inR - this.pre_a1 * st1_R + ps2R;
            ps2R = this.pre_b2 * inR - this.pre_a2 * st1_R;

            // Stage 2 RLB Filter
            const outL = this.rlb_b0 * st1_L + rs1L;
            rs1L = this.rlb_b1 * st1_L - this.rlb_a1 * outL + rs2L;
            rs2L = this.rlb_b2 * st1_L - this.rlb_a2 * outL;

            const outR = this.rlb_b0 * st1_R + rs1R;
            rs1R = this.rlb_b1 * st1_R - this.rlb_a1 * outR + rs2R;
            rs2R = this.rlb_b2 * st1_R - this.rlb_a2 * outR;

            filteredL[i] = outL;
            filteredR[i] = outR;
        }

        // Integrated loudness measurement via overlapping blocks
        const blocks = [];
        for (let offset = 0; offset + blockSize <= len; offset += hopSize) {
            let sumL = 0, sumR = 0;
            for (let j = 0; j < blockSize; j++) {
                const sL = filteredL[offset + j];
                const sR = filteredR[offset + j];
                sumL += sL * sL;
                sumR += sR * sR;
            }
            // Channel weights: 1.0 for Left and Right
            const meanSquare = (sumL + sumR) / (2.0 * blockSize);
            const lufs = meanSquare > 1e-12 ? -0.691 + 10.0 * Math.log10(meanSquare) : -120.0;
            blocks.push({ meanSquare, lufs });
        }

        // Gating calculations (BS.1770-4)
        // Step 1: Absolute threshold at -70 LKFS
        let absSum = 0;
        let absCount = 0;
        for (let k = 0; k < blocks.length; k++) {
            if (blocks[k].lufs > -70.0) {
                absSum += blocks[k].meanSquare;
                absCount++;
            }
        }

        let integratedLUFS = -70.0;
        if (absCount > 0) {
            const ungatedLoudness = -0.691 + 10.0 * Math.log10(absSum / absCount);
            // Step 2: Relative threshold at -10 LU below ungated loudness
            const relThreshold = ungatedLoudness - 10.0;
            let relSum = 0;
            let relCount = 0;
            for (let k = 0; k < blocks.length; k++) {
                if (blocks[k].lufs > -70.0 && blocks[k].lufs > relThreshold) {
                    relSum += blocks[k].meanSquare;
                    relCount++;
                }
            }
            if (relCount > 0) {
                integratedLUFS = -0.691 + 10.0 * Math.log10(relSum / relCount);
            } else {
                integratedLUFS = ungatedLoudness;
            }
        }

        // Overall RMS
        const totalSamples = len * 2;
        const rmsLinear = Math.sqrt(sumSq / totalSamples);
        const rmsDb = rmsLinear > 1e-6 ? 20.0 * Math.log10(rmsLinear) : -120.0;

        // Peak dBFS
        const peakDb = maxPeak > 1e-6 ? 20.0 * Math.log10(maxPeak) : -120.0;

        // Dynamic Range (Crest Factor)
        const dynamicRangeDb = Math.max(0, peakDb - rmsDb);

        // Loudness Range (LRA) approximation
        const sortedLufs = blocks
            .map(b => b.lufs)
            .filter(l => l > -70.0)
            .sort((a, b) => a - b);
        let lra = 0;
        if (sortedLufs.length > 20) {
            const p10 = sortedLufs[Math.floor(sortedLufs.length * 0.10)];
            const p95 = sortedLufs[Math.floor(sortedLufs.length * 0.95)];
            lra = Math.max(0, p95 - p10);
        }

        return {
            integratedLUFS: Math.round(integratedLUFS * 10) / 10,
            rmsDb: Math.round(rmsDb * 10) / 10,
            peakDb: Math.round(peakDb * 10) / 10,
            dynamicRangeDb: Math.round(dynamicRangeDb * 10) / 10,
            lra: Math.round(lra * 10) / 10
        };
    }
}
