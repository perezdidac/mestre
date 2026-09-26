#pragma once

#include <cmath>
#include <vector>
#include <algorithm>

namespace AudioDSP {

enum class FilterType {
    Peaking = 0,
    LowShelf,
    HighShelf,
    HighPass,
    LowPass,
    BandPass,
    Notch
};

class BiquadFilter {
public:
    BiquadFilter() {
        reset();
    }

    void reset() {
        s1_L = s2_L = 0.0f;
        s1_R = s2_R = 0.0f;
        b0 = 1.0f; b1 = 0.0f; b2 = 0.0f;
        a1 = 0.0f; a2 = 0.0f;
        target_b0 = 1.0f; target_b1 = 0.0f; target_b2 = 0.0f;
        target_a1 = 0.0f; target_a2 = 0.0f;
    }

    void configure(FilterType type, float sampleRate, float frequencyHz, float gainDb, float qFactor) {
        if (sampleRate <= 0.0f) sampleRate = 48000.0f;
        
        // Clamp frequency to Nyquist safe range
        float nyquist = sampleRate * 0.495f;
        float f0 = std::clamp(frequencyHz, 10.0f, nyquist);
        float Q = std::clamp(qFactor, 0.1f, 30.0f);
        float A = std::pow(10.0f, gainDb / 40.0f); // sqrt(10^(G/20))
        float w0 = 2.0f * static_cast<float>(M_PI) * (f0 / sampleRate);
        float cosW = std::cos(w0);
        float sinW = std::sin(w0);
        float alpha = sinW / (2.0f * Q);

        float a0_inv = 1.0f;
        float raw_b0 = 1.0f, raw_b1 = 0.0f, raw_b2 = 0.0f;
        float raw_a0 = 1.0f, raw_a1 = 0.0f, raw_a2 = 0.0f;

        switch (type) {
            case FilterType::Peaking: {
                raw_b0 = 1.0f + alpha * A;
                raw_b1 = -2.0f * cosW;
                raw_b2 = 1.0f - alpha * A;
                raw_a0 = 1.0f + alpha / A;
                raw_a1 = -2.0f * cosW;
                raw_a2 = 1.0f - alpha / A;
                break;
            }
            case FilterType::LowShelf: {
                float sqrtA = std::sqrt(A);
                raw_b0 = A * ((A + 1.0f) - (A - 1.0f) * cosW + 2.0f * sqrtA * alpha);
                raw_b1 = 2.0f * A * ((A - 1.0f) - (A + 1.0f) * cosW);
                raw_b2 = A * ((A + 1.0f) - (A - 1.0f) * cosW - 2.0f * sqrtA * alpha);
                raw_a0 = (A + 1.0f) + (A - 1.0f) * cosW + 2.0f * sqrtA * alpha;
                raw_a1 = -2.0f * ((A - 1.0f) + (A + 1.0f) * cosW);
                raw_a2 = (A + 1.0f) + (A - 1.0f) * cosW - 2.0f * sqrtA * alpha;
                break;
            }
            case FilterType::HighShelf: {
                float sqrtA = std::sqrt(A);
                raw_b0 = A * ((A + 1.0f) + (A - 1.0f) * cosW + 2.0f * sqrtA * alpha);
                raw_b1 = -2.0f * A * ((A - 1.0f) + (A + 1.0f) * cosW);
                raw_b2 = A * ((A + 1.0f) + (A - 1.0f) * cosW - 2.0f * sqrtA * alpha);
                raw_a0 = (A + 1.0f) - (A - 1.0f) * cosW + 2.0f * sqrtA * alpha;
                raw_a1 = 2.0f * ((A - 1.0f) - (A + 1.0f) * cosW);
                raw_a2 = (A + 1.0f) - (A - 1.0f) * cosW - 2.0f * sqrtA * alpha;
                break;
            }
            case FilterType::HighPass: {
                raw_b0 = (1.0f + cosW) * 0.5f;
                raw_b1 = -(1.0f + cosW);
                raw_b2 = (1.0f + cosW) * 0.5f;
                raw_a0 = 1.0f + alpha;
                raw_a1 = -2.0f * cosW;
                raw_a2 = 1.0f - alpha;
                break;
            }
            case FilterType::LowPass: {
                raw_b0 = (1.0f - cosW) * 0.5f;
                raw_b1 = 1.0f - cosW;
                raw_b2 = (1.0f - cosW) * 0.5f;
                raw_a0 = 1.0f + alpha;
                raw_a1 = -2.0f * cosW;
                raw_a2 = 1.0f - alpha;
                break;
            }
            case FilterType::BandPass: {
                raw_b0 = alpha;
                raw_b1 = 0.0f;
                raw_b2 = -alpha;
                raw_a0 = 1.0f + alpha;
                raw_a1 = -2.0f * cosW;
                raw_a2 = 1.0f - alpha;
                break;
            }
            case FilterType::Notch: {
                raw_b0 = 1.0f;
                raw_b1 = -2.0f * cosW;
                raw_b2 = 1.0f;
                raw_a0 = 1.0f + alpha;
                raw_a1 = -2.0f * cosW;
                raw_a2 = 1.0f - alpha;
                break;
            }
        }

        if (std::abs(raw_a0) > 1e-9f) {
            a0_inv = 1.0f / raw_a0;
            target_b0 = raw_b0 * a0_inv;
            target_b1 = raw_b1 * a0_inv;
            target_b2 = raw_b2 * a0_inv;
            target_a1 = raw_a1 * a0_inv;
            target_a2 = raw_a2 * a0_inv;
        }

        // If coefficients were initial, snap immediately
        if (b0 == 1.0f && b1 == 0.0f && b2 == 0.0f && a1 == 0.0f && a2 == 0.0f) {
            snapCoefficients();
        }
    }

    void snapCoefficients() {
        b0 = target_b0;
        b1 = target_b1;
        b2 = target_b2;
        a1 = target_a1;
        a2 = target_a2;
    }

    // Smooth coefficients towards target to avoid zippering
    inline void smoothStep() {
        const float smoothingFactor = 0.005f;
        b0 += (target_b0 - b0) * smoothingFactor;
        b1 += (target_b1 - b1) * smoothingFactor;
        b2 += (target_b2 - b2) * smoothingFactor;
        a1 += (target_a1 - a1) * smoothingFactor;
        a2 += (target_a2 - a2) * smoothingFactor;
    }

    // Transposed Direct Form II processing for stereo sample
    inline void processStereo(float inL, float inR, float& outL, float& outR) {
        // Channel Left
        outL = b0 * inL + s1_L;
        s1_L = b1 * inL - a1 * outL + s2_L;
        s2_L = b2 * inL - a2 * outL;

        // Channel Right
        outR = b0 * inR + s1_R;
        s1_R = b1 * inR - a1 * outR + s2_R;
        s2_R = b2 * inR - a2 * outR;

        // Prevent denormals
        if (std::abs(s1_L) < 1e-18f) s1_L = 0.0f;
        if (std::abs(s2_L) < 1e-18f) s2_L = 0.0f;
        if (std::abs(s1_R) < 1e-18f) s1_R = 0.0f;
        if (std::abs(s2_R) < 1e-18f) s2_R = 0.0f;
    }

private:
    float b0{1.0f}, b1{0.0f}, b2{0.0f};
    float a1{0.0f}, a2{0.0f};
    float target_b0{1.0f}, target_b1{0.0f}, target_b2{0.0f};
    float target_a1{0.0f}, target_a2{0.0f};

    // States for Direct Form II Transposed
    float s1_L{0.0f}, s2_L{0.0f};
    float s1_R{0.0f}, s2_R{0.0f};
};

// 32-band cascaded Parametric Equalizer
class MultiBandEQ {
public:
    static constexpr int NUM_BANDS = 32;

    MultiBandEQ() : sampleRate(48000.0f), matchScale(1.0f) {
        bands.resize(NUM_BANDS);
        baseGains.resize(NUM_BANDS, 0.0f);
        centerFrequencies.resize(NUM_BANDS, 1000.0f);
        qFactors.resize(NUM_BANDS, 1.414f);
        filterTypes.resize(NUM_BANDS, FilterType::Peaking);
        initStandardISO31Bands();
    }

    void setSampleRate(float sr) {
        sampleRate = sr;
        recalculateFilters();
    }

    void initStandardISO31Bands() {
        // Standard ISO 1/3 octave frequencies from 20 Hz to 20,000 Hz + Sub cut
        static const float isoFreqs[NUM_BANDS] = {
            20.0f,   25.0f,   31.5f,   40.0f,   50.0f,   63.0f,   80.0f,   100.0f,
            125.0f,  160.0f,  200.0f,  250.0f,  315.0f,  400.0f,  500.0f,  630.0f,
            800.0f,  1000.0f, 1250.0f, 1600.0f, 2000.0f, 2500.0f, 3150.0f, 4000.0f,
            5000.0f, 6300.0f, 8000.0f, 10000.0f, 12500.0f, 16000.0f, 18500.0f, 20000.0f
        };

        for (int i = 0; i < NUM_BANDS; ++i) {
            centerFrequencies[i] = isoFreqs[i];
            baseGains[i] = 0.0f;
            qFactors[i] = 1.8f; // optimal 1/3 octave Q ~ 4.3 or smooth mastering Q ~ 1.4-2.0
            filterTypes[i] = FilterType::Peaking;
        }
        // Sub low shelf / high shelf edge bands
        filterTypes[0] = FilterType::LowShelf;
        filterTypes[NUM_BANDS - 1] = FilterType::HighShelf;

        recalculateFilters();
    }

    void setBand(int bandIndex, float freqHz, float gainDb, float q, FilterType type) {
        if (bandIndex < 0 || bandIndex >= NUM_BANDS) return;
        centerFrequencies[bandIndex] = freqHz;
        baseGains[bandIndex] = gainDb;
        qFactors[bandIndex] = q;
        filterTypes[bandIndex] = type;
        updateSingleFilter(bandIndex);
    }

    void setMatchAmount(float scale0to1) {
        matchScale = std::clamp(scale0to1, 0.0f, 2.0f);
        recalculateFilters();
    }

    float getMatchAmount() const {
        return matchScale;
    }

    void setDeltaGains(const float* deltaGainsDb, int count) {
        int n = std::min(count, NUM_BANDS);
        for (int i = 0; i < n; ++i) {
            baseGains[i] = deltaGainsDb[i];
        }
        recalculateFilters();
    }

    void recalculateFilters() {
        for (int i = 0; i < NUM_BANDS; ++i) {
            updateSingleFilter(i);
        }
    }

    inline void processStereo(float inL, float inR, float& outL, float& outR) {
        float curL = inL;
        float curR = inR;
        for (int i = 0; i < NUM_BANDS; ++i) {
            bands[i].smoothStep();
            bands[i].processStereo(curL, curR, curL, curR);
        }
        outL = curL;
        outR = curR;
    }

    void reset() {
        for (auto& b : bands) {
            b.reset();
        }
    }

private:
    void updateSingleFilter(int i) {
        float effectiveGain = baseGains[i] * matchScale;
        // Safety clamp on EQ boost/cut to prevent extreme clipping/damage
        effectiveGain = std::clamp(effectiveGain, -24.0f, 18.0f);
        bands[i].configure(filterTypes[i], sampleRate, centerFrequencies[i], effectiveGain, qFactors[i]);
    }

    float sampleRate;
    float matchScale;
    std::vector<BiquadFilter> bands;
    std::vector<float> baseGains;
    std::vector<float> centerFrequencies;
    std::vector<float> qFactors;
    std::vector<FilterType> filterTypes;
};

} // namespace AudioDSP
