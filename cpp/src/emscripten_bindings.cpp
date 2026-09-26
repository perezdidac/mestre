#include "../include/mastering_engine.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

static AudioDSP::MasteringEngine g_engine;

extern "C" {

WASM_EXPORT
void dsp_init(float sampleRate) {
    g_engine.init(sampleRate);
}

WASM_EXPORT
void dsp_reset() {
    g_engine.reset();
}

WASM_EXPORT
void dsp_set_bypass(int bypass) {
    g_engine.setBypass(bypass != 0);
}

WASM_EXPORT
void dsp_set_input_gain(float gainDb) {
    g_engine.setInputGainDb(gainDb);
}

WASM_EXPORT
void dsp_set_output_gain(float gainDb) {
    g_engine.setOutputGainDb(gainDb);
}

WASM_EXPORT
void dsp_set_eq_band(int bandIndex, float freqHz, float gainDb, float q, int filterType) {
    g_engine.setEqBand(bandIndex, freqHz, gainDb, q, filterType);
}

WASM_EXPORT
void dsp_set_eq_match_amount(float amount0to1) {
    g_engine.setEqMatchAmount(amount0to1);
}

WASM_EXPORT
void dsp_set_eq_all_bands(const float* deltaGainsDb, int count) {
    g_engine.setEqAllBands(deltaGainsDb, count);
}

WASM_EXPORT
void dsp_set_compressor(float thresholdDb, float ratio, float attackMs, float releaseMs, float kneeDb, float makeupDb) {
    g_engine.setCompressorParams(thresholdDb, ratio, attackMs, releaseMs, kneeDb, makeupDb);
}

WASM_EXPORT
void dsp_set_limiter(float ceilingDb, float releaseMs, float lookaheadMs, int softClip) {
    g_engine.setLimiterParams(ceilingDb, releaseMs, lookaheadMs, softClip != 0);
}

WASM_EXPORT
float* dsp_get_input_buffer_l() {
    return g_engine.getInputBufferL();
}

WASM_EXPORT
float* dsp_get_input_buffer_r() {
    return g_engine.getInputBufferR();
}

WASM_EXPORT
float* dsp_get_output_buffer_l() {
    return g_engine.getOutputBufferL();
}

WASM_EXPORT
float* dsp_get_output_buffer_r() {
    return g_engine.getOutputBufferR();
}

WASM_EXPORT
void dsp_process(int numFrames) {
    g_engine.process(numFrames);
}

WASM_EXPORT
float dsp_get_comp_reduction() {
    return g_engine.getCompressorGainReductionDb();
}

WASM_EXPORT
float dsp_get_limiter_reduction() {
    return g_engine.getLimiterGainReductionDb();
}

WASM_EXPORT
float dsp_get_momentary_lufs() {
    return g_engine.getMomentaryLufs();
}

WASM_EXPORT
float dsp_get_shortterm_lufs() {
    return g_engine.getShortTermLufs();
}

WASM_EXPORT
float dsp_get_integrated_lufs() {
    return g_engine.getIntegratedLufs();
}

} // extern "C"
