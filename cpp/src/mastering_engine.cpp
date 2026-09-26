#include "../include/mastering_engine.hpp"

namespace AudioDSP {

MasteringEngine::MasteringEngine() {
    inputBufferL.resize(MAX_BLOCK_SIZE, 0.0f);
    inputBufferR.resize(MAX_BLOCK_SIZE, 0.0f);
    outputBufferL.resize(MAX_BLOCK_SIZE, 0.0f);
    outputBufferR.resize(MAX_BLOCK_SIZE, 0.0f);
    init(48000.0f);
}

void MasteringEngine::init(float sr) {
    sampleRate = (sr > 0.0f) ? sr : 48000.0f;
    eq.setSampleRate(sampleRate);
    compressor.setSampleRate(sampleRate);
    limiter.setSampleRate(sampleRate);
    loudnessMeter.setSampleRate(sampleRate);
    reset();
}

void MasteringEngine::reset() {
    eq.reset();
    compressor.reset();
    limiter.reset();
    loudnessMeter.reset();
}

void MasteringEngine::setBypass(bool bypass) {
    isBypassed = bypass;
}

void MasteringEngine::setInputGainDb(float gainDb) {
    inputGainLinear = std::pow(10.0f, gainDb / 20.0f);
}

void MasteringEngine::setOutputGainDb(float gainDb) {
    outputGainLinear = std::pow(10.0f, gainDb / 20.0f);
}

void MasteringEngine::setEqBand(int bandIndex, float freqHz, float gainDb, float q, int filterType) {
    FilterType ftype = static_cast<FilterType>(filterType);
    eq.setBand(bandIndex, freqHz, gainDb, q, ftype);
}

void MasteringEngine::setEqMatchAmount(float amount0to1) {
    eq.setMatchAmount(amount0to1);
}

void MasteringEngine::setEqAllBands(const float* deltaGainsDb, int count) {
    eq.setDeltaGains(deltaGainsDb, count);
}

void MasteringEngine::setCompressorParams(float thresholdDb, float ratio, float attackMs, float releaseMs, float kneeDb, float makeupDb) {
    compressor.setParameters(thresholdDb, ratio, attackMs, releaseMs, kneeDb, makeupDb);
}

void MasteringEngine::setLimiterParams(float ceilingDb, float releaseMs, float lookaheadMs, bool softClip) {
    limiter.setParameters(ceilingDb, releaseMs, lookaheadMs, softClip);
}

void MasteringEngine::process(int numFrames) {
    int frames = std::clamp(numFrames, 0, MAX_BLOCK_SIZE);

    if (isBypassed) {
        // Direct pass-through if bypassed
        for (int i = 0; i < frames; ++i) {
            outputBufferL[i] = inputBufferL[i];
            outputBufferR[i] = inputBufferR[i];
        }
        return;
    }

    for (int i = 0; i < frames; ++i) {
        // 1. Input Gain Stage
        float sL = inputBufferL[i] * inputGainLinear;
        float sR = inputBufferR[i] * inputGainLinear;

        // 2. Multi-Band Match EQ Stage
        eq.processStereo(sL, sR, sL, sR);

        // 3. Stereo Dynamics Compressor Stage
        compressor.processStereo(sL, sR, sL, sR);

        // 4. Brickwall Lookahead Limiter Stage
        limiter.processStereo(sL, sR, sL, sR);

        // 5. Output Gain Trim
        sL *= outputGainLinear;
        sR *= outputGainLinear;

        // 6. Loudness Metering Update
        loudnessMeter.processFrame(sL, sR);

        outputBufferL[i] = sL;
        outputBufferR[i] = sR;
    }
}

float MasteringEngine::getCompressorGainReductionDb() const {
    return compressor.getCurrentGainReductionDb();
}

float MasteringEngine::getLimiterGainReductionDb() const {
    return limiter.getCurrentGainReductionDb();
}

float MasteringEngine::getMomentaryLufs() {
    return loudnessMeter.getMomentaryLUFS();
}

float MasteringEngine::getShortTermLufs() {
    return loudnessMeter.getShortTermLUFS();
}

float MasteringEngine::getIntegratedLufs() {
    return loudnessMeter.getIntegratedLUFS();
}

} // namespace AudioDSP
