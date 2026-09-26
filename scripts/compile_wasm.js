const fs = require('fs');
const path = require('path');
const wabtModule = require('wabt');

async function compileWasm() {
    console.log('[Wasm Builder] Initializing WABT...');
    const wabt = await wabtModule();

    // Memory Layout constants:
    // Base 0x00000 (0):      Input Left (8192 f32 = 32768 bytes)
    // Base 0x08000 (32768):  Input Right (8192 f32 = 32768 bytes)
    // Base 0x10000 (65536):  Output Left (8192 f32 = 32768 bytes)
    // Base 0x18000 (98304):  Output Right (8192 f32 = 32768 bytes)
    // Base 0x20000 (131072): EQ Bands (32 bands * 40 bytes = 1280 bytes)
    // Base 0x22000 (139264): Limiter Delay Left (1024 f32 = 4096 bytes)
    // Base 0x23000 (143360): Limiter Delay Right (1024 f32 = 4096 bytes)
    // Base 0x24000 (147456): Control Registers & DSP State
    // Base 0x25000 (151552): Raw Delta Gains (32 f32 = 128 bytes)

    const watSource = `
    (module
        ;; 4 pages = 256 KB memory
        (memory (export "memory") 4)

        ;; Constants and offsets
        (global $IN_L i32 (i32.const 0))
        (global $IN_R i32 (i32.const 32768))
        (global $OUT_L i32 (i32.const 65536))
        (global $OUT_R i32 (i32.const 98304))
        (global $EQ_BASE i32 (i32.const 131072))
        (global $LIM_RING_L i32 (i32.const 139264))
        (global $LIM_RING_R i32 (i32.const 143360))
        (global $STATE_BASE i32 (i32.const 147456))
        (global $DELTA_GAINS i32 (i32.const 151552))

        ;; State variable offsets inside $STATE_BASE:
        ;; +0:  bypass (i32)
        ;; +4:  input_gain (f32)
        ;; +8:  output_gain (f32)
        ;; +12: match_amount (f32)
        ;; +16: comp_thresh_lin (f32)
        ;; +20: comp_ratio (f32)
        ;; +24: comp_attack_coeff (f32)
        ;; +28: comp_release_coeff (f32)
        ;; +32: comp_makeup_lin (f32)
        ;; +36: comp_envelope (f32)
        ;; +40: comp_gr_db (f32)
        ;; +44: lim_ceiling_lin (f32)
        ;; +48: lim_release_coeff (f32)
        ;; +52: lim_lookahead (i32)
        ;; +56: lim_soft_clip (i32)
        ;; +60: lim_idx (i32)
        ;; +64: lim_env_gain (f32)
        ;; +68: lim_gr_db (f32)
        ;; +72: sample_rate (f32)
        ;; +76: mom_lufs (f32)
        ;; +80: st_lufs (f32)
        ;; +84: int_lufs (f32)

        ;; Math helper: abs(f32)
        (func $f32_abs (param $x f32) (result f32)
            local.get $x
            f32.abs
        )

        ;; Math helper: max(f32, f32)
        (func $f32_max (param $a f32) (param $b f32) (result f32)
            local.get $a
            local.get $b
            f32.max
        )

        ;; Export: Init engine with sample rate
        (func (export "dsp_init") (param $sr f32)
            ;; Set sample rate
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 72)) (local.get $sr))
            ;; Set default input gain = 1.0
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 4)) (f32.const 1.0))
            ;; Set default output gain = 1.0
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 8)) (f32.const 1.0))
            ;; Set match amount = 1.0
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 12)) (f32.const 1.0))
            ;; Set bypass = 0
            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 0)) (i32.const 0))

            ;; Set default compressor: thresh 0.25 (-12dB), ratio 2.5, attack 0.05, release 0.002, makeup 1.0
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 16)) (f32.const 0.2511886))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 20)) (f32.const 2.5))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 24)) (f32.const 0.05))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 28)) (f32.const 0.002))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 32)) (f32.const 1.0))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 36)) (f32.const 0.0))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 40)) (f32.const 0.0))

            ;; Set default limiter: ceiling 0.977 (-0.2dB), release 0.001, lookahead 192 (4ms), softClip 1, envGain 1.0
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 44)) (f32.const 0.9772372))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 48)) (f32.const 0.001))
            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 52)) (i32.const 192))
            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 56)) (i32.const 1))
            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 60)) (i32.const 0))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 64)) (f32.const 1.0))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 68)) (f32.const 0.0))

            ;; Reset LUFS
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 76)) (f32.const -70.0))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 80)) (f32.const -70.0))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 84)) (f32.const -70.0))

            (call $reset_filters)
            (call $reset_limiter)
        )

        (func $reset_filters
            (local $i i32)
            (local $addr i32)
            (local.set $i (i32.const 0))
            (block $done
                (loop $loop
                    (br_if $done (i32.ge_s (local.get $i) (i32.const 32)))
                    (local.set $addr (i32.add (global.get $EQ_BASE) (i32.mul (local.get $i) (i32.const 40))))
                    ;; default b0 = 1.0, b1 = 0, b2 = 0, a1 = 0, a2 = 0
                    (f32.store (i32.add (local.get $addr) (i32.const 0)) (f32.const 1.0))
                    (f32.store (i32.add (local.get $addr) (i32.const 4)) (f32.const 0.0))
                    (f32.store (i32.add (local.get $addr) (i32.const 8)) (f32.const 0.0))
                    (f32.store (i32.add (local.get $addr) (i32.const 12)) (f32.const 0.0))
                    (f32.store (i32.add (local.get $addr) (i32.const 16)) (f32.const 0.0))
                    ;; s1_l, s2_l, s1_r, s2_r = 0
                    (f32.store (i32.add (local.get $addr) (i32.const 20)) (f32.const 0.0))
                    (f32.store (i32.add (local.get $addr) (i32.const 24)) (f32.const 0.0))
                    (f32.store (i32.add (local.get $addr) (i32.const 28)) (f32.const 0.0))
                    (f32.store (i32.add (local.get $addr) (i32.const 32)) (f32.const 0.0))
                    ;; enabled = 0
                    (i32.store (i32.add (local.get $addr) (i32.const 36)) (i32.const 0))

                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                    (br $loop)
                )
            )
        )

        (func $reset_limiter
            (local $i i32)
            (local.set $i (i32.const 0))
            (block $done
                (loop $loop
                    (br_if $done (i32.ge_s (local.get $i) (i32.const 1024)))
                    (f32.store (i32.add (global.get $LIM_RING_L) (i32.mul (local.get $i) (i32.const 4))) (f32.const 0.0))
                    (f32.store (i32.add (global.get $LIM_RING_R) (i32.mul (local.get $i) (i32.const 4))) (f32.const 0.0))
                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                    (br $loop)
                )
            )
            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 60)) (i32.const 0))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 64)) (f32.const 1.0))
        )

        (func (export "dsp_reset")
            (call $reset_filters)
            (call $reset_limiter)
        )

        ;; Export: Set Bypass
        (func (export "dsp_set_bypass") (param $b i32)
            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 0)) (local.get $b))
        )

        ;; Export: Set Input Gain (linear)
        (func (export "dsp_set_input_gain_lin") (param $g f32)
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 4)) (local.get $g))
        )

        ;; Export: Set Output Gain (linear)
        (func (export "dsp_set_output_gain_lin") (param $g f32)
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 8)) (local.get $g))
        )

        ;; Export: Set Match Amount
        (func (export "dsp_set_eq_match_amount") (param $amt f32)
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 12)) (local.get $amt))
        )

        ;; Export: Set Biquad Band Coefficients directly
        (func (export "dsp_set_eq_biquad_coeffs") 
            (param $bandIdx i32) 
            (param $b0 f32) (param $b1 f32) (param $b2 f32) 
            (param $a1 f32) (param $a2 f32)
            (param $enabled i32)
            (local $addr i32)
            (block $exit
                (br_if $exit (i32.ge_s (local.get $bandIdx) (i32.const 32)))
                (br_if $exit (i32.lt_s (local.get $bandIdx) (i32.const 0)))
                (local.set $addr (i32.add (global.get $EQ_BASE) (i32.mul (local.get $bandIdx) (i32.const 40))))
                (f32.store (i32.add (local.get $addr) (i32.const 0)) (local.get $b0))
                (f32.store (i32.add (local.get $addr) (i32.const 4)) (local.get $b1))
                (f32.store (i32.add (local.get $addr) (i32.const 8)) (local.get $b2))
                (f32.store (i32.add (local.get $addr) (i32.const 12)) (local.get $a1))
                (f32.store (i32.add (local.get $addr) (i32.const 16)) (local.get $a2))
                (i32.store (i32.add (local.get $addr) (i32.const 36)) (local.get $enabled))
            )
        )

        ;; Export: Set Compressor parameters
        (func (export "dsp_set_compressor")
            (param $threshLin f32) (param $ratio f32)
            (param $attCoeff f32) (param $relCoeff f32)
            (param $makeupLin f32)
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 16)) (local.get $threshLin))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 20)) (local.get $ratio))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 24)) (local.get $attCoeff))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 28)) (local.get $relCoeff))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 32)) (local.get $makeupLin))
        )

        ;; Export: Set Limiter parameters
        (func (export "dsp_set_limiter")
            (param $ceilLin f32) (param $relCoeff f32)
            (param $lookahead i32) (param $softClip i32)
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 44)) (local.get $ceilLin))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 48)) (local.get $relCoeff))
            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 52)) (local.get $lookahead))
            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 56)) (local.get $softClip))
        )

        ;; Buffer Pointer Exports
        (func (export "dsp_get_input_buffer_l") (result i32) global.get $IN_L)
        (func (export "dsp_get_input_buffer_r") (result i32) global.get $IN_R)
        (func (export "dsp_get_output_buffer_l") (result i32) global.get $OUT_L)
        (func (export "dsp_get_output_buffer_r") (result i32) global.get $OUT_R)
        (func (export "dsp_get_delta_gains_ptr") (result i32) global.get $DELTA_GAINS)

        ;; Metering Exports
        (func (export "dsp_get_comp_reduction") (result f32)
            (f32.load (i32.add (global.get $STATE_BASE) (i32.const 40)))
        )
        (func (export "dsp_get_limiter_reduction") (result f32)
            (f32.load (i32.add (global.get $STATE_BASE) (i32.const 68)))
        )
        (func (export "dsp_get_momentary_lufs") (result f32)
            (f32.load (i32.add (global.get $STATE_BASE) (i32.const 76)))
        )
        (func (export "dsp_get_shortterm_lufs") (result f32)
            (f32.load (i32.add (global.get $STATE_BASE) (i32.const 80)))
        )
        (func (export "dsp_get_integrated_lufs") (result f32)
            (f32.load (i32.add (global.get $STATE_BASE) (i32.const 84)))
        )

        ;; Main Processing Function: Process Block of Audio Frames
        (func (export "dsp_process") (param $numFrames i32)
            (local $frame i32)
            (local $inL f32) (local $inR f32)
            (local $outL f32) (local $outR f32)
            (local $bypass i32)
            (local $inputGain f32) (local $outputGain f32)

            ;; Compressor locals
            (local $compThresh f32) (local $compRatio f32)
            (local $compAttCoeff f32) (local $compRelCoeff f32)
            (local $compMakeup f32) (local $compEnv f32)
            (local $compPeak f32) (local $compTargetGain f32)
            (local $compGainLin f32)

            ;; Limiter locals
            (local $limCeil f32) (local $limRelCoeff f32)
            (local $limLookahead i32) (local $limSoftClip i32)
            (local $limIdx i32) (local $limEnvGain f32)
            (local $limReadIdx i32) (local $limTargetGain f32)
            (local $limPeak f32) (local $delayedL f32) (local $delayedR f32)

            ;; Filter loop locals
            (local $b i32) (local $bAddr i32) (local $bEnabled i32)
            (local $b0 f32) (local $b1 f32) (local $b2 f32)
            (local $a1 f32) (local $a2 f32)
            (local $s1_l f32) (local $s2_l f32) (local $s1_r f32) (local $s2_r f32)
            (local $tempOutL f32) (local $tempOutR f32)

            ;; Load global params once per block
            (local.set $bypass (i32.load (i32.add (global.get $STATE_BASE) (i32.const 0))))
            (local.set $inputGain (f32.load (i32.add (global.get $STATE_BASE) (i32.const 4))))
            (local.set $outputGain (f32.load (i32.add (global.get $STATE_BASE) (i32.const 8))))

            ;; Compressor state
            (local.set $compThresh (f32.load (i32.add (global.get $STATE_BASE) (i32.const 16))))
            (local.set $compRatio (f32.load (i32.add (global.get $STATE_BASE) (i32.const 20))))
            (local.set $compAttCoeff (f32.load (i32.add (global.get $STATE_BASE) (i32.const 24))))
            (local.set $compRelCoeff (f32.load (i32.add (global.get $STATE_BASE) (i32.const 28))))
            (local.set $compMakeup (f32.load (i32.add (global.get $STATE_BASE) (i32.const 32))))
            (local.set $compEnv (f32.load (i32.add (global.get $STATE_BASE) (i32.const 36))))

            ;; Limiter state
            (local.set $limCeil (f32.load (i32.add (global.get $STATE_BASE) (i32.const 44))))
            (local.set $limRelCoeff (f32.load (i32.add (global.get $STATE_BASE) (i32.const 48))))
            (local.set $limLookahead (i32.load (i32.add (global.get $STATE_BASE) (i32.const 52))))
            (local.set $limSoftClip (i32.load (i32.add (global.get $STATE_BASE) (i32.const 56))))
            (local.set $limIdx (i32.load (i32.add (global.get $STATE_BASE) (i32.const 60))))
            (local.set $limEnvGain (f32.load (i32.add (global.get $STATE_BASE) (i32.const 64))))

            (local.set $frame (i32.const 0))

            (block $block_done
                (loop $frame_loop
                    (br_if $block_done (i32.ge_s (local.get $frame) (local.get $numFrames)))

                    ;; Read input samples
                    (local.set $inL (f32.load (i32.add (global.get $IN_L) (i32.mul (local.get $frame) (i32.const 4)))))
                    (local.set $inR (f32.load (i32.add (global.get $IN_R) (i32.mul (local.get $frame) (i32.const 4)))))

                    ;; Bypass check
                    (if (i32.ne (local.get $bypass) (i32.const 0))
                        (then
                            ;; Direct passthrough
                            (f32.store (i32.add (global.get $OUT_L) (i32.mul (local.get $frame) (i32.const 4))) (local.get $inL))
                            (f32.store (i32.add (global.get $OUT_R) (i32.mul (local.get $frame) (i32.const 4))) (local.get $inR))
                        )
                        (else
                            ;; 1. Apply Input Gain
                            (local.set $inL (f32.mul (local.get $inL) (local.get $inputGain)))
                            (local.set $inR (f32.mul (local.get $inR) (local.get $inputGain)))

                            ;; 2. Cascaded EQ Filter Processing (32 bands)
                            (local.set $b (i32.const 0))
                            (block $eq_done
                                (loop $eq_loop
                                    (br_if $eq_done (i32.ge_s (local.get $b) (i32.const 32)))
                                    (local.set $bAddr (i32.add (global.get $EQ_BASE) (i32.mul (local.get $b) (i32.const 40))))
                                    (local.set $bEnabled (i32.load (i32.add (local.get $bAddr) (i32.const 36))))

                                    (if (i32.ne (local.get $bEnabled) (i32.const 0))
                                        (then
                                            (local.set $b0 (f32.load (i32.add (local.get $bAddr) (i32.const 0))))
                                            (local.set $b1 (f32.load (i32.add (local.get $bAddr) (i32.const 4))))
                                            (local.set $b2 (f32.load (i32.add (local.get $bAddr) (i32.const 8))))
                                            (local.set $a1 (f32.load (i32.add (local.get $bAddr) (i32.const 12))))
                                            (local.set $a2 (f32.load (i32.add (local.get $bAddr) (i32.const 16))))
                                            (local.set $s1_l (f32.load (i32.add (local.get $bAddr) (i32.const 20))))
                                            (local.set $s2_l (f32.load (i32.add (local.get $bAddr) (i32.const 24))))
                                            (local.set $s1_r (f32.load (i32.add (local.get $bAddr) (i32.const 28))))
                                            (local.set $s2_r (f32.load (i32.add (local.get $bAddr) (i32.const 32))))

                                            ;; Process Left Channel: Direct Form II Transposed
                                            (local.set $tempOutL (f32.add (f32.mul (local.get $b0) (local.get $inL)) (local.get $s1_l)))
                                            (local.set $s1_l (f32.add (f32.sub (f32.mul (local.get $b1) (local.get $inL)) (f32.mul (local.get $a1) (local.get $tempOutL))) (local.get $s2_l)))
                                            (local.set $s2_l (f32.sub (f32.mul (local.get $b2) (local.get $inL)) (f32.mul (local.get $a2) (local.get $tempOutL))))
                                            (local.set $inL (local.get $tempOutL))

                                            ;; Process Right Channel
                                            (local.set $tempOutR (f32.add (f32.mul (local.get $b0) (local.get $inR)) (local.get $s1_r)))
                                            (local.set $s1_r (f32.add (f32.sub (f32.mul (local.get $b1) (local.get $inR)) (f32.mul (local.get $a1) (local.get $tempOutR))) (local.get $s2_r)))
                                            (local.set $s2_r (f32.sub (f32.mul (local.get $b2) (local.get $inR)) (f32.mul (local.get $a2) (local.get $tempOutR))))
                                            (local.set $inR (local.get $tempOutR))

                                            ;; Save updated filter states
                                            (f32.store (i32.add (local.get $bAddr) (i32.const 20)) (local.get $s1_l))
                                            (f32.store (i32.add (local.get $bAddr) (i32.const 24)) (local.get $s2_l))
                                            (f32.store (i32.add (local.get $bAddr) (i32.const 28)) (local.get $s1_r))
                                            (f32.store (i32.add (local.get $bAddr) (i32.const 32)) (local.get $s2_r))
                                        )
                                    )

                                    (local.set $b (i32.add (local.get $b) (i32.const 1)))
                                    (br $eq_loop)
                                )
                            )

                            ;; 3. Compressor
                            (local.set $compPeak (call $f32_max (call $f32_abs (local.get $inL)) (call $f32_abs (local.get $inR))))
                            (local.set $compTargetGain (f32.const 1.0))
                            (if (f32.gt (local.get $compPeak) (local.get $compThresh))
                                (then
                                    ;; Target gain = (thresh + (peak - thresh) / ratio) / peak
                                    (local.set $compTargetGain 
                                        (f32.div 
                                            (f32.add (local.get $compThresh) (f32.div (f32.sub (local.get $compPeak) (local.get $compThresh)) (local.get $compRatio)))
                                            (local.get $compPeak)
                                        )
                                    )
                                )
                            )

                            ;; Ballistics smoothing: compEnv tracks gain reduction
                            (if (f32.lt (local.get $compTargetGain) (local.get $compEnv))
                                (then
                                    ;; Attack
                                    (local.set $compEnv (f32.add (local.get $compEnv) (f32.mul (local.get $compAttCoeff) (f32.sub (local.get $compTargetGain) (local.get $compEnv)))))
                                )
                                (else
                                    ;; Release
                                    (local.set $compEnv (f32.add (local.get $compEnv) (f32.mul (local.get $compRelCoeff) (f32.sub (local.get $compTargetGain) (local.get $compEnv)))))
                                )
                            )

                            (local.set $compGainLin (f32.mul (local.get $compEnv) (local.get $compMakeup)))
                            (local.set $inL (f32.mul (local.get $inL) (local.get $compGainLin)))
                            (local.set $inR (f32.mul (local.get $inR) (local.get $compGainLin)))

                            ;; 4. Limiter with Lookahead Ring Buffer
                            (local.set $limPeak (call $f32_max (call $f32_abs (local.get $inL)) (call $f32_abs (local.get $inR))))
                            (local.set $limTargetGain (f32.const 1.0))
                            (if (f32.gt (local.get $limPeak) (local.get $limCeil))
                                (then
                                    (local.set $limTargetGain (f32.div (local.get $limCeil) (local.get $limPeak)))
                                )
                            )

                            ;; Attack is immediate lookahead catch, release is smooth
                            (if (f32.lt (local.get $limTargetGain) (local.get $limEnvGain))
                                (then
                                    (local.set $limEnvGain (local.get $limTargetGain))
                                )
                                (else
                                    (local.set $limEnvGain (f32.add (local.get $limEnvGain) (f32.mul (local.get $limRelCoeff) (f32.sub (f32.const 1.0) (local.get $limEnvGain)))))
                                )
                            )

                            ;; Write to lookahead delay ring buffer
                            (f32.store (i32.add (global.get $LIM_RING_L) (i32.mul (local.get $limIdx) (i32.const 4))) (local.get $inL))
                            (f32.store (i32.add (global.get $LIM_RING_R) (i32.mul (local.get $limIdx) (i32.const 4))) (local.get $inR))

                            ;; Read delayed sample
                            (local.set $limReadIdx (i32.sub (local.get $limIdx) (local.get $limLookahead)))
                            (if (i32.lt_s (local.get $limReadIdx) (i32.const 0))
                                (then
                                    (local.set $limReadIdx (i32.add (local.get $limReadIdx) (i32.const 1024)))
                                )
                            )

                            (local.set $delayedL (f32.load (i32.add (global.get $LIM_RING_L) (i32.mul (local.get $limReadIdx) (i32.const 4)))))
                            (local.set $delayedR (f32.load (i32.add (global.get $LIM_RING_R) (i32.mul (local.get $limReadIdx) (i32.const 4)))))

                            ;; Advance ring pointer (modulo 1024)
                            (local.set $limIdx (i32.rem_u (i32.add (local.get $limIdx) (i32.const 1)) (i32.const 1024)))

                            ;; Apply limiter gain
                            (local.set $outL (f32.mul (local.get $delayedL) (local.get $limEnvGain)))
                            (local.set $outR (f32.mul (local.get $delayedR) (local.get $limEnvGain)))

                            ;; Soft-clip saturation taper if enabled
                            (if (i32.ne (local.get $limSoftClip) (i32.const 0))
                                (then
                                    (local.set $outL (call $soft_clip (local.get $outL) (local.get $limCeil)))
                                    (local.set $outR (call $soft_clip (local.get $outR) (local.get $limCeil)))
                                )
                            )

                            ;; 5. Output Gain
                            (local.set $outL (f32.mul (local.get $outL) (local.get $outputGain)))
                            (local.set $outR (f32.mul (local.get $outR) (local.get $outputGain)))

                            ;; Store to Output Buffers
                            (f32.store (i32.add (global.get $OUT_L) (i32.mul (local.get $frame) (i32.const 4))) (local.get $outL))
                            (f32.store (i32.add (global.get $OUT_R) (i32.mul (local.get $frame) (i32.const 4))) (local.get $outR))
                        )
                    )

                    (local.set $frame (i32.add (local.get $frame) (i32.const 1)))
                    (br $frame_loop)
                )
            )

            ;; Save back persistent states at end of audio block
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 36)) (local.get $compEnv))
            ;; GR in dB: approximate dB = (1.0 - env) * 20.0 (or negative)
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 40)) 
                (f32.mul (f32.sub (f32.const 1.0) (local.get $compEnv)) (f32.const 20.0))
            )

            (i32.store (i32.add (global.get $STATE_BASE) (i32.const 60)) (local.get $limIdx))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 64)) (local.get $limEnvGain))
            (f32.store (i32.add (global.get $STATE_BASE) (i32.const 68))
                (f32.mul (f32.sub (f32.const 1.0) (local.get $limEnvGain)) (f32.const 20.0))
            )
        )

        ;; Cubic Soft clipper function
        (func $soft_clip (param $x f32) (param $ceil f32) (result f32)
            (local $knee f32)
            (local $absX f32)
            (local $sign f32)
            (local $over f32)
            (local.set $knee (f32.mul (local.get $ceil) (f32.const 0.85)))
            (local.set $absX (call $f32_abs (local.get $x)))
            (if (f32.le (local.get $absX) (local.get $knee))
                (then (return (local.get $x)))
            )
            (local.set $sign (select (f32.const 1.0) (f32.const -1.0) (f32.ge (local.get $x) (f32.const 0.0))))
            (local.set $over (f32.div (f32.sub (local.get $absX) (local.get $knee)) (f32.sub (local.get $ceil) (local.get $knee))))
            (if (f32.ge (local.get $over) (f32.const 1.0))
                (then (return (f32.mul (local.get $sign) (local.get $ceil))))
            )
            ;; Hermite cubic: knee + (ceil - knee) * (over - (over*over*over)/3)
            (f32.mul (local.get $sign) 
                (f32.add (local.get $knee) 
                    (f32.mul (f32.sub (local.get $ceil) (local.get $knee)) 
                        (f32.sub (local.get $over) (f32.div (f32.mul (f32.mul (local.get $over) (local.get $over)) (local.get $over)) (f32.const 3.0)))
                    )
                )
            )
        )
    )
    `;

    console.log('[Wasm Builder] Parsing WAT source with WABT...');
    const parsed = wabt.parseWat('dsp_engine.wat', watSource);
    const { buffer } = parsed.toBinary({ log: false, canonicalize_lebs: true, relocatable: false });

    const outPath = path.join(__dirname, '..', 'public', 'dsp_engine.wasm');
    fs.writeFileSync(outPath, Buffer.from(buffer));
    console.log(`[Wasm Builder] Successfully compiled Wasm binary! (${buffer.length} bytes) -> ${outPath}`);
}

compileWasm().catch(err => {
    console.error('[Wasm Builder] Compilation failed:', err);
    process.exit(1);
});
