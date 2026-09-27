/**
 * AudioWorklet Processor for local WebAssembly DSP Mastering Chain
 * Runs on dedicated audio rendering thread for zero-dropout real-time playback.
 */

class DSPMasteringProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.wasmInstance = null;
        this.wasmMemory = null;
        this.wasmExports = null;
        this.isReady = false;

        // Linear memory pointers
        this.ptrInL = 0;
        this.ptrInR = 32768;
        this.ptrOutL = 65536;
        this.ptrOutR = 98304;

        this.memF32 = null;

        // Telemetry throttle
        this.telemetryCounter = 0;
        this.telemetryInterval = 16; // ~43ms at 48kHz / 128 frames

        this.port.onmessage = async (event) => {
            const data = event.data;
            if (!data) return;

            switch (data.type) {
                case 'INIT_WASM':
                    await this.initWasm(data.wasmBytes || data.wasmModule, data.sampleRate);
                    break;

                case 'SET_BYPASS':
                    if (this.wasmExports) {
                        this.wasmExports.dsp_set_bypass(data.value ? 1 : 0);
                    }
                    break;

                case 'SET_INPUT_GAIN':
                    if (this.wasmExports) {
                        this.wasmExports.dsp_set_input_gain_lin(data.value);
                    }
                    break;

                case 'SET_OUTPUT_GAIN':
                    if (this.wasmExports) {
                        this.wasmExports.dsp_set_output_gain_lin(data.value);
                    }
                    break;

                case 'SET_EQ_MATCH_AMOUNT':
                    if (this.wasmExports) {
                        this.wasmExports.dsp_set_eq_match_amount(data.value);
                    }
                    break;

                case 'SET_EQ_BAND':
                    if (this.wasmExports) {
                        this.wasmExports.dsp_set_eq_biquad_coeffs(
                            data.bandIdx,
                            data.b0, data.b1, data.b2,
                            data.a1, data.a2,
                            data.enabled ? 1 : 0
                        );
                    }
                    break;

                case 'SET_ALL_EQ_BANDS':
                    if (this.wasmExports && Array.isArray(data.bands)) {
                        for (let i = 0; i < data.bands.length; i++) {
                            const b = data.bands[i];
                            this.wasmExports.dsp_set_eq_biquad_coeffs(
                                i,
                                b.b0, b.b1, b.b2,
                                b.a1, b.a2,
                                b.enabled ? 1 : 0
                            );
                        }
                    }
                    break;

                case 'SET_COMPRESSOR':
                    if (this.wasmExports) {
                        this.wasmExports.dsp_set_compressor(
                            data.threshLin,
                            data.ratio,
                            data.attCoeff,
                            data.relCoeff,
                            data.makeupLin
                        );
                    }
                    break;

                case 'SET_LIMITER':
                    if (this.wasmExports) {
                        this.wasmExports.dsp_set_limiter(
                            data.ceilLin,
                            data.relCoeff,
                            data.lookahead,
                            data.softClip ? 1 : 0
                        );
                    }
                    break;

                case 'RESET':
                    if (this.wasmExports) {
                        this.wasmExports.dsp_reset();
                    }
                    break;
            }
        };
    }

    async initWasm(source, sampleRate) {
        try {
            let instance;
            if (source && (source instanceof ArrayBuffer || source.byteLength !== undefined)) {
                const res = await WebAssembly.instantiate(source);
                instance = res.instance || res;
            } else if (source && source.buffer && (source.buffer instanceof ArrayBuffer || source.buffer.byteLength !== undefined)) {
                const res = await WebAssembly.instantiate(source.buffer);
                instance = res.instance || res;
            } else if (source) {
                const res = await WebAssembly.instantiate(source);
                instance = res.instance || res;
            } else {
                throw new Error('No WASM binary source provided to AudioWorklet');
            }

            this.wasmInstance = instance;

            this.wasmExports = this.wasmInstance.exports;
            this.wasmMemory = this.wasmExports.memory;
            this.memF32 = new Float32Array(this.wasmMemory.buffer);

            this.ptrInL = this.wasmExports.dsp_get_input_buffer_l();
            this.ptrInR = this.wasmExports.dsp_get_input_buffer_r();
            this.ptrOutL = this.wasmExports.dsp_get_output_buffer_l();
            this.ptrOutR = this.wasmExports.dsp_get_output_buffer_r();

            this.wasmExports.dsp_init(sampleRate || 48000.0);
            this.isReady = true;

            this.port.postMessage({ type: 'WASM_READY' });
        } catch (err) {
            console.error('[AudioWorklet] WASM initialization failed:', err);
            this.port.postMessage({ type: 'WASM_ERROR', error: err.message });
        }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (!output || output.length === 0) return true;

        const outL = output[0];
        const outR = output[1] || output[0];

        // If no input is active, output silence
        if (!input || input.length === 0 || !input[0] || input[0].length === 0) {
            outL.fill(0);
            if (output[1]) outR.fill(0);
            return true;
        }

        const inL = input[0];
        const inR = input[1] || input[0];
        const numFrames = inL.length; // usually 128

        // If WASM engine is not ready, passthrough cleanly
        if (!this.isReady || !this.wasmExports) {
            outL.set(inL);
            if (output[1]) outR.set(inR);
            return true;
        }

        // Keep float32 view synchronized if memory grew
        if (this.memF32.buffer !== this.wasmMemory.buffer) {
            this.memF32 = new Float32Array(this.wasmMemory.buffer);
        }

        // Copy input frames to WASM linear memory
        const inLOffset = this.ptrInL >> 2;
        const inROffset = this.ptrInR >> 2;
        this.memF32.set(inL, inLOffset);
        this.memF32.set(inR, inROffset);

        // Execute DSP processing block in WebAssembly
        this.wasmExports.dsp_process(numFrames);

        // Copy processed audio back to AudioWorklet output buffers
        const outLOffset = this.ptrOutL >> 2;
        const outROffset = this.ptrOutR >> 2;
        outL.set(this.memF32.subarray(outLOffset, outLOffset + numFrames));
        if (output[1]) {
            outR.set(this.memF32.subarray(outROffset, outROffset + numFrames));
        }

        // Telemetry metering update
        this.telemetryCounter++;
        if (this.telemetryCounter >= this.telemetryInterval) {
            this.telemetryCounter = 0;
            const compGR = this.wasmExports.dsp_get_comp_reduction();
            const limGR = this.wasmExports.dsp_get_limiter_reduction();
            this.port.postMessage({
                type: 'METERING_UPDATE',
                compGR: compGR,
                limGR: limGR
            });
        }

        return true;
    }
}

registerProcessor('dsp-mastering-processor', DSPMasteringProcessor);
