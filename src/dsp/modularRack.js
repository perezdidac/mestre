/**
 * Modular Mastering Rack & DSP Processing Chain
 * Implements a dynamic, real-time Web Audio API signal processing chain
 * where processors can be added, removed, reordered, and fine-tuned manually.
 */

export class ModularMasteringRack {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.inputNode = this.ctx.createGain();
        this.outputNode = this.ctx.createGain();
        this.modules = [];
        this.nextModuleId = 1;

        // Telemetry callbacks
        this.onTelemetryUpdate = null;

        // Initialize default professional mastering chain
        this.initDefaultChain();
    }

    initDefaultChain() {
        // Module 1: Parametric Match EQ
        this.addModule('parametric_eq', null, {
            name: 'Match Parametric EQ',
            matchAmount: 1.0,
            smoothing: 0.5,
            bands: [
                { id: 'sub', type: 'lowshelf', freq: 40, gain: 0.0, q: 0.71, enabled: true },
                { id: 'low', type: 'peaking', freq: 120, gain: 0.0, q: 1.4, enabled: true },
                { id: 'low_mid', type: 'peaking', freq: 350, gain: 0.0, q: 1.4, enabled: true },
                { id: 'mid', type: 'peaking', freq: 1000, gain: 0.0, q: 1.4, enabled: true },
                { id: 'high_mid', type: 'peaking', freq: 3200, gain: 0.0, q: 1.4, enabled: true },
                { id: 'presence', type: 'peaking', freq: 6500, gain: 0.0, q: 1.4, enabled: true },
                { id: 'air', type: 'highshelf', freq: 12000, gain: 0.0, q: 0.71, enabled: true }
            ]
        });

        // Module 2: 4-Band Multi-Channel Compressor
        this.addModule('multiband_compressor', null, {
            name: '4-Band Multi-Channel Compressor',
            channelMode: 'stereo'
        });

        // Module 3: VCA Master Compressor
        this.addModule('master_compressor', null, {
            name: 'VCA Master Compressor',
            threshold: -16.0,
            ratio: 2.5,
            attack: 25.0,
            release: 150.0,
            knee: 6.0,
            makeup: 1.0,
            mix: 100.0
        });

        // Module 4: Tube Saturation & Warmth
        this.addModule('tube_saturator', null, {
            name: 'Analog Tube Warmth',
            drive: 15.0,
            warmth: 40.0,
            mix: 50.0,
            outputGain: 0.0
        });

        // Module 5: Stereo Imager & Mono Bass
        this.addModule('stereo_imager', null, {
            name: 'Stereo Imager & Widener',
            width: 115.0, // 115% width
            monoBassFreq: 90.0 // Mono under 90Hz
        });

        // Module 6: Lookahead Brickwall Peak Limiter
        this.addModule('lookahead_limiter', null, {
            name: 'Brickwall True-Peak Limiter',
            ceiling: -0.2,
            release: 80.0,
            softClip: true,
            drive: 0.0
        });

        this.reconnectChain();
    }

    /**
     * Add a processor module to the chain
     * @param {'parametric_eq' | 'multiband_compressor' | 'master_compressor' | 'opto_compressor' | 'tube_saturator' | 'stereo_imager' | 'lookahead_limiter'} type 
     * @param {number|null} index Position in chain, or null for end
     * @param {Object} initialParams 
     * @returns {Object} Created module descriptor
     */
    addModule(type, index = null, initialParams = {}) {
        const id = `mod_${this.nextModuleId++}_${type}`;
        let moduleObj = null;

        switch (type) {
            case 'parametric_eq':
                moduleObj = this.createParametricEqModule(id, initialParams);
                break;
            case 'multiband_compressor':
                moduleObj = this.createMultibandCompressorModule(id, initialParams);
                break;
            case 'master_compressor':
                moduleObj = this.createMasterCompressorModule(id, initialParams);
                break;
            case 'opto_compressor':
                moduleObj = this.createOptoCompressorModule(id, initialParams);
                break;
            case 'tube_saturator':
                moduleObj = this.createTubeSaturatorModule(id, initialParams);
                break;
            case 'stereo_imager':
                moduleObj = this.createStereoImagerModule(id, initialParams);
                break;
            case 'lookahead_limiter':
                moduleObj = this.createLimiterModule(id, initialParams);
                break;
            default:
                console.error(`Unknown module type: ${type}`);
                return null;
        }

        if (index === null || index >= this.modules.length) {
            this.modules.push(moduleObj);
        } else {
            this.modules.splice(Math.max(0, index), 0, moduleObj);
        }

        this.reconnectChain();
        return moduleObj;
    }

    removeModule(moduleId) {
        const idx = this.modules.findIndex(m => m.id === moduleId);
        if (idx !== -1) {
            const [removed] = this.modules.splice(idx, 1);
            try {
                removed.input.disconnect();
                removed.output.disconnect();
            } catch (_) {}
            this.reconnectChain();
            return true;
        }
        return false;
    }

    moveModule(moduleId, direction) {
        const idx = this.modules.findIndex(m => m.id === moduleId);
        if (idx === -1) return false;

        const targetIdx = direction === 'left' || direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= this.modules.length) return false;

        const [item] = this.modules.splice(idx, 1);
        this.modules.splice(targetIdx, 0, item);
        this.reconnectChain();
        return true;
    }

    reorderModule(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.modules.length) return false;
        if (toIndex < 0 || toIndex >= this.modules.length) return false;
        if (fromIndex === toIndex) return false;

        const [item] = this.modules.splice(fromIndex, 1);
        this.modules.splice(toIndex, 0, item);
        this.reconnectChain();
        return true;
    }

    setModuleBypass(moduleId, bypassed) {
        const mod = this.modules.find(m => m.id === moduleId);
        if (!mod) return;
        mod.bypassed = !!bypassed;
        this.updateModuleBypassGains(mod);
    }

    setModuleParam(moduleId, paramName, value) {
        const mod = this.modules.find(m => m.id === moduleId);
        if (!mod || !mod.setParam) return;
        mod.setParam(paramName, value);
    }

    updateModuleBypassGains(mod) {
        const now = this.ctx.currentTime;
        const ramp = 0.02;
        if (mod.dryGain && mod.wetGain) {
            if (mod.bypassed) {
                mod.dryGain.gain.setTargetAtTime(1.0, now, ramp);
                mod.wetGain.gain.setTargetAtTime(0.0, now, ramp);
            } else {
                const wetLevel = (mod.params.mix !== undefined) ? (mod.params.mix / 100.0) : 1.0;
                const dryLevel = (mod.params.mix !== undefined) ? (1.0 - wetLevel) : 0.0;
                mod.dryGain.gain.setTargetAtTime(dryLevel, now, ramp);
                mod.wetGain.gain.setTargetAtTime(wetLevel, now, ramp);
            }
        }
    }

    /**
     * Rebuild the audio connections across all modules in chain
     */
    reconnectChain() {
        try {
            this.inputNode.disconnect();
            for (const mod of this.modules) {
                mod.output.disconnect();
            }
        } catch (_) {}

        if (this.modules.length === 0) {
            this.inputNode.connect(this.outputNode);
            return;
        }

        // Connect inputNode -> Module 0
        this.inputNode.connect(this.modules[0].input);

        // Connect Module[i] -> Module[i+1]
        for (let i = 0; i < this.modules.length - 1; i++) {
            this.modules[i].output.connect(this.modules[i + 1].input);
        }

        // Connect last module -> outputNode
        this.modules[this.modules.length - 1].output.connect(this.outputNode);
    }

    // -------------------------------------------------------------
    // MODULE IMPLEMENTATIONS (NATIVE HARDWARE ACCELERATED WEB AUDIO)
    // -------------------------------------------------------------

    createParametricEqModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        const bandsConfig = initialParams.bands || [
            { id: 'sub', type: 'lowshelf', freq: 40, gain: 0.0, q: 0.71, enabled: true },
            { id: 'low', type: 'peaking', freq: 120, gain: 0.0, q: 1.4, enabled: true },
            { id: 'low_mid', type: 'peaking', freq: 350, gain: 0.0, q: 1.4, enabled: true },
            { id: 'mid', type: 'peaking', freq: 1000, gain: 0.0, q: 1.4, enabled: true },
            { id: 'high_mid', type: 'peaking', freq: 3200, gain: 0.0, q: 1.4, enabled: true },
            { id: 'presence', type: 'peaking', freq: 6500, gain: 0.0, q: 1.4, enabled: true },
            { id: 'air', type: 'highshelf', freq: 12000, gain: 0.0, q: 0.71, enabled: true }
        ];

        // Create biquad nodes
        const biquadNodes = [];
        let prevNode = input;

        for (const b of bandsConfig) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = b.type;
            filter.frequency.value = b.freq;
            filter.gain.value = b.enabled ? b.gain : 0.0;
            filter.Q.value = b.q;

            prevNode.connect(filter);
            prevNode = filter;
            biquadNodes.push({ config: { ...b }, node: filter });
        }

        prevNode.connect(wetGain);
        wetGain.connect(output);

        const params = {
            name: initialParams.name || 'Match Parametric EQ',
            matchAmount: initialParams.matchAmount !== undefined ? initialParams.matchAmount : 1.0,
            smoothing: initialParams.smoothing !== undefined ? initialParams.smoothing : 0.5,
            bands: biquadNodes.map(bn => bn.config),
            mix: 100
        };

        dryGain.gain.value = 0.0;
        wetGain.gain.value = 1.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            if (paramName === 'matchAmount') {
                params.matchAmount = Math.max(0, Math.min(2.0, value));
                for (const b of biquadNodes) {
                    const scaled = b.config.gain * params.matchAmount;
                    b.node.gain.setTargetAtTime(b.config.enabled ? scaled : 0.0, now, 0.02);
                }
            } else if (paramName === 'bandGain') {
                const { bandIndex, gain } = value;
                if (biquadNodes[bandIndex]) {
                    biquadNodes[bandIndex].config.gain = gain;
                    const scaled = gain * params.matchAmount;
                    biquadNodes[bandIndex].node.gain.setTargetAtTime(biquadNodes[bandIndex].config.enabled ? scaled : 0.0, now, 0.02);
                }
            } else if (paramName === 'bandFreq') {
                const { bandIndex, freq } = value;
                if (biquadNodes[bandIndex]) {
                    biquadNodes[bandIndex].config.freq = freq;
                    biquadNodes[bandIndex].node.frequency.setTargetAtTime(freq, now, 0.02);
                }
            } else if (paramName === 'bandQ') {
                const { bandIndex, q } = value;
                if (biquadNodes[bandIndex]) {
                    biquadNodes[bandIndex].config.q = q;
                    biquadNodes[bandIndex].node.Q.setTargetAtTime(q, now, 0.02);
                }
            } else if (paramName === 'bandToggle') {
                const { bandIndex, enabled } = value;
                if (biquadNodes[bandIndex]) {
                    biquadNodes[bandIndex].config.enabled = !!enabled;
                    const targetGain = enabled ? (biquadNodes[bandIndex].config.gain * params.matchAmount) : 0.0;
                    biquadNodes[bandIndex].node.gain.setTargetAtTime(targetGain, now, 0.02);
                }
            } else if (paramName === 'allBands') {
                // Apply array of band values
                for (let i = 0; i < Math.min(biquadNodes.length, value.length); i++) {
                    const cfg = value[i];
                    biquadNodes[i].config.gain = cfg.gain;
                    biquadNodes[i].config.freq = cfg.freq || biquadNodes[i].config.freq;
                    biquadNodes[i].config.q = cfg.q || biquadNodes[i].config.q;
                    biquadNodes[i].config.enabled = cfg.enabled !== undefined ? cfg.enabled : true;

                    const effectiveGain = biquadNodes[i].config.enabled ? (biquadNodes[i].config.gain * params.matchAmount) : 0.0;
                    biquadNodes[i].node.gain.setTargetAtTime(effectiveGain, now, 0.02);
                    biquadNodes[i].node.frequency.setTargetAtTime(biquadNodes[i].config.freq, now, 0.02);
                }
            }
        };

        return {
            id,
            type: 'parametric_eq',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            biquadNodes,
            params,
            setParam
        };
    }

    createMasterCompressorModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        const comp = this.ctx.createDynamicsCompressor();
        const makeup = this.ctx.createGain();

        input.connect(comp);
        comp.connect(makeup);
        makeup.connect(wetGain);
        wetGain.connect(output);

        const params = {
            name: initialParams.name || 'VCA Master Compressor',
            threshold: initialParams.threshold !== undefined ? initialParams.threshold : -16.0,
            ratio: initialParams.ratio !== undefined ? initialParams.ratio : 2.5,
            attack: initialParams.attack !== undefined ? initialParams.attack : 25.0,
            release: initialParams.release !== undefined ? initialParams.release : 150.0,
            knee: initialParams.knee !== undefined ? initialParams.knee : 6.0,
            makeup: initialParams.makeup !== undefined ? initialParams.makeup : 1.0,
            mix: initialParams.mix !== undefined ? initialParams.mix : 100.0
        };

        comp.threshold.value = params.threshold;
        comp.ratio.value = params.ratio;
        comp.attack.value = params.attack / 1000.0;
        comp.release.value = params.release / 1000.0;
        comp.knee.value = params.knee;
        makeup.gain.value = Math.pow(10.0, params.makeup / 20.0);

        dryGain.gain.value = 1.0 - (params.mix / 100.0);
        wetGain.gain.value = params.mix / 100.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            switch (paramName) {
                case 'threshold':
                    comp.threshold.setTargetAtTime(value, now, 0.02);
                    break;
                case 'ratio':
                    comp.ratio.setTargetAtTime(value, now, 0.02);
                    break;
                case 'attack':
                    comp.attack.setTargetAtTime(Math.max(0.0001, value / 1000.0), now, 0.02);
                    break;
                case 'release':
                    comp.release.setTargetAtTime(Math.max(0.001, value / 1000.0), now, 0.02);
                    break;
                case 'knee':
                    comp.knee.setTargetAtTime(value, now, 0.02);
                    break;
                case 'makeup':
                    makeup.gain.setTargetAtTime(Math.pow(10.0, value / 20.0), now, 0.02);
                    break;
                case 'mix':
                    const wet = value / 100.0;
                    dryGain.gain.setTargetAtTime(1.0 - wet, now, 0.02);
                    wetGain.gain.setTargetAtTime(wet, now, 0.02);
                    break;
            }
        };

        return {
            id,
            type: 'master_compressor',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            compNode: comp,
            params,
            setParam,
            getReduction: () => comp.reduction
        };
    }

    createMultibandCompressorModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        const xovers = initialParams.crossovers || [150, 1200, 6000];
        const bandConfigs = initialParams.bands || [
            { id: 'low', name: 'Low (Sub/Bass)', range: '20 - 150 Hz', threshold: -18.0, ratio: 3.0, attack: 30.0, release: 200.0, knee: 6.0, makeup: 1.0, solo: false, bypassed: false },
            { id: 'low_mid', name: 'Low-Mid (Body)', range: '150 - 1.2 kHz', threshold: -16.0, ratio: 2.5, attack: 20.0, release: 150.0, knee: 6.0, makeup: 0.5, solo: false, bypassed: false },
            { id: 'high_mid', name: 'High-Mid (Presence)', range: '1.2 - 6 kHz', threshold: -14.0, ratio: 2.0, attack: 10.0, release: 100.0, knee: 6.0, makeup: 0.5, solo: false, bypassed: false },
            { id: 'high', name: 'High (Air/Sizzle)', range: '6 - 20 kHz', threshold: -12.0, ratio: 1.8, attack: 5.0, release: 60.0, knee: 6.0, makeup: 0.0, solo: false, bypassed: false }
        ];

        // 4-band filter crossovers using Linkwitz-Riley cascaded biquads
        // Band 0 (Low): Lowpass @ xovers[0]
        const lp0a = this.ctx.createBiquadFilter();
        lp0a.type = 'lowpass';
        lp0a.frequency.value = xovers[0];
        lp0a.Q.value = 0.707;
        const lp0b = this.ctx.createBiquadFilter();
        lp0b.type = 'lowpass';
        lp0b.frequency.value = xovers[0];
        lp0b.Q.value = 0.707;
        input.connect(lp0a);
        lp0a.connect(lp0b);

        // Band 1 (Low-Mid): Highpass @ xovers[0] + Lowpass @ xovers[1]
        const hp1 = this.ctx.createBiquadFilter();
        hp1.type = 'highpass';
        hp1.frequency.value = xovers[0];
        hp1.Q.value = 0.707;
        const lp1 = this.ctx.createBiquadFilter();
        lp1.type = 'lowpass';
        lp1.frequency.value = xovers[1];
        lp1.Q.value = 0.707;
        input.connect(hp1);
        hp1.connect(lp1);

        // Band 2 (High-Mid): Highpass @ xovers[1] + Lowpass @ xovers[2]
        const hp2 = this.ctx.createBiquadFilter();
        hp2.type = 'highpass';
        hp2.frequency.value = xovers[1];
        hp2.Q.value = 0.707;
        const lp2 = this.ctx.createBiquadFilter();
        lp2.type = 'lowpass';
        lp2.frequency.value = xovers[2];
        lp2.Q.value = 0.707;
        input.connect(hp2);
        hp2.connect(lp2);

        // Band 3 (High): Highpass @ xovers[2]
        const hp3a = this.ctx.createBiquadFilter();
        hp3a.type = 'highpass';
        hp3a.frequency.value = xovers[2];
        hp3a.Q.value = 0.707;
        const hp3b = this.ctx.createBiquadFilter();
        hp3b.type = 'highpass';
        hp3b.frequency.value = xovers[2];
        hp3b.Q.value = 0.707;
        input.connect(hp3a);
        hp3a.connect(hp3b);

        const filterOutputs = [lp0b, lp1, lp2, hp3b];
        const bandObjects = [];

        for (let i = 0; i < 4; i++) {
            const cfg = bandConfigs[i];
            const comp = this.ctx.createDynamicsCompressor();
            comp.threshold.value = cfg.threshold;
            comp.ratio.value = cfg.ratio;
            comp.attack.value = Math.max(0.0001, cfg.attack / 1000.0);
            comp.release.value = Math.max(0.001, cfg.release / 1000.0);
            comp.knee.value = cfg.knee;

            const makeup = this.ctx.createGain();
            makeup.gain.value = Math.pow(10.0, cfg.makeup / 20.0);

            const bandOut = this.ctx.createGain();
            bandOut.gain.value = 1.0;

            filterOutputs[i].connect(comp);
            comp.connect(makeup);
            makeup.connect(bandOut);
            bandOut.connect(wetGain);

            bandObjects.push({
                config: { ...cfg },
                comp,
                makeup,
                bandOut,
                getReduction: () => comp.reduction
            });
        }

        wetGain.connect(output);

        const params = {
            name: initialParams.name || '4-Band Multi-Channel Compressor',
            channelMode: initialParams.channelMode || 'stereo', // 'stereo' | 'mid_side'
            crossovers: [...xovers],
            bands: bandObjects.map(b => b.config),
            mix: 100
        };

        dryGain.gain.value = 0.0;
        wetGain.gain.value = 1.0;

        const updateSoloMuteStates = () => {
            const anySolo = bandObjects.some(b => b.config.solo);
            const now = this.ctx.currentTime;
            for (const b of bandObjects) {
                let targetGain = 1.0;
                if (b.config.bypassed) {
                    targetGain = 0.0;
                } else if (anySolo) {
                    targetGain = b.config.solo ? 1.0 : 0.0;
                }
                b.bandOut.gain.setTargetAtTime(targetGain, now, 0.02);
            }
        };

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            if (paramName === 'bandThreshold') {
                const { bandIndex, threshold } = value;
                if (bandObjects[bandIndex]) {
                    bandObjects[bandIndex].config.threshold = threshold;
                    bandObjects[bandIndex].comp.threshold.setTargetAtTime(threshold, now, 0.02);
                }
            } else if (paramName === 'bandRatio') {
                const { bandIndex, ratio } = value;
                if (bandObjects[bandIndex]) {
                    bandObjects[bandIndex].config.ratio = ratio;
                    bandObjects[bandIndex].comp.ratio.setTargetAtTime(ratio, now, 0.02);
                }
            } else if (paramName === 'bandAttack') {
                const { bandIndex, attack } = value;
                if (bandObjects[bandIndex]) {
                    bandObjects[bandIndex].config.attack = attack;
                    bandObjects[bandIndex].comp.attack.setTargetAtTime(Math.max(0.0001, attack / 1000.0), now, 0.02);
                }
            } else if (paramName === 'bandRelease') {
                const { bandIndex, release } = value;
                if (bandObjects[bandIndex]) {
                    bandObjects[bandIndex].config.release = release;
                    bandObjects[bandIndex].comp.release.setTargetAtTime(Math.max(0.001, release / 1000.0), now, 0.02);
                }
            } else if (paramName === 'bandMakeup') {
                const { bandIndex, makeup } = value;
                if (bandObjects[bandIndex]) {
                    bandObjects[bandIndex].config.makeup = makeup;
                    bandObjects[bandIndex].makeup.gain.setTargetAtTime(Math.pow(10.0, makeup / 20.0), now, 0.02);
                }
            } else if (paramName === 'bandSolo') {
                const { bandIndex, solo } = value;
                if (bandObjects[bandIndex]) {
                    bandObjects[bandIndex].config.solo = !!solo;
                    updateSoloMuteStates();
                }
            } else if (paramName === 'bandBypass') {
                const { bandIndex, bypassed } = value;
                if (bandObjects[bandIndex]) {
                    bandObjects[bandIndex].config.bypassed = !!bypassed;
                    updateSoloMuteStates();
                }
            } else if (paramName === 'channelMode') {
                params.channelMode = value; // 'stereo' | 'mid_side'
            } else if (paramName === 'mix') {
                params.mix = Math.max(0, Math.min(100, value));
                const wet = params.mix / 100.0;
                const dry = 1.0 - wet;
                wetGain.gain.setTargetAtTime(wet, now, 0.02);
                dryGain.gain.setTargetAtTime(dry, now, 0.02);
            }
        };

        return {
            id,
            type: 'multiband_compressor',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            bandObjects,
            params,
            setParam,
            getBandReductions: () => bandObjects.map(b => b.getReduction()),
            getReduction: () => {
                const reds = bandObjects.map(b => b.getReduction());
                return Math.min(...reds);
            }
        };
    }

    createOptoCompressorModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        const comp = this.ctx.createDynamicsCompressor();
        const makeup = this.ctx.createGain();

        // Opto characteristics: gentle soft-knee (18dB), smooth 4:1 ratio, 40ms attack, 350ms release
        const params = {
            name: initialParams.name || 'Opto Warmth Compressor',
            peakReduction: initialParams.peakReduction !== undefined ? initialParams.peakReduction : 35.0, // 0 to 100%
            makeup: initialParams.makeup !== undefined ? initialParams.makeup : 2.0,
            emphasis: initialParams.emphasis !== undefined ? initialParams.emphasis : 50.0,
            mix: initialParams.mix !== undefined ? initialParams.mix : 100.0
        };

        // Map peak reduction to threshold (-32dB to 0dB)
        const calcThresh = (pr) => -8.0 - (pr * 0.28);
        comp.threshold.value = calcThresh(params.peakReduction);
        comp.ratio.value = 3.5;
        comp.knee.value = 16.0;
        comp.attack.value = 0.035;
        comp.release.value = 0.320;
        makeup.gain.value = Math.pow(10.0, params.makeup / 20.0);

        dryGain.gain.value = 0.0;
        wetGain.gain.value = 1.0;

        input.connect(comp);
        comp.connect(makeup);
        makeup.connect(wetGain);
        wetGain.connect(output);

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'peakReduction') {
                comp.threshold.setTargetAtTime(calcThresh(value), now, 0.02);
            } else if (paramName === 'makeup') {
                makeup.gain.setTargetAtTime(Math.pow(10.0, value / 20.0), now, 0.02);
            } else if (paramName === 'mix') {
                const wet = value / 100.0;
                dryGain.gain.setTargetAtTime(1.0 - wet, now, 0.02);
                wetGain.gain.setTargetAtTime(wet, now, 0.02);
            }
        };

        return {
            id,
            type: 'opto_compressor',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            compNode: comp,
            params,
            setParam,
            getReduction: () => comp.reduction
        };
    }

    createTubeSaturatorModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        const preGain = this.ctx.createGain();
        const shaper = this.ctx.createWaveShaper();
        const postGain = this.ctx.createGain();

        input.connect(preGain);
        preGain.connect(shaper);
        shaper.connect(postGain);
        postGain.connect(wetGain);
        wetGain.connect(output);

        const params = {
            name: initialParams.name || 'Analog Tube Warmth',
            drive: initialParams.drive !== undefined ? initialParams.drive : 15.0, // 0 to 60 dB drive
            warmth: initialParams.warmth !== undefined ? initialParams.warmth : 40.0, // 0 to 100 harmonics
            outputGain: initialParams.outputGain !== undefined ? initialParams.outputGain : 0.0,
            mix: initialParams.mix !== undefined ? initialParams.mix : 50.0
        };

        const updateCurve = (warmthFactor) => {
            const n_samples = 4096;
            const curve = new Float32Array(n_samples);
            const k = 1.0 + (warmthFactor / 100.0) * 3.0;

            for (let i = 0; i < n_samples; ++i) {
                const x = (i * 2) / n_samples - 1;
                // Soft tube saturation: tanh style polynomial with subtle 2nd harmonic warmth
                const y = Math.tanh(k * x) + 0.08 * (warmthFactor / 100.0) * (x * x - 0.25);
                curve[i] = Math.max(-1.0, Math.min(1.0, y));
            }
            shaper.curve = curve;
            shaper.oversample = '4x';
        };

        updateCurve(params.warmth);
        preGain.gain.value = Math.pow(10.0, params.drive / 35.0);
        postGain.gain.value = Math.pow(10.0, (params.outputGain - params.drive * 0.4) / 20.0);

        dryGain.gain.value = 1.0 - (params.mix / 100.0);
        wetGain.gain.value = params.mix / 100.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'drive') {
                preGain.gain.setTargetAtTime(Math.pow(10.0, value / 35.0), now, 0.02);
                postGain.gain.setTargetAtTime(Math.pow(10.0, (params.outputGain - value * 0.4) / 20.0), now, 0.02);
            } else if (paramName === 'warmth') {
                updateCurve(value);
            } else if (paramName === 'outputGain') {
                postGain.gain.setTargetAtTime(Math.pow(10.0, (value - params.drive * 0.4) / 20.0), now, 0.02);
            } else if (paramName === 'mix') {
                const wet = value / 100.0;
                dryGain.gain.setTargetAtTime(1.0 - wet, now, 0.02);
                wetGain.gain.setTargetAtTime(wet, now, 0.02);
            }
        };

        return {
            id,
            type: 'tube_saturator',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            params,
            setParam
        };
    }

    createStereoImagerModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        // M/S processing matrix
        const splitter = this.ctx.createChannelSplitter(2);
        const merger = this.ctx.createChannelMerger(2);

        // Sum (Mid) = (L + R) * 0.5
        const midGainL = this.ctx.createGain();
        const midGainR = this.ctx.createGain();
        midGainL.gain.value = 0.5;
        midGainR.gain.value = 0.5;

        // Diff (Side) = (L - R) * 0.5
        const sideGainL = this.ctx.createGain();
        const sideGainR = this.ctx.createGain();
        sideGainL.gain.value = 0.5;
        sideGainR.gain.value = -0.5;

        // Side width multiplier
        const sideWidth = this.ctx.createGain();
        // Highpass on Side for Mono Bass focus
        const monoBassFilter = this.ctx.createBiquadFilter();
        monoBassFilter.type = 'highpass';
        monoBassFilter.frequency.value = initialParams.monoBassFreq || 90.0;
        monoBassFilter.Q.value = 0.707;

        // Reconstruction: L_out = Mid + Side; R_out = Mid - Side
        const outMidToL = this.ctx.createGain(); outMidToL.gain.value = 1.0;
        const outMidToR = this.ctx.createGain(); outMidToR.gain.value = 1.0;
        const outSideToL = this.ctx.createGain(); outSideToL.gain.value = 1.0;
        const outSideToR = this.ctx.createGain(); outSideToR.gain.value = -1.0;

        // Routing
        input.connect(splitter);
        splitter.connect(midGainL, 0);
        splitter.connect(midGainR, 1);
        splitter.connect(sideGainL, 0);
        splitter.connect(sideGainR, 1);

        // Mid path
        const midBus = this.ctx.createGain();
        midGainL.connect(midBus);
        midGainR.connect(midBus);
        midBus.connect(outMidToL);
        midBus.connect(outMidToR);

        // Side path
        const sideBus = this.ctx.createGain();
        sideGainL.connect(sideBus);
        sideGainR.connect(sideBus);
        sideBus.connect(monoBassFilter);
        monoBassFilter.connect(sideWidth);
        sideWidth.connect(outSideToL);
        sideWidth.connect(outSideToR);

        // Merge out
        outMidToL.connect(merger, 0, 0);
        outSideToL.connect(merger, 0, 0);
        outMidToR.connect(merger, 0, 1);
        outSideToR.connect(merger, 0, 1);

        merger.connect(wetGain);
        wetGain.connect(output);

        const params = {
            name: initialParams.name || 'Stereo Imager & Widener',
            width: initialParams.width !== undefined ? initialParams.width : 115.0, // % width
            monoBassFreq: initialParams.monoBassFreq !== undefined ? initialParams.monoBassFreq : 90.0,
            mix: 100
        };

        sideWidth.gain.value = params.width / 100.0;
        dryGain.gain.value = 0.0;
        wetGain.gain.value = 1.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'width') {
                sideWidth.gain.setTargetAtTime(value / 100.0, now, 0.02);
            } else if (paramName === 'monoBassFreq') {
                monoBassFilter.frequency.setTargetAtTime(value, now, 0.02);
            }
        };

        return {
            id,
            type: 'stereo_imager',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            params,
            setParam
        };
    }

    createLimiterModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        const driveGain = this.ctx.createGain();
        const fastLimiter = this.ctx.createDynamicsCompressor();
        const softClipper = this.ctx.createWaveShaper();
        const ceilingGain = this.ctx.createGain();

        // Brickwall compressor settings: 20:1 ratio, 0.001s attack, 0.08s release, hard knee
        fastLimiter.threshold.value = -0.5;
        fastLimiter.knee.value = 0.0;
        fastLimiter.ratio.value = 20.0;
        fastLimiter.attack.value = 0.001;
        fastLimiter.release.value = 0.080;

        // Hermite soft-clip curve at 1.0 peak
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; i++) {
            const x = (i * 2) / n_samples - 1;
            const absX = Math.abs(x);
            if (absX <= 0.85) {
                curve[i] = x;
            } else {
                const sign = x >= 0 ? 1 : -1;
                const over = (absX - 0.85) / 0.15;
                const clampedOver = Math.min(1.0, over);
                curve[i] = sign * (0.85 + 0.15 * (clampedOver - (clampedOver * clampedOver * clampedOver) / 3));
            }
        }
        softClipper.curve = curve;
        softClipper.oversample = '4x';

        input.connect(driveGain);
        driveGain.connect(fastLimiter);
        fastLimiter.connect(softClipper);
        softClipper.connect(ceilingGain);
        ceilingGain.connect(wetGain);
        wetGain.connect(output);

        const params = {
            name: initialParams.name || 'Brickwall True-Peak Limiter',
            ceiling: initialParams.ceiling !== undefined ? initialParams.ceiling : -0.2, // dB
            release: initialParams.release !== undefined ? initialParams.release : 80.0, // ms
            drive: initialParams.drive !== undefined ? initialParams.drive : 0.0, // dB
            softClip: initialParams.softClip !== undefined ? initialParams.softClip : true
        };

        ceilingGain.gain.value = Math.pow(10.0, params.ceiling / 20.0);
        driveGain.gain.value = Math.pow(10.0, params.drive / 20.0);
        dryGain.gain.value = 0.0;
        wetGain.gain.value = 1.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'ceiling') {
                ceilingGain.gain.setTargetAtTime(Math.pow(10.0, value / 20.0), now, 0.02);
                fastLimiter.threshold.setTargetAtTime(value - 0.3, now, 0.02);
            } else if (paramName === 'release') {
                fastLimiter.release.setTargetAtTime(Math.max(0.005, value / 1000.0), now, 0.02);
            } else if (paramName === 'drive') {
                driveGain.gain.setTargetAtTime(Math.pow(10.0, value / 20.0), now, 0.02);
            }
        };

        return {
            id,
            type: 'lookahead_limiter',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            compNode: fastLimiter,
            params,
            setParam,
            getReduction: () => fastLimiter.reduction
        };
    }

    /**
     * Map reference match analysis directly onto the live Parametric Match EQ & Dynamics
     */
    applyReferenceMatch(differenceData, matchAmount = 1.0) {
        // 1. Find Match EQ module
        const eqMod = this.modules.find(m => m.type === 'parametric_eq');
        if (eqMod && differenceData && differenceData.smoothedDeltaDb) {
            const bands = [
                { id: 'sub', freq: 40, gain: differenceData.smoothedDeltaDb[1] || 0 },
                { id: 'low', freq: 120, gain: differenceData.smoothedDeltaDb[6] || 0 },
                { id: 'low_mid', freq: 350, gain: differenceData.smoothedDeltaDb[11] || 0 },
                { id: 'mid', freq: 1000, gain: differenceData.smoothedDeltaDb[16] || 0 },
                { id: 'high_mid', freq: 3200, gain: differenceData.smoothedDeltaDb[21] || 0 },
                { id: 'presence', freq: 6500, gain: differenceData.smoothedDeltaDb[25] || 0 },
                { id: 'air', freq: 12000, gain: differenceData.smoothedDeltaDb[28] || 0 }
            ];

            eqMod.setParam('allBands', bands);
            eqMod.setParam('matchAmount', matchAmount);
        }

        // 2. Find Master Compressor module
        const compMod = this.modules.find(m => m.type === 'master_compressor');
        if (compMod && differenceData) {
            compMod.setParam('threshold', differenceData.suggestedCompThreshold || -16.0);
            compMod.setParam('ratio', differenceData.suggestedCompRatio || 2.5);
            // Suggest makeup gain based on difference
            const makeupGain = Math.max(0.5, Math.min(6.0, differenceData.deltaLoudnessDb * 0.5));
            compMod.setParam('makeup', makeupGain);
        }

        // 3. Find Limiter module
        const limMod = this.modules.find(m => m.type === 'lookahead_limiter');
        if (limMod) {
            limMod.setParam('ceiling', -0.2);
            limMod.setParam('drive', Math.max(0, Math.min(4.0, (differenceData.deltaLoudnessDb || 0) * 0.3)));
        }
    }
}
