/**
 * Offline Mastering DSP Renderer
 * Renders the full target audio buffer through the WebAssembly / DSP mastering chain
 * at maximum CPU speed without real-time playback constraints.
 */

import { LUFSMeter } from './lufsMeter.js';

export class OfflineMasteringRenderer {
    /**
     * Render target audio through the exact mastering DSP chain
     * @param {AudioBuffer} targetAudioBuffer 
     * @param {Array} biquadFilters Array of 32 biquad filter configs
     * @param {Object} masterParams Master chain settings (gain, compressor, limiter)
     * @param {WebAssembly.Module} wasmModule Compiled WASM module
     * @param {Function} onProgress Progress callback (0.0 to 1.0, status text)
     * @returns {Promise<{masteredBuffer: AudioBuffer, stats: Object}>}
     */
    static async render(targetAudioBuffer, biquadFilters, masterParams, wasmModule, onProgress = null) {
        const sampleRate = targetAudioBuffer.sampleRate;
        const numChannels = 2; // Mastering is always stereo
        const length = targetAudioBuffer.length;

        if (onProgress) onProgress(0.05, 'Initializing high-speed offline DSP engine...');

        // 1. Instantiate dedicated WebAssembly instance for offline processing
        let wasmInstance = null;
        let wasmExports = null;
        let memF32 = null;

        if (wasmModule) {
            wasmInstance = await WebAssembly.instantiate(wasmModule, {
                env: { abort: () => console.error('Offline WASM aborted') }
            });
            wasmExports = wasmInstance.exports;
            memF32 = new Float32Array(wasmExports.memory.buffer);
            wasmExports.dsp_init(sampleRate);
        }

        // 2. Prepare audio buffers
        const inL = targetAudioBuffer.getChannelData(0);
        const inR = targetAudioBuffer.numberOfChannels > 1 ? targetAudioBuffer.getChannelData(1) : inL;

        // Create OfflineAudioContext or memory output buffer
        const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
        const outputBuffer = offlineCtx.createBuffer(numChannels, length, sampleRate);
        const outL = outputBuffer.getChannelData(0);
        const outR = outputBuffer.getChannelData(1);

        // 3. Configure WASM parameters
        const inputGainLin = Math.pow(10.0, (masterParams.inputGainDb || 0.0) / 20.0);
        const outputGainLin = Math.pow(10.0, (masterParams.outputGainDb || 0.0) / 20.0);
        const matchAmount = (masterParams.matchAmount !== undefined) ? masterParams.matchAmount : 1.0;

        if (wasmExports) {
            wasmExports.dsp_set_bypass(0);
            wasmExports.dsp_set_input_gain_lin(inputGainLin);
            wasmExports.dsp_set_output_gain_lin(outputGainLin);
            wasmExports.dsp_set_eq_match_amount(matchAmount);

            // Upload 32 biquad bands
            for (let i = 0; i < biquadFilters.length; i++) {
                const b = biquadFilters[i];
                wasmExports.dsp_set_eq_biquad_coeffs(
                    i,
                    b.b0, b.b1, b.b2,
                    b.a1, b.a2,
                    b.enabled ? 1 : 0
                );
            }

            // Compressor
            const compThreshDb = masterParams.compThresholdDb !== undefined ? masterParams.compThresholdDb : -16.0;
            const compRatio = masterParams.compRatio !== undefined ? masterParams.compRatio : 2.5;
            const compAttackMs = masterParams.compAttackMs !== undefined ? masterParams.compAttackMs : 25.0;
            const compReleaseMs = masterParams.compReleaseMs !== undefined ? masterParams.compReleaseMs : 150.0;
            const compMakeupDb = masterParams.compMakeupDb !== undefined ? masterParams.compMakeupDb : 0.0;

            const threshLin = Math.pow(10.0, compThreshDb / 20.0);
            const makeupLin = Math.pow(10.0, compMakeupDb / 20.0);
            const attCoeff = 1.0 - Math.exp(-1.0 / ((compAttackMs * 0.001) * sampleRate));
            const relCoeff = 1.0 - Math.exp(-1.0 / ((compReleaseMs * 0.001) * sampleRate));

            wasmExports.dsp_set_compressor(threshLin, compRatio, attCoeff, relCoeff, makeupLin);

            // Limiter
            const limCeilDb = masterParams.limiterCeilingDb !== undefined ? masterParams.limiterCeilingDb : -0.2;
            const limReleaseMs = masterParams.limiterReleaseMs !== undefined ? masterParams.limiterReleaseMs : 80.0;
            const limLookaheadMs = masterParams.limiterLookaheadMs !== undefined ? masterParams.limiterLookaheadMs : 4.0;
            const limSoftClip = masterParams.limiterSoftClip !== undefined ? masterParams.limiterSoftClip : true;

            const ceilLin = Math.pow(10.0, limCeilDb / 20.0);
            const limRelCoeff = 1.0 - Math.exp(-1.0 / ((limReleaseMs * 0.001) * sampleRate));
            const lookaheadSamples = Math.max(1, Math.min(1000, Math.floor((limLookaheadMs * 0.001) * sampleRate)));

            wasmExports.dsp_set_limiter(ceilLin, limRelCoeff, lookaheadSamples, limSoftClip ? 1 : 0);
        } else {
            // High-precision Native Web Audio Offline Rendering Fallback
            if (onProgress) onProgress(0.2, 'Rendering via Native DSP Audio Graph...');
            const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = targetAudioBuffer;

            const inGain = offlineCtx.createGain();
            inGain.gain.value = inputGainLin;
            source.connect(inGain);

            let lastNode = inGain;
            for (const b of biquadFilters) {
                if (b.enabled && Math.abs(b.gainDb || 0) > 0.01) {
                    const filter = offlineCtx.createBiquadFilter();
                    filter.type = b.type || 'peaking';
                    filter.frequency.value = b.freq;
                    filter.gain.value = (b.gainDb || 0) * matchAmount;
                    filter.Q.value = b.q || 1.4;
                    lastNode.connect(filter);
                    lastNode = filter;
                }
            }

            const comp = offlineCtx.createDynamicsCompressor();
            comp.threshold.value = masterParams.compThresholdDb !== undefined ? masterParams.compThresholdDb : -16.0;
            comp.ratio.value = masterParams.compRatio !== undefined ? masterParams.compRatio : 2.5;
            comp.attack.value = (masterParams.compAttackMs !== undefined ? masterParams.compAttackMs : 25.0) / 1000.0;
            comp.release.value = (masterParams.compReleaseMs !== undefined ? masterParams.compReleaseMs : 150.0) / 1000.0;
            lastNode.connect(comp);
            lastNode = comp;

            const outGain = offlineCtx.createGain();
            const ceil = masterParams.limiterCeilingDb !== undefined ? masterParams.limiterCeilingDb : -0.2;
            outGain.gain.value = Math.pow(10.0, ceil / 20.0);
            lastNode.connect(outGain);
            outGain.connect(offlineCtx.destination);

            source.start(0);
            const renderedBuffer = await offlineCtx.startRendering();

            if (onProgress) onProgress(0.95, 'Analyzing final master loudness & True-Peak...');
            const lufsMeter = new LUFSMeter(sampleRate);
            let finalStats = lufsMeter.analyzeAudioBuffer(renderedBuffer);

            // Optional Streaming Target Normalization Pass
            let finalBuffer = renderedBuffer;
            if (masterParams.targetLufs !== undefined && masterParams.targetLufs !== null && !isNaN(masterParams.targetLufs)) {
                const targetLufs = masterParams.targetLufs;
                const currentLufs = finalStats.integrated;
                const deltaDb = targetLufs - currentLufs;
                if (Math.abs(deltaDb) > 0.1 && Math.abs(deltaDb) <= 12.0) {
                    if (onProgress) onProgress(0.98, `Applying ${targetLufs.toFixed(1)} LUFS Streaming Normalization...`);
                    const gainLin = Math.pow(10.0, deltaDb / 20.0);
                    const ceilLin = Math.pow(10.0, (masterParams.truePeakCeilingDb !== undefined ? masterParams.truePeakCeilingDb : -1.0) / 20.0);
                    const normBuffer = offlineCtx.createBuffer(numChannels, length, sampleRate);
                    for (let ch = 0; ch < numChannels; ch++) {
                        const src = renderedBuffer.getChannelData(ch);
                        const dst = normBuffer.getChannelData(ch);
                        for (let i = 0; i < length; i++) {
                            let s = src[i] * gainLin;
                            if (Math.abs(s) > ceilLin) {
                                const sign = s >= 0 ? 1 : -1;
                                s = sign * (ceilLin + (1.0 - ceilLin) * Math.tanh((Math.abs(s) - ceilLin) / (1.2 - ceilLin)));
                            }
                            dst[i] = s;
                        }
                    }
                    finalBuffer = normBuffer;
                    finalStats = lufsMeter.analyzeAudioBuffer(finalBuffer);
                    finalStats.normalizationAppliedDb = deltaDb;
                }
            }

            if (onProgress) onProgress(1.0, 'Mastering render complete!');

            return {
                masteredBuffer: finalBuffer,
                stats: finalStats
            };
        }

        // 4. Block processing loop
        const ptrInL = wasmExports ? wasmExports.dsp_get_input_buffer_l() : 0;
        const ptrInR = wasmExports ? wasmExports.dsp_get_input_buffer_r() : 0;
        const ptrOutL = wasmExports ? wasmExports.dsp_get_output_buffer_l() : 0;
        const ptrOutR = wasmExports ? wasmExports.dsp_get_output_buffer_r() : 0;

        const inLOffset = ptrInL >> 2;
        const inROffset = ptrInR >> 2;
        const outLOffset = ptrOutL >> 2;
        const outROffset = ptrOutR >> 2;

        const CHUNK_SIZE = 2048; // Process in 2048-frame chunks for speed
        const totalChunks = Math.ceil(length / CHUNK_SIZE);

        for (let chunk = 0; chunk < totalChunks; chunk++) {
            const start = chunk * CHUNK_SIZE;
            const end = Math.min(length, start + CHUNK_SIZE);
            const numFrames = end - start;

            // Fill input buffers
            memF32.set(inL.subarray(start, end), inLOffset);
            memF32.set(inR.subarray(start, end), inROffset);

            // Execute DSP
            wasmExports.dsp_process(numFrames);

            // Copy results to output buffer
            outL.set(memF32.subarray(outLOffset, outLOffset + numFrames), start);
            outR.set(memF32.subarray(outROffset, outROffset + numFrames), start);

            if (onProgress && chunk % 20 === 0) {
                const progress = 0.1 + 0.8 * (chunk / totalChunks);
                onProgress(progress, `Rendering master (${Math.round((chunk / totalChunks) * 100)}%)...`);
            }
        }

        if (onProgress) onProgress(0.95, 'Analyzing final master loudness & True-Peak...');

        // 5. Post-render quality analysis
        const lufsMeter = new LUFSMeter(sampleRate);
        let finalStats = lufsMeter.analyzeAudioBuffer(outputBuffer);

        // 6. Optional Streaming Target Normalization Pass
        let finalBuffer = outputBuffer;
        if (masterParams.targetLufs !== undefined && masterParams.targetLufs !== null && !isNaN(masterParams.targetLufs)) {
            const targetLufs = masterParams.targetLufs;
            const currentLufs = finalStats.integrated;
            const deltaDb = targetLufs - currentLufs;
            if (Math.abs(deltaDb) > 0.1 && Math.abs(deltaDb) <= 12.0) {
                if (onProgress) onProgress(0.98, `Applying ${targetLufs.toFixed(1)} LUFS Streaming Normalization (${deltaDb >= 0 ? '+' : ''}${deltaDb.toFixed(1)} dB)...`);
                const gainLin = Math.pow(10.0, deltaDb / 20.0);
                const ceilLin = Math.pow(10.0, (masterParams.truePeakCeilingDb !== undefined ? masterParams.truePeakCeilingDb : -1.0) / 20.0);
                const normBuffer = offlineCtx.createBuffer(numChannels, length, sampleRate);
                for (let ch = 0; ch < numChannels; ch++) {
                    const src = outputBuffer.getChannelData(ch);
                    const dst = normBuffer.getChannelData(ch);
                    for (let i = 0; i < length; i++) {
                        let s = src[i] * gainLin;
                        if (Math.abs(s) > ceilLin) {
                            const sign = s >= 0 ? 1 : -1;
                            s = sign * (ceilLin + (1.0 - ceilLin) * Math.tanh((Math.abs(s) - ceilLin) / (1.2 - ceilLin)));
                        }
                        dst[i] = s;
                    }
                }
                finalBuffer = normBuffer;
                finalStats = lufsMeter.analyzeAudioBuffer(finalBuffer);
                finalStats.normalizationAppliedDb = deltaDb;
            }
        }

        if (onProgress) onProgress(1.0, 'Mastering render complete!');

        return {
            masteredBuffer: finalBuffer,
            stats: finalStats
        };
    }
}
