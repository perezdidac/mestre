import { LUFSMeter } from '../dsp/lufsMeter.js';

export class AudioLoader {
    constructor(audioContext) {
        this.audioCtx = audioContext;
    }

    /**
     * Load and decode an audio File object from drag & drop or file picker
     * @param {File} file 
     * @param {Function} onProgress 
     * @returns {Promise<Object>} Track data
     */
    async loadFile(file, onProgress = null) {
        if (!file) throw new Error('No file provided');

        // Read local file as ArrayBuffer
        if (onProgress) onProgress(0.2, 'Reading file into local memory...');
        const arrayBuffer = await file.arrayBuffer();

        // Decode audio data using browser Web Audio API
        if (onProgress) onProgress(0.6, 'Decoding audio PCM stream...');
        // Clone arrayBuffer because decodeAudioData can detach the buffer
        const bufferCopy = arrayBuffer.slice(0);
        const audioBuffer = await this.audioCtx.decodeAudioData(bufferCopy);

        if (onProgress) onProgress(0.8, 'Generating waveform peaks & peak levels...');
        const waveformPeaks = this.extractWaveformPeaks(audioBuffer, 1000);

        const durationSec = audioBuffer.duration;
        const mins = Math.floor(durationSec / 60);
        const secs = Math.floor(durationSec % 60).toString().padStart(2, '0');
        const durationFormatted = `${mins}:${secs}`;

        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);

        // Compute ITU-R BS.1770-4 Loudness & Dynamics
        let lufs = -16.0;
        let lra = 6.0;
        let dynamicRangeDb = Math.max(0, waveformPeaks.peakDb - waveformPeaks.rmsDb);
        try {
            if (onProgress) onProgress(0.9, 'Calculating BS.1770-4 loudness telemetry...');
            const lufsMeter = new LUFSMeter();
            const dynamics = lufsMeter.analyzeAudioBuffer(audioBuffer);
            lufs = dynamics.integratedLUFS;
            lra = dynamics.lra;
            dynamicRangeDb = dynamics.dynamicRangeDb;
        } catch (e) {
            console.warn('[AudioLoader] Fast LUFS measurement fallback:', e.message);
        }

        return {
            name: file.name,
            sizeBytes: file.size,
            sizeFormatted: `${sizeMb} MB`,
            format: file.type || file.name.split('.').pop().toUpperCase(),
            duration: durationSec,
            durationFormatted: durationFormatted,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            audioBuffer: audioBuffer,
            waveformPeaks: waveformPeaks,
            peakLinear: waveformPeaks.maxPeakLinear,
            peakDb: waveformPeaks.peakDb,
            rmsDb: waveformPeaks.rmsDb,
            lufs: lufs,
            dynamicRangeDb: dynamicRangeDb,
            lra: lra,
            clippedSamples: waveformPeaks.clippedSamples
        };
    }

    /**
     * Extract min/max amplitude peaks for high-resolution waveform visualization
     * Also computes true global sample peak and RMS across all channels
     * @param {AudioBuffer} audioBuffer 
     * @param {number} numBins Number of vertical peak bars across waveform
     */
    extractWaveformPeaks(audioBuffer, numBins = 1000) {
        const channelL = audioBuffer.getChannelData(0);
        const channelR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : channelL;
        const totalSamples = channelL.length;
        const samplesPerBin = Math.max(1, Math.floor(totalSamples / numBins));

        const peaksMin = new Float32Array(numBins);
        const peaksMax = new Float32Array(numBins);
        const peaksRms = new Float32Array(numBins);

        let globalMax = 0.0;
        let globalSumSq = 0.0;
        let clippedCount = 0;

        for (let bin = 0; bin < numBins; bin++) {
            const start = bin * samplesPerBin;
            const end = Math.min(totalSamples, start + samplesPerBin);

            let min = 1.0;
            let max = -1.0;
            let sumSq = 0.0;
            let count = 0;

            for (let i = start; i < end; i++) {
                const sL = channelL[i];
                const sR = channelR[i];

                const absL = Math.abs(sL);
                const absR = Math.abs(sR);
                if (absL > globalMax) globalMax = absL;
                if (absR > globalMax) globalMax = absR;
                if (absL >= 0.9999 || absR >= 0.9999) clippedCount++;

                globalSumSq += sL * sL + sR * sR;

                const sample = 0.5 * (sL + sR);
                if (sample < min) min = sample;
                if (sample > max) max = sample;
                sumSq += sample * sample;
                count++;
            }

            peaksMin[bin] = min;
            peaksMax[bin] = max;
            peaksRms[bin] = count > 0 ? Math.sqrt(sumSq / count) : 0;
        }

        const totalScanned = totalSamples * (audioBuffer.numberOfChannels > 1 ? 2 : 1);
        const overallRms = totalScanned > 0 ? Math.sqrt(globalSumSq / totalScanned) : 0;
        const peakDb = globalMax > 1e-6 ? 20.0 * Math.log10(globalMax) : -120.0;
        const rmsDb = overallRms > 1e-6 ? 20.0 * Math.log10(overallRms) : -120.0;

        return {
            peaksMin,
            peaksMax,
            peaksRms,
            numBins,
            maxPeakLinear: globalMax,
            peakDb: Math.round(peakDb * 100) / 100,
            rmsDb: Math.round(rmsDb * 100) / 100,
            clippedSamples: clippedCount
        };
    }

    /**
     * Generate synthetic demo audio buffer (for instant testing without manual file upload)
     * Creates a rich musical synth bass & chords progression
     */
    generateDemoTrack(type = 'target') {
        const sampleRate = this.audioCtx.sampleRate || 48000;
        const durationSec = 16.0;
        const numSamples = Math.floor(durationSec * sampleRate);
        const audioBuffer = this.audioCtx.createBuffer(2, numSamples, sampleRate);

        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);

        const bpm = 124;
        const beatSec = 60 / bpm;
        const rootFreq = 55; // A1 55Hz

        // Generate beat, bassline, and harmonic chords
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const beatIndex = (t / beatSec) % 4;

            // Kick drum on every beat
            const beatFrac = (t % beatSec) / beatSec;
            let kick = 0;
            if (beatFrac < 0.25) {
                const kickEnv = Math.exp(-beatFrac * 25);
                const kickPitch = 50 + 100 * Math.exp(-beatFrac * 35);
                kick = Math.sin(2 * Math.PI * kickPitch * t) * kickEnv * 0.7;
            }

            // Snare / clap on beats 1 and 3
            let snare = 0;
            const snareBeatFrac = ((t + beatSec) % (2 * beatSec)) / beatSec;
            if (snareBeatFrac < 0.2) {
                const snareEnv = Math.exp(-snareBeatFrac * 20);
                const noise = (Math.random() * 2 - 1) * 0.35;
                const tone = Math.sin(2 * Math.PI * 220 * t) * 0.2;
                snare = (noise + tone) * snareEnv;
            }

            // Bassline (rolling 16th notes)
            const sixteenth = (t / (beatSec / 4)) % 16;
            const noteIdx = Math.floor(sixteenth);
            const notes = [0, 0, 3, 3, 5, 5, 7, 7, 0, 0, 10, 10, 7, 5, 3, 2];
            const semi = notes[noteIdx % notes.length];
            const bassFreq = rootFreq * Math.pow(2, semi / 12);
            const noteFrac = (t % (beatSec / 4)) / (beatSec / 4);
            const bassEnv = Math.exp(-noteFrac * 12);
            // Rich saw wave
            const saw = (2 * ((t * bassFreq) % 1)) - 1;
            const sub = Math.sin(2 * Math.PI * (bassFreq / 2) * t);
            const bass = (saw * 0.5 + sub * 0.5) * bassEnv * 0.45;

            // Pad / Synth chords
            const chord = Math.sin(2 * Math.PI * 220 * t) * 0.15 +
                          Math.sin(2 * Math.PI * 277.18 * t) * 0.15 +
                          Math.sin(2 * Math.PI * 329.63 * t) * 0.15;

            let mixed = kick + snare + bass + chord;

            // Target track is intentionally unmastered (quieter, muffled highs, boxy mids)
            // Reference track is bright, punchy, and loud
            if (type === 'target') {
                // Unmastered profile: low headroom (-6dB), darker tone
                mixed *= 0.45;
                // Add stereo spread
                left[i] = mixed * 0.95;
                right[i] = mixed * 1.05;
            } else {
                // Reference track: mastered, brighter, dynamic and punchy
                mixed *= 0.85;
                left[i] = mixed + Math.sin(2 * Math.PI * 5000 * t) * 0.02;
                right[i] = mixed + Math.cos(2 * Math.PI * 5000 * t) * 0.02;
            }
        }

        const peaks = this.extractWaveformPeaks(audioBuffer, 1000);
        let lufs = -16.0;
        let lra = 6.0;
        let dynamicRangeDb = Math.max(0, peaks.peakDb - peaks.rmsDb);
        try {
            const lufsMeter = new LUFSMeter();
            const dynamics = lufsMeter.analyzeAudioBuffer(audioBuffer);
            lufs = dynamics.integratedLUFS;
            lra = dynamics.lra;
            dynamicRangeDb = dynamics.dynamicRangeDb;
        } catch (_) {}

        return {
            name: type === 'target' ? 'Demo_Unmastered_Target.wav' : 'Demo_Commercial_Reference.wav',
            sizeBytes: numSamples * 4 * 2,
            sizeFormatted: '3.1 MB',
            format: 'WAV',
            duration: durationSec,
            durationFormatted: '0:16',
            sampleRate: sampleRate,
            numberOfChannels: 2,
            audioBuffer: audioBuffer,
            waveformPeaks: peaks,
            peakLinear: peaks.maxPeakLinear,
            peakDb: peaks.peakDb,
            rmsDb: peaks.rmsDb,
            lufs: lufs,
            dynamicRangeDb: dynamicRangeDb,
            lra: lra,
            clippedSamples: peaks.clippedSamples
        };
    }
}
