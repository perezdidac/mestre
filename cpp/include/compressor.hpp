#pragma once

#include <cmath>
#include <algorithm>

namespace AudioDSP {

class StereoCompressor {
public:
    StereoCompressor()
        : sampleRate(48000.0f)
        , thresholdDb(-16.0f)
        , ratio(2.5f)
        , attackMs(20.0f)
        , releaseMs(150.0f)
        , kneeDb(6.0f)
        , makeupGainDb(0.0f)
        , envelopeState(0.0f)
        , currentGainReductionDb(0.0f)
    {
        updateCoefficients();
    }

    void setSampleRate(float sr) {
        if (sr > 0.0f) {
            sampleRate = sr;
            updateCoefficients();
        }
    }

    void setParameters(float threshold, float compRatio, float attack, float release, float knee, float makeup) {
        thresholdDb = std::clamp(threshold, -60.0f, 0.0f);
        ratio = std::clamp(compRatio, 1.0f, 30.0f);
        attackMs = std::max(0.1f, attack);
        releaseMs = std::max(5.0f, release);
        kneeDb = std::clamp(knee, 0.0f, 24.0f);
        makeupGainDb = std::clamp(makeup, -12.0f, 24.0f);
        updateCoefficients();
    }

    void reset() {
        envelopeState = 0.0f;
        currentGainReductionDb = 0.0f;
    }

    float getCurrentGainReductionDb() const {
        return currentGainReductionDb;
    }

    // Process a single stereo sample frame
    inline void processStereo(float inL, float inR, float& outL, float& outR) {
        // Stereo link: take peak amplitude between Left and Right
        float absL = std::abs(inL);
        float absR = std::abs(inR);
        float inputLevelLinear = std::max(absL, absR);

        // Convert to dBFS
        float inputLevelDb = (inputLevelLinear > 1e-6f)
            ? 20.0f * std::log10(inputLevelLinear)
            : -120.0f;

        // Static compression curve calculation with soft knee
        float targetGainReductionDb = 0.0f;
        float halfKnee = kneeDb * 0.5f;

        if (inputLevelDb < (thresholdDb - halfKnee)) {
            // Below knee: 1:1 ratio
            targetGainReductionDb = 0.0f;
        } else if (inputLevelDb > (thresholdDb + halfKnee)) {
            // Above knee: full compression ratio
            float overshoot = inputLevelDb - thresholdDb;
            targetGainReductionDb = overshoot * (1.0f - 1.0f / ratio);
        } else if (kneeDb > 0.001f) {
            // Within soft knee curve (quadratic transition)
            float delta = inputLevelDb - thresholdDb + halfKnee;
            float kneeFactor = (delta * delta) / (2.0f * kneeDb);
            targetGainReductionDb = kneeFactor * (1.0f - 1.0f / ratio);
        }

        // Ballistics: Attack / Release envelope follower
        float envCoeff = (targetGainReductionDb > envelopeState) ? attackCoeff : releaseCoeff;
        envelopeState += envCoeff * (targetGainReductionDb - envelopeState);
        currentGainReductionDb = envelopeState;

        // Apply gain reduction and makeup gain
        float netGainDb = -envelopeState + makeupGainDb;
        float linearGain = std::pow(10.0f, netGainDb / 20.0f);

        outL = inL * linearGain;
        outR = inR * linearGain;
    }

private:
    void updateCoefficients() {
        // Time constants t_63: exp(-1 / (time_in_seconds * sampleRate))
        attackCoeff = 1.0f - std::exp(-1.0f / ((attackMs * 0.001f) * sampleRate));
        releaseCoeff = 1.0f - std::exp(-1.0f / ((releaseMs * 0.001f) * sampleRate));
    }

    float sampleRate;
    float thresholdDb;
    float ratio;
    float attackMs;
    float releaseMs;
    float kneeDb;
    float makeupGainDb;

    float attackCoeff{0.1f};
    float releaseCoeff{0.001f};
    float envelopeState{0.0f};
    float currentGainReductionDb{0.0f};
};

} // namespace AudioDSP
