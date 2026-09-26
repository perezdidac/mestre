#pragma once

#include <cmath>
#include <vector>
#include <algorithm>
#include <numeric>

namespace AudioDSP {

// ITU-R BS.1770-4 K-weighting loudness analyzer
class LoudnessMeterBS1770 {
public:
    LoudnessMeterBS1770() : sampleRate(48000.0f) {
        reset();
        initCoefficients();
    }

    void setSampleRate(float sr) {
        sampleRate = sr;
        reset();
        initCoefficients();
    }

    void reset() {
        // Filter states
        pre_s1_L = pre_s2_L = 0.0;
        pre_s1_R = pre_s2_R = 0.0;
        rlb_s1_L = rlb_s2_L = 0.0;
        rlb_s1_R = rlb_s2_R = 0.0;

        blockSumL = blockSumR = 0.0;
        sampleCountInBlock = 0;
        shortTermBlocks.clear();
        gatingBlocks.clear();
        peakLevel = 0.0f;
    }

    void processFrame(float inL, float inR) {
        // Track true peak estimation
        peakLevel = std::max(peakLevel, std::max(std::abs(inL), std::abs(inR)));

        // Stage 1: Pre-filter (high shelf)
        double stage1_L = pre_b0 * inL + pre_s1_L;
        pre_s1_L = pre_b1 * inL - pre_a1 * stage1_L + pre_s2_L;
        pre_s2_L = pre_b2 * inL - pre_a2 * stage1_L;

        double stage1_R = pre_b0 * inR + pre_s1_R;
        pre_s1_R = pre_b1 * inR - pre_a1 * stage1_R + pre_s2_R;
        pre_s2_R = pre_b2 * inR - pre_a2 * stage1_R;

        // Stage 2: RLB filter (highpass)
        double weighted_L = rlb_b0 * stage1_L + rlb_s1_L;
        rlb_s1_L = rlb_b1 * stage1_L - rlb_a1 * weighted_L + rlb_s2_L;
        rlb_s2_L = rlb_b2 * stage1_L - rlb_a2 * weighted_L;

        double weighted_R = rlb_b0 * stage1_R + rlb_s1_R;
        rlb_s1_R = rlb_b1 * stage1_R - rlb_a1 * weighted_R + rlb_s2_R;
        rlb_s2_R = rlb_b2 * stage1_R - rlb_a2 * weighted_R;

        // Sum squares for 400ms momentary block
        blockSumL += weighted_L * weighted_L;
        blockSumR += weighted_R * weighted_R;
        sampleCountInBlock++;

        int samplesPer400ms = static_cast<int>(0.400f * sampleRate);
        if (sampleCountInBlock >= samplesPer400ms) {
            double meanSquare = (blockSumL + blockSumR) / (2.0 * samplesPer400ms);
            float blockLoudness = (meanSquare > 1e-12) ? static_cast<float>(-0.691 + 10.0 * std::log10(meanSquare)) : -120.0f;

            // Keep blocks for integrated calculation (75% overlap typically, here simplified per block)
            gatingBlocks.push_back({meanSquare, blockLoudness});

            // Short-term window (3 seconds = 7.5 blocks)
            shortTermBlocks.push_back(meanSquare);
            while (shortTermBlocks.size() > 8) {
                shortTermBlocks.erase(shortTermBlocks.begin());
            }

            blockSumL = 0.0;
            blockSumR = 0.0;
            sampleCountInBlock = 0;
        }
    }

    float getMomentaryLUFS() const {
        if (sampleCountInBlock <= 0) return -120.0f;
        double meanSquare = (blockSumL + blockSumR) / (2.0 * sampleCountInBlock);
        if (meanSquare <= 1e-12) return -120.0f;
        return static_cast<float>(-0.691 + 10.0 * std::log10(meanSquare));
    }

    float getShortTermLUFS() const {
        if (shortTermBlocks.empty()) return -120.0f;
        double sum = 0.0;
        for (double ms : shortTermBlocks) {
            sum += ms;
        }
        double avg = sum / shortTermBlocks.size();
        if (avg <= 1e-12) return -120.0f;
        return static_cast<float>(-0.691 + 10.0 * std::log10(avg));
    }

    float getIntegratedLUFS() const {
        if (gatingBlocks.empty()) return -120.0f;

        // Pass 1: Absolute threshold at -70 LKFS
        double absGatedSum = 0.0;
        int absGatedCount = 0;
        for (const auto& blk : gatingBlocks) {
            if (blk.lufs > -70.0f) {
                absGatedSum += blk.meanSquare;
                absGatedCount++;
            }
        }
        if (absGatedCount == 0) return -120.0f;

        double ungatedLoudness = -0.691 + 10.0 * std::log10(absGatedSum / absGatedCount);

        // Pass 2: Relative threshold at -10 LU below ungated loudness
        double relThreshold = ungatedLoudness - 10.0;
        double relGatedSum = 0.0;
        int relGatedCount = 0;
        for (const auto& blk : gatingBlocks) {
            if (blk.lufs > -70.0f && blk.lufs > relThreshold) {
                relGatedSum += blk.meanSquare;
                relGatedCount++;
            }
        }
        if (relGatedCount == 0) return static_cast<float>(ungatedLoudness);

        return static_cast<float>(-0.691 + 10.0 * std::log10(relGatedSum / relGatedCount));
    }

    float getPeakDb() const {
        return (peakLevel > 1e-6f) ? 20.0f * std::log10(peakLevel) : -120.0f;
    }

private:
    struct LoudnessBlock {
        double meanSquare;
        float lufs;
    };

    void initCoefficients() {
        // Coefficients derived from ITU-R BS.1770-4 for 48kHz (normalized for arbitrary SR via bilinear transform)
        // Pre-filter: high shelf ~1681 Hz, +4.0 dB
        double f0 = 1681.9744509555319;
        double G  = 3.99984385397;
        double Q  = 0.7071752369554193;
        double K  = std::tan(M_PI * f0 / sampleRate);
        double Vh = std::pow(10.0, G / 20.0);
        double Vb = std::pow(Vh, 0.499666774155);

        double a0 = 1.0 + K / Q + K * K;
        pre_b0 = (Vh + Vb * K / Q + K * K) / a0;
        pre_b1 = 2.0 * (K * K - Vh) / a0;
        pre_b2 = (Vh - Vb * K / Q + K * K) / a0;
        pre_a1 = 2.0 * (K * K - 1.0) / a0;
        pre_a2 = (1.0 - K / Q + K * K) / a0;

        // RLB weighting filter: high-pass ~38 Hz
        f0 = 38.13547087613982;
        Q  = 0.5003270373253953;
        K  = std::tan(M_PI * f0 / sampleRate);

        a0 = 1.0 + K / Q + K * K;
        rlb_b0 = 1.0 / a0;
        rlb_b1 = -2.0 / a0;
        rlb_b2 = 1.0 / a0;
        rlb_a1 = 2.0 * (K * K - 1.0) / a0;
        rlb_a2 = (1.0 - K / Q + K * K) / a0;
    }

    float sampleRate;
    double pre_b0{1.0}, pre_b1{0.0}, pre_b2{0.0}, pre_a1{0.0}, pre_a2{0.0};
    double rlb_b0{1.0}, rlb_b1{0.0}, rlb_b2{0.0}, rlb_a1{0.0}, rlb_a2{0.0};

    double pre_s1_L{0.0}, pre_s2_L{0.0};
    double pre_s1_R{0.0}, pre_s2_R{0.0};
    double rlb_s1_L{0.0}, rlb_s2_L{0.0};
    double rlb_s1_R{0.0}, rlb_s2_R{0.0};

    double blockSumL{0.0};
    double blockSumR{0.0};
    int sampleCountInBlock{0};

    std::vector<LoudnessBlock> gatingBlocks;
    std::vector<double> shortTermBlocks;
    float peakLevel{0.0f};
};

} // namespace AudioDSP
