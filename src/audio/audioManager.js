/**
 * Central Audio Playback & Node Routing Manager
 * Coordinates Web Audio Context, Transport controls, A/B reference switching,
 * real-time AnalyserNodes, and Wasm DSP worklet routing.
 */

import { WasmDSPBridge } from '../dsp/wasmBridge.js';

export class AudioManager {
    constructor() {
        // Initialize AudioContext lazily on user gesture
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = null;
        this.wasmBridge = null;

        // Tracks
        this.targetTrack = null;
        this.referenceTrack = null;
        this.masteredBuffer = null;

        // Playback state
        this.isPlaying = false;
        this.isLooping = true;
        this.loopStart = 0;
        this.loopEnd = 0;
        this.currentTime = 0;
        this.startTime = 0;
        this.pauseOffset = 0;

        // Active Monitor Source: 'mastered' | 'target_dry' | 'reference'
        this.monitorSource = 'mastered';
        this.isBypassed = false;

        // Active audio graph nodes
        this.sourceNode = null;
        this.gainMaster = null;
        this.gainTargetDry = null;
        this.gainMastered = null;
        this.gainReference = null;

        // Realtime Analysers
        this.analyserTarget = null;
        this.analyserReference = null;
        this.analyserMastered = null;

        // Animation frame loop
        this.rafId = null;
        this.timeUpdateCallbacks = [];
        this.stateChangeCallbacks = [];
    }

    async ensureContext() {
        if (!this.ctx) {
            this.ctx = new AudioContext({ latencyHint: 'interactive' });
            this.setupGraph();
            this.wasmBridge = new WasmDSPBridge(this.ctx);
            await this.wasmBridge.initialize();
            this.connectWasmNode();
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
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

        // Initial Routing: Mastered connects to analyser & master out
        this.gainMastered.connect(this.analyserMastered);
        this.analyserMastered.connect(this.gainMaster);

        this.gainTargetDry.connect(this.analyserTarget);
        this.analyserTarget.connect(this.gainMaster);

        this.gainReference.connect(this.analyserReference);
        this.analyserReference.connect(this.gainMaster);

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
        this.monitorSource = source;
        this.updateBusGains();

        // If currently playing, ensure correct buffer is playing smoothly at current time offset
        if (this.isPlaying) {
            const curTime = this.getCurrentTime();
            this.startBufferPlayback(curTime);
        }
        this.notifyStateChange();
    }

    updateBusGains() {
        if (!this.gainMastered || !this.gainTargetDry || !this.gainReference) return;

        const rampTime = 0.02; // 20ms quick crossfade to avoid pops
        const now = this.ctx ? this.ctx.currentTime : 0;

        const isRef = this.monitorSource === 'reference';
        const isDry = this.monitorSource === 'target_dry' || this.isBypassed;
        const isMaster = this.monitorSource === 'mastered' && !this.isBypassed;

        this.gainMastered.gain.setTargetAtTime(isMaster ? 1.0 : 0.0, now, rampTime);
        this.gainTargetDry.gain.setTargetAtTime(isDry ? 1.0 : 0.0, now, rampTime);
        this.gainReference.gain.setTargetAtTime(isRef ? 1.0 : 0.0, now, rampTime);
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

        this.startBufferPlayback(this.pauseOffset);
        this.isPlaying = true;
        this.startTime = this.ctx.currentTime - this.pauseOffset;
        this.startTimeLoop();
        this.notifyStateChange();
    }

    pause() {
        if (!this.isPlaying) return;
        this.pauseOffset = this.getCurrentTime();
        this.stopSource();
        this.isPlaying = false;
        this.stopTimeLoop();
        this.notifyStateChange();
    }

    stop() {
        this.stopSource();
        this.pauseOffset = 0;
        this.currentTime = 0;
        this.isPlaying = false;
        this.stopTimeLoop();
        this.notifyTimeUpdate(0);
        this.notifyStateChange();
    }

    seek(timeSeconds) {
        const duration = this.getActiveDuration();
        const clamped = Math.max(0, Math.min(duration, timeSeconds));
        this.pauseOffset = clamped;
        this.currentTime = clamped;

        if (this.isPlaying) {
            this.startBufferPlayback(clamped);
            this.startTime = this.ctx.currentTime - clamped;
        }

        this.notifyTimeUpdate(clamped);
    }

    getCurrentTime() {
        if (!this.isPlaying || !this.ctx) return this.pauseOffset;
        const elapsed = this.ctx.currentTime - this.startTime;
        const duration = this.getActiveDuration();

        if (this.isLooping && this.loopEnd > this.loopStart && elapsed >= this.loopEnd) {
            const loopLen = this.loopEnd - this.loopStart;
            const over = elapsed - this.loopStart;
            return this.loopStart + (over % loopLen);
        }

        return Math.min(duration, elapsed);
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
            // 1. Target Dry bus (for dry A/B comparison)
            this.sourceNode.connect(this.gainTargetDry);

            // 2. Wasm Worklet DSP node (for Mastered Target)
            if (this.wasmBridge && this.wasmBridge.getWorkletNode()) {
                this.sourceNode.connect(this.wasmBridge.getWorkletNode());
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
}
