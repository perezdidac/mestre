/**
 * WebAssembly DSP Bridge
 * Connects the Web Audio API audio graph to the WebAssembly Mastering DSP Engine
 * running in an AudioWorkletNode.
 */

export class WasmDSPBridge {
    constructor(audioContext) {
        this.audioCtx = audioContext;
        this.workletNode = null;
        this.wasmBytes = null;
        this.wasmModule = null;
        this.isInitialized = false;

        // Telemetry callbacks
        this.meteringCallback = null;

        // Active parameters cache
        this.params = {
            bypass: false,
            inputGainDb: 0.0,
            outputGainDb: 0.0,
            matchAmount: 1.0,
            compThresholdDb: -16.0,
            compRatio: 2.5,
            compAttackMs: 25.0,
            compReleaseMs: 150.0,
            compMakeupDb: 0.0,
            limiterCeilingDb: -0.2,
            limiterReleaseMs: 80.0,
            limiterLookaheadMs: 4.0,
            limiterSoftClip: true
        };
    }

    /**
     * Load Wasm binary and register AudioWorklet processor
     */
    async initialize() {
        if (this.isInitialized) return;

        const FALLBACK_WASM_B64 = "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";

        try {
            console.log('[WasmDSPBridge] Loading WASM binary and worklet module...');
            
            // 1. Fetch WASM binary with fallback to embedded base64
            try {
                const wasmResponse = await fetch('/dsp_engine.wasm');
                if (wasmResponse.ok) {
                    this.wasmBytes = await wasmResponse.arrayBuffer();
                } else {
                    throw new Error(`HTTP status ${wasmResponse.status}`);
                }
            } catch (fetchErr) {
                console.warn('[WasmDSPBridge] Network fetch failed, decoding embedded Wasm binary:', fetchErr.message);
                const binaryStr = atob(FALLBACK_WASM_B64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                this.wasmBytes = bytes.buffer;
            }

            try {
                this.wasmModule = await WebAssembly.compile(this.wasmBytes);
            } catch (compErr) {
                console.warn('[WasmDSPBridge] WebAssembly.compile on main thread skipped:', compErr.message);
            }

            // 2. Register AudioWorklet module
            await this.audioCtx.audioWorklet.addModule('/worklets/dsp-worklet-processor.js');

            // 3. Create AudioWorkletNode
            this.workletNode = new AudioWorkletNode(this.audioCtx, 'dsp-mastering-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [2]
            });

            // 4. Setup message listener and await WASM_READY handshake
            const readyPromise = new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn('[WasmDSPBridge] Worklet handshake timeout (600ms), applying parameters...');
                    this.syncAllParameters();
                    resolve();
                }, 600);

                this.workletNode.port.onmessage = (event) => {
                    const data = event.data;
                    if (!data) return;

                    if (data.type === 'WASM_READY') {
                        clearTimeout(timeout);
                        console.log('[WasmDSPBridge] AudioWorklet WASM engine confirmed ready! Synchronizing active parameters...');
                        this.syncAllParameters();
                        resolve();
                    } else if (data.type === 'METERING_UPDATE' && this.meteringCallback) {
                        this.meteringCallback(data);
                    } else if (data.type === 'WASM_ERROR') {
                        console.error('[WasmDSPBridge] Worklet WASM error:', data.error);
                    }
                };
            });

            // 5. Transfer binary safely as ArrayBuffer (avoids DataCloneError across worker realms)
            this.workletNode.port.postMessage({
                type: 'INIT_WASM',
                wasmBytes: this.wasmBytes.slice(0),
                sampleRate: this.audioCtx.sampleRate
            });

            await readyPromise;

            this.isInitialized = true;
            console.log('[WasmDSPBridge] Initialized successfully.');
        } catch (err) {
            console.error('[WasmDSPBridge] Initialization error:', err);
            throw err;
        }
    }

    getWorkletNode() {
        return this.workletNode;
    }

    setMeteringCallback(cb) {
        this.meteringCallback = cb;
    }

    setBypass(bypass) {
        this.params.bypass = !!bypass;
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'SET_BYPASS',
                value: this.params.bypass
            });
        }
    }

    setInputGain(gainDb) {
        this.params.inputGainDb = gainDb;
        const lin = Math.pow(10.0, gainDb / 20.0);
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'SET_INPUT_GAIN',
                value: lin
            });
        }
    }

    setOutputGain(gainDb) {
        this.params.outputGainDb = gainDb;
        const lin = Math.pow(10.0, gainDb / 20.0);
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'SET_OUTPUT_GAIN',
                value: lin
            });
        }
    }

    setMatchAmount(amount) {
        this.params.matchAmount = amount;
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'SET_EQ_MATCH_AMOUNT',
                value: amount
            });
        }
    }

    setAllEqBands(filters) {
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'SET_ALL_EQ_BANDS',
                bands: filters
            });
        }
    }

    setCompressor(thresholdDb, ratio, attackMs, releaseMs, kneeDb, makeupDb) {
        this.params.compThresholdDb = thresholdDb;
        this.params.compRatio = ratio;
        this.params.compAttackMs = attackMs;
        this.params.compReleaseMs = releaseMs;
        this.params.compMakeupDb = makeupDb;

        const sr = this.audioCtx.sampleRate || 48000;
        const threshLin = Math.pow(10.0, thresholdDb / 20.0);
        const makeupLin = Math.pow(10.0, makeupDb / 20.0);
        const attCoeff = 1.0 - Math.exp(-1.0 / ((attackMs * 0.001) * sr));
        const relCoeff = 1.0 - Math.exp(-1.0 / ((releaseMs * 0.001) * sr));

        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'SET_COMPRESSOR',
                threshLin,
                ratio,
                attCoeff,
                relCoeff,
                makeupLin
            });
        }
    }

    setLimiter(ceilingDb, releaseMs, lookaheadMs, softClip) {
        this.params.limiterCeilingDb = ceilingDb;
        this.params.limiterReleaseMs = releaseMs;
        this.params.limiterLookaheadMs = lookaheadMs;
        this.params.limiterSoftClip = softClip;

        const sr = this.audioCtx.sampleRate || 48000;
        const ceilLin = Math.pow(10.0, ceilingDb / 20.0);
        const relCoeff = 1.0 - Math.exp(-1.0 / ((releaseMs * 0.001) * sr));
        const lookaheadSamples = Math.max(0, Math.min(1000, Math.floor((lookaheadMs * 0.001) * sr)));

        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'SET_LIMITER',
                ceilLin,
                relCoeff,
                lookahead: lookaheadSamples,
                softClip: softClip ? 1 : 0
            });
        }
    }

    reset() {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'RESET' });
        }
    }

    syncAllParameters() {
        this.setBypass(this.params.bypass);
        this.setInputGain(this.params.inputGainDb);
        this.setOutputGain(this.params.outputGainDb);
        this.setMatchAmount(this.params.matchAmount);
        this.setCompressor(
            this.params.compThresholdDb,
            this.params.compRatio,
            this.params.compAttackMs,
            this.params.compReleaseMs,
            6.0,
            this.params.compMakeupDb
        );
        this.setLimiter(
            this.params.limiterCeilingDb,
            this.params.limiterReleaseMs,
            this.params.limiterLookaheadMs,
            this.params.limiterSoftClip
        );
    }
}
