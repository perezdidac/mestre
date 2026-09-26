#pragma once

#include <vector>
#include <complex>
#include <cmath>
#include <algorithm>

namespace AudioDSP {

class SimpleFFT {
public:
    using Complex = std::complex<float>;

    static void bitReverse(std::vector<Complex>& a) {
        int n = static_cast<int>(a.size());
        for (int i = 1, j = 0; i < n; ++i) {
            int bit = n >> 1;
            for (; j & bit; bit >>= 1) {
                j ^= bit;
            }
            j ^= bit;
            if (i < j) {
                std::swap(a[i], a[j]);
            }
        }
    }

    static void fft(std::vector<Complex>& a, bool invert = false) {
        int n = static_cast<int>(a.size());
        bitReverse(a);

        for (int len = 2; len <= n; len <<= 1) {
            float ang = 2.0f * static_cast<float>(M_PI) / len * (invert ? -1.0f : 1.0f);
            Complex wlen(std::cos(ang), std::sin(ang));
            for (int i = 0; i < n; i += len) {
                Complex w(1.0f, 0.0f);
                for (int j = 0; j < len / 2; ++j) {
                    Complex u = a[i + j];
                    Complex v = a[i + j + len / 2] * w;
                    a[i + j] = u + v;
                    a[i + j + len / 2] = u - v;
                    w *= wlen;
                }
            }
        }

        if (invert) {
            for (auto& x : a) {
                x /= static_cast<float>(n);
            }
        }
    }

    // Apply Hann window to input samples
    static void applyHannWindow(const float* input, std::vector<Complex>& output, int n) {
        output.resize(n);
        for (int i = 0; i < n; ++i) {
            float multiplier = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * i / (n - 1)));
            output[i] = Complex(input[i] * multiplier, 0.0f);
        }
    }

    // Compute magnitude spectrum in dBFS
    static void computeMagnitudeDb(const std::vector<Complex>& fftData, std::vector<float>& magDb) {
        int halfN = static_cast<int>(fftData.size() / 2);
        magDb.resize(halfN);
        float norm = 2.0f / static_cast<float>(fftData.size());

        for (int i = 0; i < halfN; ++i) {
            float mag = std::abs(fftData[i]) * norm;
            magDb[i] = (mag > 1e-6f) ? 20.0f * std::log10(mag) : -120.0f;
        }
    }
};

} // namespace AudioDSP
