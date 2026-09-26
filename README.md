# AURA Master — Client-Side Audio Mastering & Reference Match DSP Suite

A modern, browser-based audio mastering workstation powered by the **Web Audio API** and **WebAssembly (Wasm)**. Its core feature is a **Reference Match Engine** that ingests an unmastered Target track and a commercial Reference track, computes high-resolution spectral and dynamic profiles, and automatically synthesizes a mastering chain (EQ, compression, lookahead true-peak limiting, and loudness matching) locally in browser memory.

---

## Key Highlights & Architecture

- **100% Client-Side Privacy**: Audio files are read directly into memory (`ArrayBuffer` & `AudioBuffer`). Zero bytes are transmitted to any backend server.
- **WebAssembly Real-Time Audio DSP**: A native-speed DSP engine compiled to WebAssembly running inside an `AudioWorkletNode` on a dedicated audio rendering thread for glitch-free, zero-dropout playback.
- **ITU-R BS.1770-4 Standard Loudness**: Pre-filter (high shelf) and RLB weighting filters computing Momentary (400ms), Short-term (3s), and Integrated LUFS with -70 LKFS absolute and -10 LU relative gating thresholds.
- **32-Band Cascaded Parametric Match EQ**: Transposed Direct Form II biquad filters spanning ISO standard 1/3-octave center frequencies (20 Hz – 20 kHz) with coefficient smoothing to prevent zippering artifacts.
- **Stereo Mastering Compressor**: Decoupled attack and release ballistics, variable soft knee, stereo link, and auto/manual makeup gain.
- **Lookahead True-Peak Brickwall Limiter**: Circular delay buffer (lookahead), exponential release ballistics, and cubic soft-saturation curve for analog warmth near digital ceiling.
- **Instantaneous A/B Monitoring**: Instant crossfade switching between **Mastered**, **Target (Dry)**, and **Reference** benchmarks without losing playback playhead position.
- **High-Speed Offline Renderer**: Multi-core offline audio mastering pipeline with direct WAV file export (16-bit PCM, 24-bit PCM, or 32-bit Float) featuring TPDF dither.

---

## Application Structure

```
master/
├── index.html                   # Studio UI layout & DOM structure
├── vite.config.js               # Dev server & CORS/COOP/COEP header configuration
├── package.json                 # Build scripts & dependencies
├── cpp/                         # Production C++ DSP Audio Engine
│   ├── CMakeLists.txt           # CMake build for native static lib or Wasm
│   ├── Makefile                 # Emscripten compilation Makefile
│   ├── build.sh                 # Unix/macOS build script
│   ├── build.bat                # Windows build script
│   ├── include/
│   │   ├── biquad.hpp           # RBJ Audio EQ Cookbook biquad filters
│   │   ├── compressor.hpp       # Stereo compressor with soft knee
│   │   ├── limiter.hpp          # Lookahead true-peak brickwall limiter
│   │   ├── lufs.hpp             # ITU-R BS.1770-4 loudness analyzer
│   │   ├── fft.hpp              # Radix-2 Cooley-Tukey FFT & Hann window
│   │   └── mastering_engine.hpp # Main mastering DSP processor
│   └── src/
│       ├── mastering_engine.cpp # Engine implementation
│       └── emscripten_bindings.cpp # C ABI & Emscripten exports
├── scripts/
│   └── compile_wasm.js          # Automated Wabt WebAssembly compiler
├── public/
│   ├── dsp_engine.wasm          # Compiled WebAssembly DSP binary
│   └── worklets/
│       └── dsp-worklet-processor.js # AudioWorklet DSP processor thread
└── src/
    ├── main.js                  # Application entry point & orchestration
    ├── styles/
    │   ├── theme.css            # Dark mastering studio design tokens
    │   ├── main.css             # Main layout, deck grid, transport
    │   ├── components.css       # Drop decks, sliders, buttons, modals
    │   └── visualizer.css       # Waveform, spectrum RTA, meter bridge
    ├── audio/
    │   ├── audioManager.js      # AudioContext, transport & A/B routing
    │   ├── audioLoader.js       # ArrayBuffer ingestion & peak extraction
    │   └── wavExporter.js       # 16/24/32-bit RIFF/WAVE encoder with dither
    ├── dsp/
    │   ├── analyzer.js          # LTAS spectral FFT, 1/3-octave band mapper
    │   ├── lufsMeter.js         # ITU-R BS.1770-4 loudness & dynamics meter
    │   ├── matchEngine.js       # Difference curve & biquad coefficient math
    │   ├── wasmBridge.js        # AudioWorklet <-> Wasm parameter bridge
    │   └── offlineRenderer.js   # Fast offline mastering engine
    └── ui/
        ├── waveformView.js      # Canvas waveform & scrub visualizer
        ├── spectrumView.js      # Dual FFT RTA & match curve visualizer
        ├── eqPlotView.js        # Interactive 32-band filter node editor
        ├── metersView.js        # Precision LUFS, Peak, DR, & GR meters
        └── transportControls.js # Transport, A/B selector, sliders & dialogs
```

---

## Four-Phase Implementation Details

### Phase 1: UI & Audio Ingestion
- **Dual Drop Zones**: Drag and drop or file browser picker for both Target Track and Reference Track.
- **Format Compatibility**: Reads WAV, MP3, FLAC, AIFF, OGG, and M4A.
- **Local Memory Guarantees**: Audio buffers are read via `FileReader` and decoded via `AudioContext.decodeAudioData` purely in client-side RAM.
- **Dual Interactive Waveforms**: High-DPI canvas rendering showing min/max peak spikes and RMS density cores, interactive scrub cursor, and loop regions.

### Phase 2: Frequency & Dynamics Analysis
- **Long-Term Average Spectrum (LTAS)**: Overlapping Hann-windowed Radix-2 FFT passes over the entire duration of both tracks.
- **ISO Standard 32 Bands**: Accumulates spectral energy into standard 1/3-octave frequency bands from 20 Hz to 20,000 Hz.
- **ITU-R BS.1770-4 Loudness & Dynamics**:
  - Stage 1: Pre-filter high-shelf ($f_0 \approx 1681\text{ Hz}$, $+4\text{ dB}$).
  - Stage 2: RLB weighting filter high-pass ($f_0 \approx 38\text{ Hz}$).
  - Absolute threshold at $-70\text{ LKFS}$, relative threshold at $-10\text{ LU}$.
  - Dynamic Range (Crest Factor) calculation: Peak dBFS minus RMS dBFS.
- **EQ Difference Curve Calculation**: Subtracts Target band energy from Reference band energy after normalizing tonal baseline across the mid-band range. Applies Gaussian curve smoothing to preserve musicality.

### Phase 3: WebAssembly DSP Engine
- **C++ Audio DSP Codebase**: Complete, modular, production C++ codebase under `cpp/`.
- **Wasm Binary Compilation**: Integrated Wabt compilation pipeline in `scripts/compile_wasm.js` producing `public/dsp_engine.wasm`.
- **Parametric Cascaded EQ**: 32 biquad filters utilizing Transposed Direct Form II for minimum floating-point noise and parameter smoothing.
- **Stereo Dynamics Processor**: Feedforward RMS/Peak compressor with soft knee, logarithmic envelope detection, and make-up gain.
- **Lookahead Limiter**: Delay buffer catches transient inter-sample peaks before clipping, with cubic Hermite soft-saturation curve.
- **AudioWorklet Threading**: Runs `dsp-mastering-processor` in an isolated Web Audio worklet thread, synchronizing audio blocks and posting telemetry.

### Phase 4: Parameter Mapping & Export
- **One-Click "MATCH REFERENCE"**: Snaps EQ filters, match amount, input drive, compressor threshold/ratio, and limiter ceiling to target values.
- **Interactive Controls**:
  - Match Amount (0% to 150%)
  - Curve Smoothing (0% to 100%)
  - Input Drive / Trim (-12 dB to +12 dB)
  - Compressor Threshold & Ratio
  - Limiter Ceiling (-2.0 dB to 0.0 dB)
- **Target Mastering Presets**:
  - *Streaming*: -14 LUFS standard, transparent matching.
  - *Club / EDM*: -9 LUFS, aggressive low-end punch & limiting.
  - *Audiophile*: -16 LUFS, gentle dynamic retention.
- **Offline High-Speed Master Render**: Processes the entire audio buffer through the Wasm chain at 50x–100x real-time speed.
- **WAV Exporter**: Produces 16-bit PCM, 24-bit PCM, or 32-bit Float WAV with TPDF dither and triggers browser download.

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Toggle Play / Pause |
| `L` | Toggle Loop region |
| `B` | Toggle Bypass mastering chain |
| `1` | Monitor **Mastered** Target Track |
| `2` | Monitor **Target (Dry)** Unmastered Track |
| `3` | Monitor **Reference** Commercial Benchmark |
| `Esc` | Close Export dialog |

---

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Compile WebAssembly binary**:
   ```bash
   npm run build:wasm
   ```

3. **Start local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in any modern browser (Chrome, Edge, Firefox, Safari).

4. **Production Build**:
   ```bash
   npm run build
   ```
   Output bundle is generated in `dist/`.

---

## License

MIT License. Designed and built with Google Antigravity.
