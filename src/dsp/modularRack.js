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
            threshold: -14.0,
            ratio: 1.5,
            attack: 30.0,
            release: 120.0,
            knee: 6.0,
            makeup: 0.5,
            mix: 100.0
        });

        // Module 4: Tube Saturation & Warmth
        this.addModule('tube_saturator', null, {
            name: 'Analog Tube Warmth',
            drive: 3.0,
            warmth: 20.0,
            mix: 25.0,
            outputGain: 0.0
        });

        // Module 5: Stereo Imager & Mono Bass
        this.addModule('stereo_imager', null, {
            name: 'Stereo Imager & Widener',
            width: 110.0, // 110% width
            monoBassFreq: 90.0 // Mono under 90Hz
        });

        // Module 6: Lookahead Brickwall Peak Limiter
        this.addModule('lookahead_limiter', null, {
            name: 'Brickwall True-Peak Limiter',
            ceiling: -0.5,
            release: 85.0,
            softClip: true,
            drive: 0.0
        });

        // Initialize all default processors in bypassed mode so user tracks load cleanly and without distortion!
        for (const mod of this.modules) {
            mod.bypassed = true;
            if (mod.dryGain && mod.wetGain) {
                mod.dryGain.gain.value = 1.0;
                mod.wetGain.gain.value = 0.0;
            }
        }

        this.reconnectChain();
    }

    /**
     * Add a processor module to the chain
     * @param {'parametric_eq' | 'multiband_compressor' | 'master_compressor' | 'opto_compressor' | 'tube_saturator' | 'analog_tape' | 'studio_reverb' | 'transient_shaper' | 'dynamic_deharsh' | 'stereo_imager' | 'lookahead_limiter'} type 
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
            case 'analog_tape':
                moduleObj = this.createAnalogTapeModule(id, initialParams);
                break;
            case 'studio_reverb':
                moduleObj = this.createStudioReverbModule(id, initialParams);
                break;
            case 'transient_shaper':
                moduleObj = this.createTransientShaperModule(id, initialParams);
                break;
            case 'dynamic_deharsh':
                moduleObj = this.createDynamicDeharshModule(id, initialParams);
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

    setModuleParams(moduleId, paramsObj) {
        const mod = this.modules.find(m => m.id === moduleId);
        if (!mod || !paramsObj) return;

        if (paramsObj.bypassed !== undefined) {
            this.setModuleBypass(moduleId, paramsObj.bypassed);
        }

        for (const [key, val] of Object.entries(paramsObj)) {
            if (key === 'bypassed') continue;
            if (key === 'bands') {
                if (mod.type === 'parametric_eq') {
                    mod.setParam('allBands', val);
                } else if (mod.type === 'multiband_compressor') {
                    mod.setParam('allBands', val);
                }
            } else if (mod.setParam) {
                mod.setParam(key, val);
            }
        }
    }

    /**
     * Export complete rack state snapshot for Undo/Redo and Presets
     */
    exportState() {
        return {
            modules: this.modules.map(mod => ({
                id: mod.id,
                type: mod.type,
                title: mod.title,
                bypassed: !!mod.bypassed,
                params: JSON.parse(JSON.stringify(mod.params))
            }))
        };
    }

    /**
     * Restore complete rack state snapshot
     */
    importState(state) {
        if (!state || !Array.isArray(state.modules)) return false;

        const canUpdateInPlace = this.modules.length === state.modules.length &&
            this.modules.every((m, i) => m.type === state.modules[i].type);

        if (canUpdateInPlace) {
            state.modules.forEach((saved, i) => {
                const current = this.modules[i];
                current.title = saved.title || current.title;
                this.setModuleBypass(current.id, saved.bypassed);
                this.setModuleParams(current.id, saved.params);
            });
        } else {
            // Structural change: disconnect old chain, rebuild according to state
            for (const m of this.modules) {
                try {
                    m.input.disconnect();
                    m.output.disconnect();
                } catch (_) {}
            }
            this.modules = [];

            for (const saved of state.modules) {
                const newMod = this.addModule(saved.type, null, saved.params);
                if (newMod) {
                    if (saved.id) newMod.id = saved.id;
                    if (saved.title) newMod.title = saved.title;
                    this.setModuleBypass(newMod.id, saved.bypassed);
                    this.setModuleParams(newMod.id, saved.params);
                }
            }
            this.reconnectChain();
        }
        return true;
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
            } else if (paramName === 'allBands' && Array.isArray(value)) {
                for (let i = 0; i < Math.min(bandObjects.length, value.length); i++) {
                    const b = value[i];
                    if (b.threshold !== undefined) setParam('bandThreshold', { bandIndex: i, threshold: b.threshold });
                    if (b.ratio !== undefined) setParam('bandRatio', { bandIndex: i, ratio: b.ratio });
                    if (b.attack !== undefined) setParam('bandAttack', { bandIndex: i, attack: b.attack });
                    if (b.release !== undefined) setParam('bandRelease', { bandIndex: i, release: b.release });
                    if (b.makeup !== undefined) setParam('bandMakeup', { bandIndex: i, makeup: b.makeup });
                    if (b.solo !== undefined) setParam('bandSolo', { bandIndex: i, solo: b.solo });
                    if (b.bypassed !== undefined) setParam('bandBypass', { bandIndex: i, bypassed: b.bypassed });
                }
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
            drive: initialParams.drive !== undefined ? initialParams.drive : 5.0, // 0 to 30 dB drive
            warmth: initialParams.warmth !== undefined ? initialParams.warmth : 25.0, // 0 to 100 harmonics
            outputGain: initialParams.outputGain !== undefined ? initialParams.outputGain : 0.0,
            mix: initialParams.mix !== undefined ? initialParams.mix : 35.0
        };

        const updateCurve = (warmthFactor) => {
            const n_samples = 4096;
            const curve = new Float32Array(n_samples);
            const w = Math.max(0, Math.min(1.0, warmthFactor / 100.0));

            for (let i = 0; i < n_samples; ++i) {
                const x = (i * 2) / n_samples - 1;
                // Mastering-grade soft saturation: continuous smooth polynomial with subtle 2nd harmonic warmth
                // Pure C1 continuity without hard clipping corners or square-wave distortion
                const normX = Math.max(-1.0, Math.min(1.0, x));
                const y = (normX + w * 0.15 * normX * Math.abs(normX)) / (1.0 + Math.abs(normX) * 0.2);
                curve[i] = Math.max(-1.0, Math.min(1.0, y * 0.95));
            }
            shaper.curve = curve;
            shaper.oversample = '4x';
        };

        updateCurve(params.warmth);
        // Drive scaling calibrated for gentle mastering saturation (max +4dB input drive, not +15dB!)
        const calcPreGain = (d) => 1.0 + (Math.max(0, d) / 30.0) * 0.65;
        const calcPostGain = (d, outG) => Math.pow(10.0, (outG - (d * 0.08)) / 20.0);

        preGain.gain.value = calcPreGain(params.drive);
        postGain.gain.value = calcPostGain(params.drive, params.outputGain);

        dryGain.gain.value = 1.0 - (params.mix / 100.0);
        wetGain.gain.value = params.mix / 100.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'drive') {
                preGain.gain.setTargetAtTime(calcPreGain(value), now, 0.02);
                postGain.gain.setTargetAtTime(calcPostGain(value, params.outputGain), now, 0.02);
            } else if (paramName === 'warmth') {
                updateCurve(value);
            } else if (paramName === 'outputGain') {
                postGain.gain.setTargetAtTime(calcPostGain(params.drive, value), now, 0.02);
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
            shaperNode: shaper,
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

    createStudioReverbModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        // Pre-highpass filter (cuts below ~140 Hz to protect mastering low end)
        const preHp = this.ctx.createBiquadFilter();
        preHp.type = 'highpass';
        preHp.frequency.value = 140.0;
        preHp.Q.value = 0.707;

        // Pre-delay line
        const preDelay = this.ctx.createDelay(0.5);
        preDelay.delayTime.value = (initialParams.predelay !== undefined ? initialParams.predelay : 20.0) / 1000.0;

        // High-fidelity Convolution Engine (Zero recursive runaway feedback possible!)
        const convolver = this.ctx.createConvolver();

        // Stereo widener matrix
        const splitter = this.ctx.createChannelSplitter(2);
        const merger = this.ctx.createChannelMerger(2);
        const widthL = this.ctx.createGain();
        const widthR = this.ctx.createGain();
        const widthVal = (initialParams.width !== undefined ? initialParams.width : 110.0) / 100.0;
        widthL.gain.value = widthVal;
        widthR.gain.value = widthVal;

        input.connect(preHp);
        preHp.connect(preDelay);
        preDelay.connect(convolver);
        convolver.connect(splitter);

        splitter.connect(widthL, 0);
        splitter.connect(widthR, 1);
        widthL.connect(merger, 0, 0);
        widthR.connect(merger, 0, 1);

        merger.connect(wetGain);
        wetGain.connect(output);

        const params = {
            name: initialParams.name || 'Studio Acoustic Reverb',
            size: initialParams.size !== undefined ? initialParams.size : 50.0, // 10 to 100 %
            decay: initialParams.decay !== undefined ? initialParams.decay : 1.6, // 0.3 to 4.0 s
            predelay: initialParams.predelay !== undefined ? initialParams.predelay : 20.0, // ms
            damping: initialParams.damping !== undefined ? initialParams.damping : 6500.0, // Hz
            width: initialParams.width !== undefined ? initialParams.width : 110.0, // %
            mix: initialParams.mix !== undefined ? initialParams.mix : 10.0 // %
        };

        const generateImpulse = (size, decay, damping) => {
            const rate = this.ctx.sampleRate || 44100;
            const duration = Math.max(0.2, Math.min(3.5, decay));
            const length = Math.floor(rate * duration);
            const impulse = this.ctx.createBuffer(2, length, rate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);

            const decayConstant = 4.0 / duration; // Smooth decay envelope
            const dampCutoff = Math.max(1200, Math.min(18000, damping));
            const dampAlpha = Math.exp(-2.0 * Math.PI * (dampCutoff / rate));

            let lpL = 0;
            let lpR = 0;

            const sizeScale = Math.max(0.3, Math.min(1.8, size / 50.0));

            // Early reflection clusters (Schroeder room distribution)
            const earlyTaps = [
                { time: 0.009, gainL: 0.40, gainR: 0.22 },
                { time: 0.016, gainL: -0.32, gainR: 0.38 },
                { time: 0.024, gainL: 0.28, gainR: -0.29 },
                { time: 0.035, gainL: -0.22, gainR: 0.25 },
                { time: 0.048, gainL: 0.18, gainR: -0.20 },
                { time: 0.065, gainL: -0.14, gainR: 0.16 }
            ];

            for (const tap of earlyTaps) {
                const idx = Math.floor(tap.time * sizeScale * rate);
                if (idx < length) {
                    left[idx] += tap.gainL;
                    right[idx] += tap.gainR;
                }
            }

            // Diffuse reverberation tail with exponential decay and HF damping
            for (let i = 0; i < length; i++) {
                const t = i / rate;
                const env = Math.exp(-t * decayConstant);

                const nL = (Math.random() * 2 - 1) * env * 0.3;
                const nR = (Math.random() * 2 - 1) * env * 0.3;

                lpL = nL * (1 - dampAlpha) + lpL * dampAlpha;
                lpR = nR * (1 - dampAlpha) + lpR * dampAlpha;

                left[i] += lpL;
                right[i] += lpR;
            }

            return impulse;
        };

        // Initialize impulse buffer
        convolver.buffer = generateImpulse(params.size, params.decay, params.damping);

        const wet = params.mix / 100.0;
        dryGain.gain.value = 1.0 - wet;
        wetGain.gain.value = wet;

        let regenTimeout = null;
        const queueImpulseRegen = () => {
            if (regenTimeout) clearTimeout(regenTimeout);
            regenTimeout = setTimeout(() => {
                try {
                    convolver.buffer = generateImpulse(params.size, params.decay, params.damping);
                } catch (_) {}
            }, 60);
        };

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'predelay') {
                preDelay.delayTime.setTargetAtTime(Math.max(0.001, value / 1000.0), now, 0.02);
            } else if (paramName === 'damping' || paramName === 'size' || paramName === 'decay') {
                queueImpulseRegen();
            } else if (paramName === 'width') {
                const w = value / 100.0;
                widthL.gain.setTargetAtTime(w, now, 0.02);
                widthR.gain.setTargetAtTime(w, now, 0.02);
            } else if (paramName === 'mix') {
                const w = value / 100.0;
                dryGain.gain.setTargetAtTime(1.0 - w, now, 0.02);
                wetGain.gain.setTargetAtTime(w, now, 0.02);
            }
        };

        return {
            id,
            type: 'studio_reverb',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            convolverNode: convolver,
            params,
            setParam
        };
    }

    createAnalogTapeModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        // BASE DELAY COMPENSATION FOR PERFECT PHASE COHERENCE
        // Delaying both wet and dry paths by the exact same 2ms prevents comb-filtering / flanging when mix < 100%
        const BASE_DELAY = 0.002; // 2 milliseconds
        const dryDelay = this.ctx.createDelay(0.05);
        dryDelay.delayTime.value = BASE_DELAY;

        input.connect(dryDelay);
        dryDelay.connect(dryGain);
        dryGain.connect(output);

        const inputDriveGain = this.ctx.createGain();
        const tapeShaper = this.ctx.createWaveShaper();
        const headBumpFilter = this.ctx.createBiquadFilter();
        const speedHighFilter = this.ctx.createBiquadFilter();
        const tapeBiasFilter = this.ctx.createBiquadFilter();
        const flutterDelayL = this.ctx.createDelay(0.05);
        const flutterDelayR = this.ctx.createDelay(0.05);
        const flutterGain = this.ctx.createGain();
        const outputTrimGain = this.ctx.createGain();

        // 1. Head Bump filter (Playback head resonance, positioned AFTER saturation to avoid intermodulation mud)
        headBumpFilter.type = 'peaking';
        headBumpFilter.frequency.value = 55.0;
        headBumpFilter.Q.value = 0.85; // Musical wide Q, non-resonant
        headBumpFilter.gain.value = initialParams.headBump !== undefined ? initialParams.headBump : 0.4;

        // 2. Speed High-Shelf filter
        speedHighFilter.type = 'highshelf';
        speedHighFilter.frequency.value = 14000.0;
        speedHighFilter.gain.value = 0.0;

        // 3. Tape Bias peaking filter
        tapeBiasFilter.type = 'peaking';
        tapeBiasFilter.frequency.value = 10000.0;
        tapeBiasFilter.Q.value = 0.8;
        tapeBiasFilter.gain.value = initialParams.bias !== undefined ? initialParams.bias : 0.0;

        // 4. Modulated Wow & Flutter LFO (Studer / Ampex ultra-tight mastering deck specs: <0.015% WRMS)
        const lfo1 = this.ctx.createOscillator();
        const lfo2 = this.ctx.createOscillator();
        const lfoGain1 = this.ctx.createGain();
        const lfoGain2 = this.ctx.createGain();
        lfo1.type = 'sine';
        lfo1.frequency.value = 0.5; // Capstan rotation drift
        lfo2.type = 'triangle';
        lfo2.frequency.value = 3.2; // Tape scrape flutter
        lfoGain1.gain.value = 0.000010; // 10 microseconds max modulation at 100% flutter
        lfoGain2.gain.value = 0.000003; // 3 microseconds max
        lfo1.connect(lfoGain1);
        lfo2.connect(lfoGain2);
        lfoGain1.connect(flutterGain);
        lfoGain2.connect(flutterGain);

        flutterDelayL.delayTime.value = BASE_DELAY;
        flutterDelayR.delayTime.value = BASE_DELAY;
        flutterGain.connect(flutterDelayL.delayTime);
        flutterGain.connect(flutterDelayR.delayTime);
        try {
            lfo1.start();
            lfo2.start();
        } catch (_) {}

        // Mastering Tape Saturation Curve:
        // Pure analog tape compression: perfectly linear across 85% of dynamic range,
        // rounding smoothly on peak transients above -3 dBFS with warm 3rd harmonic compression.
        const updateTapeCurves = (driveVal, transformerVal) => {
            const n = 4096;
            const tapeCurve = new Float32Array(n);
            // driveVal: 0 to 18 dB. Normal mastering setting: 1 to 3 dB.
            const driveAmount = (Math.max(0, driveVal) / 18.0);
            const satStrength = driveAmount * 0.28; // Gentle mastering tape compression
            const xfmrWarmth = (Math.max(0, transformerVal) / 100.0) * 0.012;

            for (let i = 0; i < n; i++) {
                const x = (i * 2) / n - 1; // -1 to +1
                // Soft cubic-quintic tape compression curve with exact unity slope at zero
                const y = x - satStrength * (0.24 * Math.pow(x, 3) - 0.04 * Math.pow(x, 5));
                // Subtle transformer core even-order harmonic (warmth)
                const y2 = y + xfmrWarmth * (1.0 - Math.pow(x, 2)) * Math.sign(x);
                tapeCurve[i] = Math.max(-1.0, Math.min(1.0, y2));
            }
            tapeShaper.curve = tapeCurve;
            tapeShaper.oversample = '4x';
        };

        const updateSpeedSettings = (speed) => {
            const now = this.ctx.currentTime;
            if (speed === '30_ips') {
                speedHighFilter.gain.setTargetAtTime(0.3, now, 0.02);
                headBumpFilter.frequency.setTargetAtTime(68.0, now, 0.02);
            } else if (speed === '7.5_ips') {
                speedHighFilter.gain.setTargetAtTime(-0.8, now, 0.02);
                headBumpFilter.frequency.setTargetAtTime(45.0, now, 0.02);
            } else {
                // 15_ips default
                speedHighFilter.gain.setTargetAtTime(0.0, now, 0.02);
                headBumpFilter.frequency.setTargetAtTime(55.0, now, 0.02);
            }
        };

        const params = {
            name: initialParams.name || 'Analog Master Tape Machine',
            speed: initialParams.speed || '15_ips', // '30_ips' | '15_ips' | '7.5_ips'
            drive: initialParams.drive !== undefined ? initialParams.drive : 1.5, // dB (0 to 18)
            headBump: initialParams.headBump !== undefined ? initialParams.headBump : 0.4, // dB (0 to 4)
            flutter: initialParams.flutter !== undefined ? initialParams.flutter : 0.0, // % (0 to 100, default 0 for clean mastering deck)
            transformer: initialParams.transformer !== undefined ? initialParams.transformer : 15.0, // % (0 to 100)
            bias: initialParams.bias !== undefined ? initialParams.bias : 0.0, // dB (-3 to +3)
            mix: initialParams.mix !== undefined ? initialParams.mix : 100.0 // % (100% tape insert)
        };

        updateTapeCurves(params.drive, params.transformer);
        updateSpeedSettings(params.speed);

        inputDriveGain.gain.value = 1.0;
        outputTrimGain.gain.value = 1.0;
        flutterGain.gain.value = params.flutter / 100.0;

        // Routing:
        // Input -> InputDrive -> TapeShaper -> HeadBump -> SpeedHigh -> TapeBias -> Stereo Split -> Flutter Delays -> Merge -> OutputTrim -> WetGain -> Output
        const splitter = this.ctx.createChannelSplitter(2);
        const merger = this.ctx.createChannelMerger(2);

        input.connect(inputDriveGain);
        inputDriveGain.connect(tapeShaper);
        tapeShaper.connect(headBumpFilter);
        headBumpFilter.connect(speedHighFilter);
        speedHighFilter.connect(tapeBiasFilter);

        tapeBiasFilter.connect(splitter);
        splitter.connect(flutterDelayL, 0);
        splitter.connect(flutterDelayR, 1);
        flutterDelayL.connect(merger, 0, 0);
        flutterDelayR.connect(merger, 0, 1);

        merger.connect(outputTrimGain);
        outputTrimGain.connect(wetGain);
        wetGain.connect(output);

        dryGain.gain.value = 1.0 - (params.mix / 100.0);
        wetGain.gain.value = params.mix / 100.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'drive') {
                updateTapeCurves(value, params.transformer);
            } else if (paramName === 'speed') {
                updateSpeedSettings(value);
            } else if (paramName === 'headBump') {
                headBumpFilter.gain.setTargetAtTime(value, now, 0.02);
            } else if (paramName === 'flutter') {
                flutterGain.gain.setTargetAtTime(value / 100.0, now, 0.02);
            } else if (paramName === 'transformer') {
                updateTapeCurves(params.drive, value);
            } else if (paramName === 'bias') {
                tapeBiasFilter.gain.setTargetAtTime(value, now, 0.02);
            } else if (paramName === 'mix') {
                const wet = value / 100.0;
                dryGain.gain.setTargetAtTime(1.0 - wet, now, 0.02);
                wetGain.gain.setTargetAtTime(wet, now, 0.02);
            }
        };

        return {
            id,
            type: 'analog_tape',
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

    createTransientShaperModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        // Fast envelope follower (transients) vs Slow envelope (sustain body)
        const fastComp = this.ctx.createDynamicsCompressor();
        fastComp.threshold.value = -24.0;
        fastComp.ratio.value = 4.0;
        fastComp.attack.value = 0.002;
        fastComp.release.value = 0.030;

        const attackGainNode = this.ctx.createGain();
        const sustainGainNode = this.ctx.createGain();
        const outTrim = this.ctx.createGain();

        const focusFilter = this.ctx.createBiquadFilter();
        focusFilter.type = 'highpass';
        focusFilter.frequency.value = 75.0;

        input.connect(focusFilter);
        focusFilter.connect(fastComp);

        const attackBranch = this.ctx.createGain();
        input.connect(attackBranch);
        attackBranch.connect(attackGainNode);

        const sustainBranch = this.ctx.createGain();
        fastComp.connect(sustainBranch);
        sustainBranch.connect(sustainGainNode);

        const sumBus = this.ctx.createGain();
        attackGainNode.connect(sumBus);
        sustainGainNode.connect(sumBus);
        sumBus.connect(outTrim);
        outTrim.connect(wetGain);
        wetGain.connect(output);

        const params = {
            name: initialParams.name || 'Master Transient Shaper',
            attack: initialParams.attack !== undefined ? initialParams.attack : 1.5, // dB (-6 to +6)
            sustain: initialParams.sustain !== undefined ? initialParams.sustain : -0.5, // dB (-6 to +6)
            speed: initialParams.speed !== undefined ? initialParams.speed : 30.0, // ms (10 to 100)
            outputGain: initialParams.outputGain !== undefined ? initialParams.outputGain : 0.0, // dB
            mix: initialParams.mix !== undefined ? initialParams.mix : 100.0 // %
        };

        attackGainNode.gain.value = Math.pow(10, params.attack / 20.0);
        sustainGainNode.gain.value = Math.pow(10, params.sustain / 20.0);
        outTrim.gain.value = Math.pow(10, params.outputGain / 20.0);
        dryGain.gain.value = 1.0 - (params.mix / 100.0);
        wetGain.gain.value = params.mix / 100.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'attack') {
                attackGainNode.gain.setTargetAtTime(Math.pow(10, value / 20.0), now, 0.02);
            } else if (paramName === 'sustain') {
                sustainGainNode.gain.setTargetAtTime(Math.pow(10, value / 20.0), now, 0.02);
            } else if (paramName === 'speed') {
                fastComp.release.setTargetAtTime(Math.max(0.01, value / 1000.0), now, 0.02);
            } else if (paramName === 'outputGain') {
                outTrim.gain.setTargetAtTime(Math.pow(10, value / 20.0), now, 0.02);
            } else if (paramName === 'mix') {
                const wet = value / 100.0;
                dryGain.gain.setTargetAtTime(1.0 - wet, now, 0.02);
                wetGain.gain.setTargetAtTime(wet, now, 0.02);
            }
        };

        return {
            id,
            type: 'transient_shaper',
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

    createDynamicDeharshModule(id, initialParams) {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const wetGain = this.ctx.createGain();

        input.connect(dryGain);
        dryGain.connect(output);

        // Audio path dynamic notch filter
        const deharshFilter = this.ctx.createBiquadFilter();
        deharshFilter.type = 'peaking';
        deharshFilter.frequency.value = initialParams.targetFreq !== undefined ? initialParams.targetFreq : 4500.0;
        deharshFilter.Q.value = initialParams.q !== undefined ? initialParams.q : 1.8;
        deharshFilter.gain.value = -(initialParams.reduction !== undefined ? initialParams.reduction : 3.5);

        // Sidechain detector
        const sidechainBandpass = this.ctx.createBiquadFilter();
        sidechainBandpass.type = 'bandpass';
        sidechainBandpass.frequency.value = deharshFilter.frequency.value;
        sidechainBandpass.Q.value = deharshFilter.Q.value;

        const sidechainComp = this.ctx.createDynamicsCompressor();
        sidechainComp.threshold.value = initialParams.threshold !== undefined ? initialParams.threshold : -18.0;
        sidechainComp.ratio.value = 8.0;
        sidechainComp.attack.value = 0.003;
        sidechainComp.release.value = 0.040;

        input.connect(deharshFilter);
        deharshFilter.connect(wetGain);
        wetGain.connect(output);

        input.connect(sidechainBandpass);
        sidechainBandpass.connect(sidechainComp);

        const params = {
            name: initialParams.name || 'Dynamic Resonance De-Harsh',
            targetFreq: initialParams.targetFreq !== undefined ? initialParams.targetFreq : 4500.0, // 2000 to 10000 Hz
            threshold: initialParams.threshold !== undefined ? initialParams.threshold : -18.0, // dB
            reduction: initialParams.reduction !== undefined ? initialParams.reduction : 3.5, // dB (0 to 12)
            q: initialParams.q !== undefined ? initialParams.q : 1.8,
            mix: initialParams.mix !== undefined ? initialParams.mix : 100.0
        };

        dryGain.gain.value = 0.0;
        wetGain.gain.value = 1.0;

        const setParam = (paramName, value) => {
            const now = this.ctx.currentTime;
            params[paramName] = value;
            if (paramName === 'targetFreq') {
                deharshFilter.frequency.setTargetAtTime(value, now, 0.02);
                sidechainBandpass.frequency.setTargetAtTime(value, now, 0.02);
            } else if (paramName === 'q') {
                deharshFilter.Q.setTargetAtTime(value, now, 0.02);
                sidechainBandpass.Q.setTargetAtTime(value, now, 0.02);
            } else if (paramName === 'reduction') {
                deharshFilter.gain.setTargetAtTime(-Math.abs(value), now, 0.02);
            } else if (paramName === 'threshold') {
                sidechainComp.threshold.setTargetAtTime(value, now, 0.02);
            } else if (paramName === 'mix') {
                const wet = value / 100.0;
                dryGain.gain.setTargetAtTime(1.0 - wet, now, 0.02);
                wetGain.gain.setTargetAtTime(wet, now, 0.02);
            }
        };

        return {
            id,
            type: 'dynamic_deharsh',
            title: params.name,
            bypassed: false,
            input,
            output,
            dryGain,
            wetGain,
            params,
            setParam,
            getReduction: () => sidechainComp.reduction
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
