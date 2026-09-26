#pragma once

#include "biquad.hpp"
#include "compressor.hpp"
#include "limiter.hpp"
#include "lufs.hpp"
#include "fft.hpp"
#include <vector>

namespace AudioDSP {

class MasteringEngine {
public:
    static constexpr int MAX_BLOCK_SIZE = 8192;

    MasteringEngine();
    ~MasteringEngine() = default;

    void init(float sampleRate);
    void reset();

    // Parameter setters
    void setBypass(bool bypass);
    void setInputGainDb(float gainDb);
    void setOutputGainDb(float gainDb);

    // EQ parameters
    void setEqBand(int bandIndex, float freqHz, float gainDb, float q, int filterType);
    void setEqMatchAmount(float amount0to1);
    void setEqAllBands(const float* deltaGainsDb, int count);

    // Dynamics parameters
    void setCompressorParams(float thresholdDb, float ratio, float attackMs, float releaseMs, float kneeDb, float makeupDb);
    void setLimiterParams(float ceilingDb, float releaseMs, float lookaheadMs, bool softClip);

    // Buffer pointers for WASM linear memory transfer
    float* getInputBufferL() { return inputBufferL.data(); }
    float* getInputBufferR() { return inputBufferR.data(); }
    float* getOutputBufferL() { return outputBufferL.data(); }
    float* getOutputBufferR() { return outputBufferR.data(); }

    // Core DSP processing block
    void process(int numFrames);

    // Metering telemetry
    float getCompressorGainReductionDb() const;
    float getLimiterGainReductionDb() const;
    float getMomentaryLufs();
    float getShortTermLufs();
    float getIntegratedLufs();

private:
    float sampleRate{48000.0f};
    bool isBypassed{false};
    float inputGainLinear{1.0f};
    float outputGainLinear{1.0f};

    MultiBandEQ eq;
    StereoCompressor compressor;
    MasteringLimiter limiter;
    LoudnessMeterBS1770 loudnessMeter;

    std::vector<float> inputBufferL;
    std::vector<float> inputBufferR;
    std::vector<float> outputBufferL;
    std::vector<float> outputBufferR;
};

} // namespace AudioDSP
