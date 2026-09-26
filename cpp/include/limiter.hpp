#pragma once

#include <cmath>
#include <vector>
#include <algorithm>

namespace AudioDSP {

class MasteringLimiter {
public:
    static constexpr int MAX_LOOKAHEAD_SAMPLES = 1024; // Up to ~21ms at 48kHz

    MasteringLimiter()
        : sampleRate(48000.0f)
        , ceilingDb(-0.2f)
        , releaseMs(80.0f)
        , lookaheadMs(4.0f)
        , softClip(true)
        , currentGainReductionDb(0.0f)
        , bufferIndex(0)
        , lookaheadSamples(192)
        , envGain(1.0f)
    {
        delayBufferL.resize(MAX_LOOKAHEAD_SAMPLES, 0.0f);
        delayBufferR.resize(MAX_LOOKAHEAD_SAMPLES, 0.0f);
        updateParameters();
    }

    void setSampleRate(float sr) {
        if (sr > 0.0f) {
            sampleRate = sr;
            updateParameters();
        }
    }

    void setParameters(float ceiling, float release, float lookahead, bool enableSoftClip) {
        ceilingDb = std::clamp(ceiling, -12.0f, 0.0f);
        releaseMs = std::clamp(release, 5.0f, 1000.0f);
        lookaheadMs = std::clamp(lookahead, 0.5f, 15.0f);
        softClip = enableSoftClip;
        updateParameters();
    }

    void reset() {
        std::fill(delayBufferL.begin(), delayBufferL.end(), 0.0f);
        std::fill(delayBufferR.begin(), delayBufferR.end(), 0.0f);
        bufferIndex = 0;
        envGain = 1.0f;
        currentGainReductionDb = 0.0f;
    }

    float getCurrentGainReductionDb() const {
        return currentGainReductionDb;
    }

    inline void processStereo(float inL, float inR, float& outL, float& outR) {
        // 1. Calculate future peak from current input
        float absL = std::abs(inL);
        float absR = std::abs(inR);
        float peak = std::max(absL, absR);

        // Required target gain to keep peak below ceiling
        float targetGain = 1.0f;
        if (peak > ceilingLinear) {
            targetGain = ceilingLinear / peak;
        }

        // Fast attack / lookahead gain tracking
        if (targetGain < envGain) {
            // Immediate fast attack to catch transient ahead of delayed audio
            envGain = targetGain;
        } else {
            // Smooth exponential release recovery
            envGain += releaseCoeff * (1.0f - envGain);
        }

        // Store current input in lookahead ring buffer
        delayBufferL[bufferIndex] = inL;
        delayBufferR[bufferIndex] = inR;

        // Retrieve delayed audio sample
        int readIndex = bufferIndex - lookaheadSamples;
        if (readIndex < 0) {
            readIndex += MAX_LOOKAHEAD_SAMPLES;
        }

        float delayedL = delayBufferL[readIndex];
        float delayedR = delayBufferR[readIndex];

        // Increment ring buffer pointer
        bufferIndex = (bufferIndex + 1) % MAX_LOOKAHEAD_SAMPLES;

        // Apply limiter gain reduction
        float limitedL = delayedL * envGain;
        float limitedR = delayedR * envGain;

        // Optional analog warmth soft-clipping / tanh curve near ceiling
        if (softClip) {
            limitedL = applySoftClip(limitedL, ceilingLinear);
            limitedR = applySoftClip(limitedR, ceilingLinear);
        } else {
            // Hard safety clamp at ceiling
            limitedL = std::clamp(limitedL, -ceilingLinear, ceilingLinear);
            limitedR = std::clamp(limitedR, -ceilingLinear, ceilingLinear);
        }

        outL = limitedL;
        outR = limitedR;

        // Update gain reduction meter in dB
        float gr = (envGain < 0.999f) ? 20.0f * std::log10(std::max(envGain, 1e-4f)) : 0.0f;
        currentGainReductionDb = -gr; // positive dB reduction value
    }

private:
    void updateParameters() {
        ceilingLinear = std::pow(10.0f, ceilingDb / 20.0f);
        lookaheadSamples = static_cast<int>((lookaheadMs * 0.001f) * sampleRate);
        lookaheadSamples = std::clamp(lookaheadSamples, 1, MAX_LOOKAHEAD_SAMPLES - 1);
        
        // Release coefficient for exponential smoothing: y[n] = y[n-1] + coeff * (target - y[n-1])
        releaseCoeff = 1.0f - std::exp(-1.0f / ((releaseMs * 0.001f) * sampleRate));
    }

    // High quality cubic / polynomial soft saturation
    inline float applySoftClip(float x, float ceiling) {
        float kneeStart = ceiling * 0.85f;
        float absX = std::abs(x);

        if (absX <= kneeStart) {
            return x;
        }

        // Polynomial soft taper between kneeStart and ceiling
        float sign = (x > 0.0f) ? 1.0f : -1.0f;
        float over = (absX - kneeStart) / (ceiling - kneeStart);
        if (over >= 1.0f) {
            return sign * ceiling;
        }
        
        // Smooth Hermite curve
        float smoothed = kneeStart + (ceiling - kneeStart) * (over - (over * over * over) / 3.0f);
        return sign * std::min(smoothed, ceiling);
    }

    float sampleRate;
    float ceilingDb;
    float ceilingLinear{0.977f}; // -0.2 dB
    float releaseMs;
    float lookaheadMs;
    bool softClip;

    float releaseCoeff{0.001f};
    float currentGainReductionDb;
    int bufferIndex;
    int lookaheadSamples;
    float envGain;

    std::vector<float> delayBufferL;
    std::vector<float> delayBufferR;
};

} // namespace AudioDSP
