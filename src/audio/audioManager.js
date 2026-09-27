/**
 * Central Audio Playback & Node Routing Manager
 * Coordinates Web Audio Context, Transport controls, A/B reference switching,
 * real-time AnalyserNodes, and Wasm DSP worklet routing.
 */

import { WasmDSPBridge } from '../dsp/wasmBridge.js';
import { ModularMasteringRack } from '../dsp/modularRack.js';

export class AudioManager {
    constructor() {
        // Initialize AudioContext lazily on user gesture
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = null;
        this.wasmBridge = null;
        this.rack = null;

        // Tracks
        this.targetTrack = null;
        this.referenceTrack = null;
        this.masteredBuffer = null;

        // Decoupled Playhead Positions (Target vs Reference)
        this.isPlaying = false;
        this.isLooping = true;
        this.loopStart = 0;
        this.loopEnd = 0;
        this.startTime = 0;
        this.targetTime = 0;
        this.targetPauseOffset = 0;
        this.referenceTime = 0;
        this.referencePauseOffset = 0;

        // Active Monitor Source: 'mastered' | 'target_dry' | 'reference'
        this.monitorSource = 'mastered';
        this.monitorMatrix = 'stereo'; // 'stereo' | 'mono' | 'sides' | 'delta'
        this.isBypassed = false;
        this.isAutoGainMatch = false;
        this.currentAutoGainOffsetDb = 0;
        this.masteredLufs = null;

        // Active audio graph nodes
        this.sourceNode = null;
        this.gainMaster = null;
        this.gainTargetDry = null;
        this.gainMastered = null;
        this.gainReference = null;
        this.gainAutoMatch = null;

        // Monitor matrix nodes
        this.matrixSplitter = null;
        this.matrixMerger = null;
        this.gLL = null;
        this.gRL = null;
        this.gLR = null;
        this.gRR = null;

        // Realtime Analysers
        this.analyserTarget = null;
        this.analyserReference = null;
        this.analyserMastered = null;

        // Animation frame loop
        this.rafId = null;
        this.timeUpdateCallbacks = [];
        this.stateChangeCallbacks = [];

        // Eagerly initialize graph so rack and routing exist immediately
        this.initGraph();
    }

    initGraph() {
        if (!this.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
            try {
                const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtxClass({ latencyHint: 'interactive' });
                this.setupGraph();
                this.rack = new ModularMasteringRack(this.ctx);
                this.rack.outputNode.connect(this.gainMastered);

                this.wasmBridge = new WasmDSPBridge(this.ctx);
                this.wasmBridge.initialize().catch(err => {
                    console.warn('[AudioManager] WASM fallback mode:', err.message);
                });
            } catch (err) {
                console.warn('[AudioManager] Lazy graph init deferred to user interaction:', err.message);
            }
        }
    }

    async ensureContext() {
        if (!this.ctx) {
            this.initGraph();
        }

        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume().catch(() => {});
        }
    }

    setupGraph() {
        // Create Master Output Gain
        this.gainMaster = this.ctx.createGain();
        this.gainMaster.gain.value = 1.0;
        this.gainMaster.connect(this.ctx.destination);

        // A/B Sub-bus Gains
        this.gainTargetDry = this.ctx.createGain();
        this.gainMastered = this.ctx.createGain();
        this.gainReference = this.ctx.createGain();

        // Auto-Gain Match Leveling Node
        this.gainAutoMatch = this.ctx.createGain();
        this.gainAutoMatch.gain.value = 1.0;

        // Sub-bus summing node
        const busSum = this.ctx.createGain();

        // Realtime Spectrum Analysers
        this.analyserTarget = this.ctx.createAnalyser();
        this.analyserTarget.fftSize = 2048;
        this.analyserTarget.smoothingTimeConstant = 0.8;

        this.analyserReference = this.ctx.createAnalyser();
        this.analyserReference.fftSize = 2048;
        this.analyserReference.smoothingTimeConstant = 0.8;

        this.analyserMastered = this.ctx.createAnalyser();
        this.analyserMastered.fftSize = 2048;
        this.analyserMastered.smoothingTimeConstant = 0.8;

        // Sub-busses connect through their analysers into the bus sum
        this.gainMastered.connect(this.analyserMastered);
        this.analyserMastered.connect(busSum);

        this.gainTargetDry.connect(this.analyserTarget);
        this.analyserTarget.connect(busSum);

        this.gainReference.connect(this.analyserReference);
        this.analyserReference.connect(busSum);

        // Bus sum routes to Auto-Gain Match leveling node
        busSum.connect(this.gainAutoMatch);

        // Professional Monitor Matrix (Stereo, Mono Mid, Sides L-R)
        this.matrixSplitter = this.ctx.createChannelSplitter(2);
        this.matrixMerger = this.ctx.createChannelMerger(2);

        this.gLL = this.ctx.createGain();
        this.gRL = this.ctx.createGain();
        this.gLR = this.ctx.createGain();
        this.gRR = this.ctx.createGain();

        // Default: 1:1 Stereo
        this.gLL.gain.value = 1.0;
        this.gRL.gain.value = 0.0;
        this.gLR.gain.value = 0.0;
        this.gRR.gain.value = 1.0;

        this.gainAutoMatch.connect(this.matrixSplitter);

        // Left output sum = (L * gLL) + (R * gRL)
        this.matrixSplitter.connect(this.gLL, 0);
        this.matrixSplitter.connect(this.gRL, 1);
        this.gLL.connect(this.matrixMerger, 0, 0);
        this.gRL.connect(this.matrixMerger, 0, 0);

        // Right output sum = (L * gLR) + (R * gRR)
        this.matrixSplitter.connect(this.gLR, 0);
        this.matrixSplitter.connect(this.gRR, 1);
        this.gLR.connect(this.matrixMerger, 0, 1);
        this.gRR.connect(this.matrixMerger, 0, 1);

        this.matrixMerger.connect(this.gainMaster);

        // Stereo Splitter & Analysers for Goniometer / Phase Vectorscope
        this.splitter = this.ctx.createChannelSplitter(2);
        this.analyserL = this.ctx.createAnalyser();
        this.analyserL.fftSize = 1024;
        this.analyserR = this.ctx.createAnalyser();
        this.analyserR.fftSize = 1024;

        this.gainMaster.connect(this.splitter);
        this.splitter.connect(this.analyserL, 0);
        this.splitter.connect(this.analyserR, 1);

        this.updateBusGains();
    }

    connectWasmNode() {
        if (!this.wasmBridge || !this.wasmBridge.getWorkletNode()) return;
        const worklet = this.wasmBridge.getWorkletNode();

        // Connect Wasm Worklet into the Mastered bus
        try {
            worklet.disconnect();
        } catch (_) {}

        worklet.connect(this.gainMastered);
    }

    setTargetTrack(track) {
        this.targetTrack = track;
        if (!this.referenceTrack) {
            this.loopEnd = track.duration;
        } else {
            this.loopEnd = Math.min(this.targetTrack.duration, this.referenceTrack.duration);
        }
        this.notifyStateChange();
    }

    setReferenceTrack(track) {
        this.referenceTrack = track;
        if (this.targetTrack) {
            this.loopEnd = Math.min(this.targetTrack.duration, this.referenceTrack.duration);
        } else {
            this.loopEnd = track.duration;
        }
        this.notifyStateChange();
    }

    setMasteredBuffer(buffer) {
        this.masteredBuffer = buffer;
        this.notifyStateChange();
    }

    /**
     * Set Monitor Source for Instantaneous A/B Comparison
     * @param {'mastered' | 'target_dry' | 'reference'} source 
     */
    setMonitorSource(source) {
        const prevSource = this.monitorSource;
        this.monitorSource = source;
        this.updateBusGains();

        // Only reload buffer playback if transitioning to/from the Reference track!
        const needsBufferSwap = (prevSource === 'reference' && source !== 'reference') ||
                                (prevSource !== 'reference' && source === 'reference');

        if (this.isPlaying && needsBufferSwap) {
            // Save active timestamp to the outgoing deck
            const curTime = this.getCurrentTime();
            if (prevSource === 'reference') {
                this.referencePauseOffset = curTime;
                this.referenceTime = curTime;
            } else {
                this.targetPauseOffset = curTime;
                this.targetTime = curTime;
            }

            // Start incoming deck from ITS OWN independent cue point!
            const newOffset = (source === 'reference') ? this.referencePauseOffset : this.targetPauseOffset;
            this.startBufferPlayback(newOffset);
            this.startTime = this.ctx.currentTime - newOffset;
        }
        this.notifyStateChange();
    }

    updateBusGains() {
        if (!this.gainMastered || !this.gainTargetDry || !this.gainReference) return;

        const rampTime = 0.02; // 20ms quick crossfade to avoid pops
        const now = this.ctx ? this.ctx.currentTime : 0;

        const isDelta = this.monitorMatrix === 'delta';
        const isRef = !isDelta && this.monitorSource === 'reference';
        const isDry = !isDelta && (this.monitorSource === 'target_dry' || this.isBypassed);
        const isMaster = !isDelta && (this.monitorSource === 'mastered' && !this.isBypassed);

        if (isDelta) {
            // Delta Listen Mode: Mastered (+1.0) summed with Dry Target (-1.0 phase inverted)
            // Signal cancellation reveals purely the EQ boosts/cuts, dynamics, and saturation!
            this.gainMastered.gain.setTargetAtTime(1.0, now, rampTime);
            this.gainTargetDry.gain.setTargetAtTime(-1.0, now, rampTime);
            this.gainReference.gain.setTargetAtTime(0.0, now, rampTime);
        } else {
            this.gainMastered.gain.setTargetAtTime(isMaster ? 1.0 : 0.0, now, rampTime);
            this.gainTargetDry.gain.setTargetAtTime(isDry ? 1.0 : 0.0, now, rampTime);
            this.gainReference.gain.setTargetAtTime(isRef ? 1.0 : 0.0, now, rampTime);
        }

        // Auto-Gain Loudness Match Calculation (Defeats the Fletcher-Munson Loudness Bias)
        if (this.isAutoGainMatch && this.gainAutoMatch) {
            let offsetDb = 0;
            const targetLufs = this.targetTrack?.lufs;
            const refLufs = this.referenceTrack?.lufs;
            const masterLufs = this.masteredLufs || (targetLufs ? targetLufs + 2.5 : null);

            if (isRef && targetLufs != null && refLufs != null) {
                // Attenuate or boost reference to match target track loudness
                offsetDb = targetLufs - refLufs;
            } else if (isMaster && targetLufs != null && masterLufs != null) {
                // Attenuate or boost mastered to match target track loudness
                offsetDb = targetLufs - masterLufs;
            }

            // Clamp offset within professional safety boundary (-20 dB to +12 dB)
            const safeOffsetDb = Math.max(-20, Math.min(12, offsetDb));
            const linearMultiplier = Math.pow(10, safeOffsetDb / 20);
            this.gainAutoMatch.gain.setTargetAtTime(linearMultiplier, now, rampTime);
            this.currentAutoGainOffsetDb = safeOffsetDb;
        } else if (this.gainAutoMatch) {
            this.gainAutoMatch.gain.setTargetAtTime(1.0, now, rampTime);
            this.currentAutoGainOffsetDb = 0;
        }
    }

    /**
     * Professional Studio Monitor Matrix Switcher
     * @param {'stereo' | 'mono' | 'mid' | 'sides' | 'left_solo' | 'right_solo' | 'delta'} mode 
     */
    setMonitorMatrix(mode) {
        this.monitorMatrix = mode;
        const rampTime = 0.02;
        const now = this.ctx ? this.ctx.currentTime : 0;

        if (!this.gLL || !this.gRL || !this.gLR || !this.gRR) {
            this.notifyStateChange();
            return;
        }

        if (mode === 'mono' || mode === 'mid') {
            // Mono / Mid Solo: (L + R) * 0.5 to both Left and Right speakers
            this.gLL.gain.setTargetAtTime(0.5, now, rampTime);
            this.gRL.gain.setTargetAtTime(0.5, now, rampTime);
            this.gLR.gain.setTargetAtTime(0.5, now, rampTime);
            this.gRR.gain.setTargetAtTime(0.5, now, rampTime);
        } else if (mode === 'sides') {
            // Sides Only: (L - R) * 0.5 to Left, and (R - L) * 0.5 to Right
            this.gLL.gain.setTargetAtTime(0.5, now, rampTime);
            this.gRL.gain.setTargetAtTime(-0.5, now, rampTime);
            this.gLR.gain.setTargetAtTime(-0.5, now, rampTime);
            this.gRR.gain.setTargetAtTime(0.5, now, rampTime);
        } else if (mode === 'left_solo') {
            // Left Channel Solo: Routed to center (both speakers)
            this.gLL.gain.setTargetAtTime(1.0, now, rampTime);
            this.gRL.gain.setTargetAtTime(0.0, now, rampTime);
            this.gLR.gain.setTargetAtTime(1.0, now, rampTime);
            this.gRR.gain.setTargetAtTime(0.0, now, rampTime);
        } else if (mode === 'right_solo') {
            // Right Channel Solo: Routed to center (both speakers)
            this.gLL.gain.setTargetAtTime(0.0, now, rampTime);
            this.gRL.gain.setTargetAtTime(1.0, now, rampTime);
            this.gLR.gain.setTargetAtTime(0.0, now, rampTime);
            this.gRR.gain.setTargetAtTime(1.0, now, rampTime);
        } else {
            // Normal Stereo or Delta: 1:1 discrete channel mapping
            this.gLL.gain.setTargetAtTime(1.0, now, rampTime);
            this.gRL.gain.setTargetAtTime(0.0, now, rampTime);
            this.gLR.gain.setTargetAtTime(0.0, now, rampTime);
            this.gRR.gain.setTargetAtTime(1.0, now, rampTime);
        }

        this.updateBusGains();
        this.notifyStateChange();
    }

    /**
     * Toggle True-Loudness Match Auto-Gain (A/B Auditioning)
     * @param {boolean} enabled 
     */
    setAutoGainMatch(enabled) {
        this.isAutoGainMatch = !!enabled;
        this.updateBusGains();
        this.notifyStateChange();
    }

    setMasteredLufs(lufs) {
        this.masteredLufs = lufs;
        this.updateBusGains();
        this.notifyStateChange();
    }

    setBypass(bypass) {
        this.isBypassed = !!bypass;
        if (this.wasmBridge) {
            this.wasmBridge.setBypass(this.isBypassed);
        }
        this.updateBusGains();
        this.notifyStateChange();
    }

    setLoop(loop) {
        this.isLooping = !!loop;
        if (this.sourceNode) {
            this.sourceNode.loop = this.isLooping;
        }
        this.notifyStateChange();
    }

    setLoopRange(start, end) {
        this.loopStart = Math.max(0, start);
        this.loopEnd = Math.max(this.loopStart + 0.1, end);
        if (this.sourceNode) {
            this.sourceNode.loopStart = this.loopStart;
            this.sourceNode.loopEnd = this.loopEnd;
        }
    }

    async play() {
        await this.ensureContext();
        if (this.isPlaying) return;

        const offset = (this.monitorSource === 'reference') ? this.referencePauseOffset : this.targetPauseOffset;
        this.startBufferPlayback(offset);
        this.isPlaying = true;
        this.startTime = this.ctx.currentTime - offset;
        this.startTimeLoop();
        this.notifyStateChange();
    }

    pause() {
        if (!this.isPlaying) return;
        const cur = this.getCurrentTime();
        if (this.monitorSource === 'reference') {
            this.referencePauseOffset = cur;
            this.referenceTime = cur;
        } else {
            this.targetPauseOffset = cur;
            this.targetTime = cur;
        }
        this.stopSource();
        this.isPlaying = false;
        this.stopTimeLoop();
        this.notifyStateChange();
    }

    stop() {
        this.stopSource();
        this.targetPauseOffset = 0;
        this.targetTime = 0;
        this.isPlaying = false;
        this.stopTimeLoop();
        this.notifyTimeUpdate({
            time: 0,
            activeTrack: this.monitorSource,
            targetTime: 0,
            refTime: this.referenceTime
        });
        this.notifyStateChange();
    }

    seekTarget(timeSeconds) {
        const maxDur = this.targetTrack ? this.targetTrack.duration : 0;
        const clamped = Math.max(0, Math.min(maxDur, timeSeconds));
        this.targetPauseOffset = clamped;
        this.targetTime = clamped;

        if (this.isPlaying && this.monitorSource !== 'reference') {
            this.startBufferPlayback(clamped);
            this.startTime = this.ctx.currentTime - clamped;
        }

        this.notifyTimeUpdate(this.getTimeUpdatePayload());
    }

    seekReference(timeSeconds) {
        const maxDur = this.referenceTrack ? this.referenceTrack.duration : 0;
        const clamped = Math.max(0, Math.min(maxDur, timeSeconds));
        this.referencePauseOffset = clamped;
        this.referenceTime = clamped;

        if (this.isPlaying && this.monitorSource === 'reference') {
            this.startBufferPlayback(clamped);
            this.startTime = this.ctx.currentTime - clamped;
        }

        this.notifyTimeUpdate(this.getTimeUpdatePayload());
    }

    seek(timeSeconds) {
        if (this.monitorSource === 'reference') {
            this.seekReference(timeSeconds);
        } else {
            this.seekTarget(timeSeconds);
        }
    }

    getCurrentTime() {
        if (!this.isPlaying || !this.ctx) {
            return (this.monitorSource === 'reference') ? this.referencePauseOffset : this.targetPauseOffset;
        }
        const elapsed = this.ctx.currentTime - this.startTime;
        const duration = this.getActiveDuration();

        if (this.isLooping && duration > 0 && elapsed >= duration) {
            return elapsed % duration;
        }

        return Math.min(duration, elapsed);
    }

    getTimeUpdatePayload() {
        const isRef = this.monitorSource === 'reference';
        const cur = this.getCurrentTime();
        if (isRef) {
            this.referenceTime = cur;
        } else {
            this.targetTime = cur;
        }
        return {
            time: cur,
            activeTrack: isRef ? 'reference' : 'target',
            targetTime: this.targetTime,
            refTime: this.referenceTime
        };
    }

    getActiveDuration() {
        if (this.monitorSource === 'reference' && this.referenceTrack) {
            return this.referenceTrack.duration;
        }
        if (this.targetTrack) {
            return this.targetTrack.duration;
        }
        return 0;
    }

    startBufferPlayback(offsetSeconds = 0) {
        this.stopSource();

        // Select which audio buffer to play based on monitorSource
        let bufferToPlay = null;
        const isRef = this.monitorSource === 'reference';

        if (isRef && this.referenceTrack) {
            bufferToPlay = this.referenceTrack.audioBuffer;
        } else if (this.targetTrack) {
            bufferToPlay = this.targetTrack.audioBuffer;
        }

        if (!bufferToPlay) return;

        this.sourceNode = this.ctx.createBufferSource();
        this.sourceNode.buffer = bufferToPlay;
        this.sourceNode.loop = this.isLooping;

        const maxDuration = bufferToPlay.duration;
        const loopStart = Math.min(this.loopStart, maxDuration);
        const loopEnd = (this.loopEnd > loopStart && this.loopEnd <= maxDuration) ? this.loopEnd : maxDuration;

        this.sourceNode.loopStart = loopStart;
        this.sourceNode.loopEnd = loopEnd;

        // Routing
        if (isRef) {
            // Reference audio goes to Reference bus directly
            this.sourceNode.connect(this.gainReference);
        } else {
            // Target audio routes to BOTH:
            // 1. Target Dry bus (for instantaneous dry A/B comparison)
            this.sourceNode.connect(this.gainTargetDry);

            // 2. Modular Mastering Rack (Real-Time DSP Hardware Graph)
            if (this.rack && this.rack.inputNode) {
                this.sourceNode.connect(this.rack.inputNode);
            }
        }

        const safeOffset = Math.max(0, Math.min(maxDuration - 0.05, offsetSeconds));
        this.sourceNode.start(0, safeOffset);

        this.sourceNode.onended = () => {
            if (!this.isLooping && this.isPlaying) {
                this.stop();
            }
        };
    }

    stopSource() {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
                this.sourceNode.disconnect();
            } catch (_) {}
            this.sourceNode = null;
        }
    }

    startTimeLoop() {
        this.stopTimeLoop();
        const update = () => {
            if (this.isPlaying) {
                const cur = this.getCurrentTime();
                this.currentTime = cur;
                this.notifyTimeUpdate(cur);
                this.rafId = requestAnimationFrame(update);
            }
        };
        this.rafId = requestAnimationFrame(update);
    }

    stopTimeLoop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    onTimeUpdate(cb) {
        this.timeUpdateCallbacks.push(cb);
    }

    onStateChange(cb) {
        this.stateChangeCallbacks.push(cb);
    }

    notifyTimeUpdate(time) {
        for (const cb of this.timeUpdateCallbacks) {
            cb(time);
        }
    }

    notifyStateChange() {
        const state = {
            isPlaying: this.isPlaying,
            isLooping: this.isLooping,
            isBypassed: this.isBypassed,
            monitorSource: this.monitorSource,
            monitorMatrix: this.monitorMatrix,
            isAutoGainMatch: this.isAutoGainMatch,
            autoGainOffsetDb: this.currentAutoGainOffsetDb,
            currentTime: this.currentTime,
            duration: this.getActiveDuration(),
            hasTarget: !!this.targetTrack,
            hasReference: !!this.referenceTrack,
            hasMastered: !!this.masteredBuffer
        };
        for (const cb of this.stateChangeCallbacks) {
            cb(state);
        }
    }

    // Get real-time FFT frequency data for visualizer
    getFrequencyData(analyser) {
        if (!analyser) return null;
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        return array;
    }

    // Get stereo time-domain data for vectorscope / goniometer
    getStereoTimeDomainData() {
        if (!this.analyserL || !this.analyserR) return null;
        const left = new Float32Array(this.analyserL.fftSize);
        const right = new Float32Array(this.analyserR.fftSize);
        this.analyserL.getFloatTimeDomainData(left);
        this.analyserR.getFloatTimeDomainData(right);
        return { left, right };
    }

    /**
     * Compute Real-Time Pearson Phase Correlation Coefficient (-1.0 to +1.0)
     * r = +1.0 (Mono compatible / in-phase)
     * r = 0.0 (Wide decorrelated stereo)
     * r = -1.0 (180 deg out of phase / mono cancellation)
     */
    getPhaseCorrelation() {
        if (!this.analyserL || !this.analyserR) return 1.0;
        const left = new Float32Array(this.analyserL.fftSize);
        const right = new Float32Array(this.analyserR.fftSize);
        this.analyserL.getFloatTimeDomainData(left);
        this.analyserR.getFloatTimeDomainData(right);

        let sumLR = 0;
        let sumL2 = 0;
        let sumR2 = 0;
        const len = left.length;

        for (let i = 0; i < len; i++) {
            const l = left[i];
            const r = right[i];
            sumLR += l * r;
            sumL2 += l * l;
            sumR2 += r * r;
        }

        const denom = Math.sqrt(sumL2 * sumR2);
        if (denom < 1e-5) return 1.0;
        const r = sumLR / denom;
        return Math.max(-1.0, Math.min(1.0, r));
    }
}
