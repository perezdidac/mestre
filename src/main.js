/**
 * Main Application Orchestration & Event Wiring
 * Integrates Web Audio API, WebAssembly DSP Worklet, Audio Loaders,
 * Frequency & Dynamics Analyzers, Match Engine, Visualizers, and Export pipeline.
 */

import { AudioManager } from './audio/audioManager.js';
import { AudioLoader } from './audio/audioLoader.js';
import { AudioTrackAnalyzer } from './dsp/analyzer.js';
import { MatchEngine } from './dsp/matchEngine.js';
import { OfflineMasteringRenderer } from './dsp/offlineRenderer.js';
import { WavExporter } from './audio/wavExporter.js';

import { WaveformView } from './ui/waveformView.js';
import { SpectrumView } from './ui/spectrumView.js';
import { EqPlotView } from './ui/eqPlotView.js';
import { MetersView } from './ui/metersView.js';
import { TransportControls } from './ui/transportControls.js';

class MasteringApp {
    constructor() {
        this.audioMgr = new AudioManager();
        this.loader = null; // initialized after context
        this.analyzer = new AudioTrackAnalyzer();
        this.matchEngine = new MatchEngine();

        this.targetTrack = null;
        this.referenceTrack = null;
        this.targetAnalysis = null;
        this.referenceAnalysis = null;
        this.differenceData = null;

        this.initUi();
        this.initDropZones();
        this.setupAnimationLoop();
    }

    initUi() {
        // Waveform views
        const canvasTarget = document.getElementById('canvas-target-waveform');
        const canvasRef = document.getElementById('canvas-ref-waveform');

        this.targetWaveform = new WaveformView(canvasTarget, {
            waveColor: '#00f0ff',
            rmsColor: 'rgba(0, 240, 255, 0.45)',
            progressColor: 'rgba(0, 240, 255, 0.2)'
        });

        this.refWaveform = new WaveformView(canvasRef, {
            waveColor: '#f59e0b',
            rmsColor: 'rgba(245, 158, 11, 0.45)',
            progressColor: 'rgba(245, 158, 11, 0.2)'
        });

        // Seek callbacks
        this.targetWaveform.onSeek((time) => this.audioMgr.seek(time));
        this.refWaveform.onSeek((time) => this.audioMgr.seek(time));

        // Spectrum visualizer
        const canvasSpectrum = document.getElementById('canvas-spectrum');
        this.spectrumView = new SpectrumView(canvasSpectrum);

        // Interactive EQ Plot
        const canvasEq = document.getElementById('canvas-eq-plot');
        this.eqPlotView = new EqPlotView(canvasEq, (bandIndex, bandData) => {
            this.handleManualBandEdit(bandIndex, bandData);
        });

        // Meter bridge
        const metersContainer = document.getElementById('meters-section-container');
        this.metersView = new MetersView(metersContainer);

        // Transport controls
        this.transport = new TransportControls({
            onPlay: () => this.audioMgr.play(),
            onPause: () => this.audioMgr.pause(),
            onStop: () => this.audioMgr.stop(),
            onLoopToggle: (loop) => this.audioMgr.setLoop(loop),
            onBypassToggle: (bypass) => this.audioMgr.setBypass(bypass),
            onMonitorChange: (mode) => this.audioMgr.setMonitorSource(mode),
            onMatchReference: () => this.performReferenceMatch(),
            onLoadDemo: () => this.loadSyntheticDemoTracks(),
            onMatchAmountChange: (amount) => this.handleMatchAmountChange(amount),
            onSmoothingChange: (smooth) => this.handleSmoothingChange(smooth),
            onInputGainChange: (gain) => this.handleInputGainChange(gain),
            onCompressorChange: (thresh, ratio) => this.handleCompressorChange(thresh, ratio),
            onLimiterChange: (ceil) => this.handleLimiterChange(ceil),
            onExportMaster: (bitDepth, dither) => this.handleExportMaster(bitDepth, dither)
        });

        // Sync Audio Manager playback updates
        this.audioMgr.onTimeUpdate((time) => {
            this.targetWaveform.setTime(time);
            this.refWaveform.setTime(time);
            this.transport.updateTimecode(time, this.audioMgr.getActiveDuration());
        });

        this.audioMgr.onStateChange((state) => {
            this.transport.updatePlaybackState(state);
        });

        // Target Preset buttons
        const presetStreaming = document.getElementById('btn-preset-streaming');
        const presetClub = document.getElementById('btn-preset-club');
        const presetAudiophile = document.getElementById('btn-preset-audiophile');

        const setActivePresetBtn = (btn) => {
            [presetStreaming, presetClub, presetAudiophile].forEach(b => {
                if (b) b.classList.remove('active');
            });
            if (btn) btn.classList.add('active');
        };

        if (presetStreaming) {
            presetStreaming.addEventListener('click', () => {
                setActivePresetBtn(presetStreaming);
                this.applyMasteringPreset('streaming');
            });
        }
        if (presetClub) {
            presetClub.addEventListener('click', () => {
                setActivePresetBtn(presetClub);
                this.applyMasteringPreset('club');
            });
        }
        if (presetAudiophile) {
            presetAudiophile.addEventListener('click', () => {
                setActivePresetBtn(presetAudiophile);
                this.applyMasteringPreset('audiophile');
            });
        }
    }

    applyMasteringPreset(presetName) {
        let params = {
            matchAmount: 1.0,
            inputGainDb: 0.0,
            compThresholdDb: -16.0,
            compRatio: 2.5,
            limiterCeilingDb: -0.2
        };

        if (presetName === 'club') {
            params = {
                matchAmount: 1.25,
                inputGainDb: 3.0,
                compThresholdDb: -20.0,
                compRatio: 3.5,
                limiterCeilingDb: -0.1
            };
        } else if (presetName === 'audiophile') {
            params = {
                matchAmount: 0.70,
                inputGainDb: -1.0,
                compThresholdDb: -12.0,
                compRatio: 1.8,
                limiterCeilingDb: -0.5
            };
        }

        this.matchEngine.setMatchAmount(params.matchAmount);
        this.transport.snapSlidersToMatchedValues(params);

        if (this.audioMgr.wasmBridge) {
            this.audioMgr.wasmBridge.setInputGain(params.inputGainDb);
            this.audioMgr.wasmBridge.setCompressor(params.compThresholdDb, params.compRatio, 25.0, 150.0, 6.0, 0.0);
            this.audioMgr.wasmBridge.setLimiter(params.limiterCeilingDb, 80.0, 4.0, true);
        }

        this.recomputeAndPushFilters();
    }

    initDropZones() {
        const setupDeck = (deckId, dropId, inputId, onFileLoaded) => {
            const dropZone = document.getElementById(dropId);
            const fileInput = document.getElementById(inputId);
            const deckCard = document.getElementById(deckId);

            dropZone.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    await onFileLoaded(e.target.files[0]);
                }
            });

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    await onFileLoaded(e.dataTransfer.files[0]);
                }
            });
        };

        // Target Track Drop Zone
        setupDeck('card-target-deck', 'drop-zone-target', 'input-file-target', async (file) => {
            await this.audioMgr.ensureContext();
            if (!this.loader) this.loader = new AudioLoader(this.audioMgr.ctx);

            const track = await this.loader.loadFile(file);
            this.setTargetTrack(track);
        });

        // Reference Track Drop Zone
        setupDeck('card-ref-deck', 'drop-zone-ref', 'input-file-ref', async (file) => {
            await this.audioMgr.ensureContext();
            if (!this.loader) this.loader = new AudioLoader(this.audioMgr.ctx);

            const track = await this.loader.loadFile(file);
            this.setReferenceTrack(track);
        });
    }

    setTargetTrack(track) {
        this.targetTrack = track;
        this.audioMgr.setTargetTrack(track);
        this.targetWaveform.setTrackData(track);

        // Update Deck Card UI
        const card = document.getElementById('card-target-deck');
        card.classList.add('has-file');
        document.getElementById('name-target-track').textContent = track.name;
        document.getElementById('spec-target-duration').textContent = track.durationFormatted;
        document.getElementById('spec-target-sr').textContent = `${(track.sampleRate / 1000).toFixed(1)} kHz`;
        document.getElementById('spec-target-format').textContent = track.format;
        document.getElementById('spec-target-size').textContent = track.sizeFormatted;
        document.getElementById('target-deck-meta').textContent = `${track.numberOfChannels === 2 ? 'Stereo' : 'Mono'} • Ready`;

        this.targetAnalysis = null;
        this.checkReadyToMatch();
    }

    setReferenceTrack(track) {
        this.referenceTrack = track;
        this.audioMgr.setReferenceTrack(track);
        this.refWaveform.setTrackData(track);

        // Update Deck Card UI
        const card = document.getElementById('card-ref-deck');
        card.classList.add('has-file');
        document.getElementById('name-ref-track').textContent = track.name;
        document.getElementById('spec-ref-duration').textContent = track.durationFormatted;
        document.getElementById('spec-ref-sr').textContent = `${(track.sampleRate / 1000).toFixed(1)} kHz`;
        document.getElementById('spec-ref-format').textContent = track.format;
        document.getElementById('spec-ref-size').textContent = track.sizeFormatted;
        document.getElementById('ref-deck-meta').textContent = `${track.numberOfChannels === 2 ? 'Stereo' : 'Mono'} • Benchmark`;

        this.referenceAnalysis = null;
        this.checkReadyToMatch();
    }

    checkReadyToMatch() {
        const desc = document.getElementById('match-status-desc');
        if (this.targetTrack && this.referenceTrack) {
            desc.textContent = `Ready! Click "MATCH REFERENCE" to match ${this.targetTrack.name} to the tonal and dynamic profile of ${this.referenceTrack.name}.`;
        } else if (this.targetTrack) {
            desc.textContent = `Target track loaded. Now upload or load a reference track to match against.`;
        }
    }

    /**
     * Synthetically load rich demo tracks for instantaneous testing
     */
    async loadSyntheticDemoTracks() {
        await this.audioMgr.ensureContext();
        if (!this.loader) this.loader = new AudioLoader(this.audioMgr.ctx);

        const targetDemo = this.loader.generateDemoTrack('target');
        const refDemo = this.loader.generateDemoTrack('reference');

        this.setTargetTrack(targetDemo);
        this.setReferenceTrack(refDemo);

        // Automatically trigger matching
        setTimeout(() => {
            this.performReferenceMatch();
        }, 300);
    }

    /**
     * Phase 2 & 4: Execute Full Reference Match Analysis & DSP Parameter Mapping
     */
    async performReferenceMatch() {
        if (!this.targetTrack || !this.referenceTrack) {
            alert('Please load both a Target Track and a Reference Track before matching.');
            return;
        }

        await this.audioMgr.ensureContext();

        const btnMatch = document.getElementById('btn-match-action');
        const btnLabel = document.getElementById('btn-match-label');
        btnMatch.classList.add('processing');
        btnLabel.textContent = 'ANALYZING & MATCHING...';

        try {
            // 1. Analyze Target Track if needed
            if (!this.targetAnalysis) {
                console.log('[MatchEngine] Analyzing Target Track frequency and dynamics...');
                this.targetAnalysis = await this.analyzer.analyze(this.targetTrack.audioBuffer);
                this.metersView.setTargetMetrics(this.targetAnalysis.dynamics);
                this.spectrumView.setTargetAnalysis(this.targetAnalysis);
            }

            // 2. Analyze Reference Track if needed
            if (!this.referenceAnalysis) {
                console.log('[MatchEngine] Analyzing Reference Track frequency and dynamics...');
                this.referenceAnalysis = await this.analyzer.analyze(this.referenceTrack.audioBuffer);
                this.metersView.setReferenceMetrics(this.referenceAnalysis.dynamics);
                this.spectrumView.setReferenceAnalysis(this.referenceAnalysis);
            }

            // 3. Generate EQ Difference Curve & Loudness/Dynamics target
            console.log('[MatchEngine] Calculating EQ Difference Curve and dynamics offsets...');
            this.differenceData = this.analyzer.computeDifferenceCurve(
                this.targetAnalysis,
                this.referenceAnalysis,
                this.matchEngine.smoothing
            );

            this.matchEngine.setDifferenceData(this.differenceData);

            // 4. Calculate biquad filter coefficients and map to DSP module
            const filters = this.matchEngine.computeBiquadCoefficients(this.audioMgr.ctx.sampleRate);
            this.audioMgr.wasmBridge.setAllEqBands(filters);

            // 5. Update interactive visualizers
            const evalPoints = this.matchEngine.evaluateMagnitudeResponse(filters, 256, this.audioMgr.ctx.sampleRate);
            this.spectrumView.setDifferenceData(this.differenceData, this.matchEngine.matchAmount);
            this.spectrumView.setEqResponsePoints(evalPoints);
            this.eqPlotView.setBands(filters);

            // 6. Snap UI parameter sliders to matched values
            const suggestedInputDrive = Math.max(-6, Math.min(8, this.differenceData.deltaLoudnessDb));
            const matchedParams = {
                matchAmount: this.matchEngine.matchAmount,
                inputGainDb: suggestedInputDrive,
                compThresholdDb: this.differenceData.suggestedCompThreshold,
                compRatio: this.differenceData.suggestedCompRatio,
                limiterCeilingDb: -0.2
            };

            this.transport.snapSlidersToMatchedValues(matchedParams);

            // Dispatch to Wasm DSP Engine
            this.audioMgr.wasmBridge.setInputGain(suggestedInputDrive);
            this.audioMgr.wasmBridge.setCompressor(
                matchedParams.compThresholdDb,
                matchedParams.compRatio,
                25.0,
                150.0,
                6.0,
                0.0
            );
            this.audioMgr.wasmBridge.setLimiter(-0.2, 80.0, 4.0, true);

            // Update status text
            document.getElementById('match-status-desc').textContent = 
                `Reference Match complete! Target EQ shaped (+${this.differenceData.deltaLoudnessDb.toFixed(1)} dB loudness delta applied). Use A/B switcher to compare!`;

            btnLabel.textContent = 'MATCH APPLIED ✓';
            setTimeout(() => {
                btnMatch.classList.remove('processing');
                btnLabel.textContent = 'RE-MATCH REFERENCE';
            }, 1000);

        } catch (err) {
            console.error('[MatchEngine] Error during reference match:', err);
            btnMatch.classList.remove('processing');
            btnLabel.textContent = 'MATCH REFERENCE';
            alert('Matching failed: ' + err.message);
        }
    }

    handleMatchAmountChange(amount) {
        this.matchEngine.setMatchAmount(amount);
        this.recomputeAndPushFilters();
    }

    handleSmoothingChange(smoothing) {
        this.matchEngine.setSmoothing(smoothing);
        if (this.targetAnalysis && this.referenceAnalysis) {
            this.differenceData = this.analyzer.computeDifferenceCurve(
                this.targetAnalysis,
                this.referenceAnalysis,
                smoothing
            );
            this.matchEngine.setDifferenceData(this.differenceData);
            this.recomputeAndPushFilters();
        }
    }

    handleManualBandEdit(bandIndex, bandData) {
        const sr = this.audioMgr.ctx ? this.audioMgr.ctx.sampleRate : 48000;
        const biquad = this.matchEngine.calcRbjBiquad('peaking', sr, bandData.freq, bandData.gainDb, bandData.q);
        if (this.audioMgr.wasmBridge) {
            const filters = this.matchEngine.computeBiquadCoefficients(sr);
            filters[bandIndex] = {
                ...biquad,
                freq: bandData.freq,
                gainDb: bandData.gainDb,
                q: bandData.q,
                enabled: Math.abs(bandData.gainDb) > 0.1
            };
            this.audioMgr.wasmBridge.setAllEqBands(filters);
            const evalPoints = this.matchEngine.evaluateMagnitudeResponse(filters, 256, sr);
            this.spectrumView.setEqResponsePoints(evalPoints);
        }
    }

    recomputeAndPushFilters() {
        const sr = this.audioMgr.ctx ? this.audioMgr.ctx.sampleRate : 48000;
        const filters = this.matchEngine.computeBiquadCoefficients(sr);
        if (this.audioMgr.wasmBridge) {
            this.audioMgr.wasmBridge.setAllEqBands(filters);
        }

        const evalPoints = this.matchEngine.evaluateMagnitudeResponse(filters, 256, sr);
        this.spectrumView.setDifferenceData(this.differenceData, this.matchEngine.matchAmount);
        this.spectrumView.setEqResponsePoints(evalPoints);
        this.eqPlotView.setBands(filters);
    }

    handleInputGainChange(gainDb) {
        if (this.audioMgr.wasmBridge) {
            this.audioMgr.wasmBridge.setInputGain(gainDb);
        }
    }

    handleCompressorChange(threshDb, ratio) {
        if (this.audioMgr.wasmBridge) {
            this.audioMgr.wasmBridge.setCompressor(threshDb, ratio, 25.0, 150.0, 6.0, 0.0);
        }
    }

    handleLimiterChange(ceilingDb) {
        if (this.audioMgr.wasmBridge) {
            this.audioMgr.wasmBridge.setLimiter(ceilingDb, 80.0, 4.0, true);
        }
    }

    /**
     * Phase 4: Offline High-Speed Master Render & Browser Download
     */
    async handleExportMaster(bitDepth = 24, enableDither = true) {
        if (!this.targetTrack) {
            alert('No target track loaded to export.');
            return;
        }

        const progressContainer = document.getElementById('export-progress-container');
        const progressBar = document.getElementById('export-progress-bar');
        const progressText = document.getElementById('export-progress-text');
        const modal = document.getElementById('export-modal');

        progressContainer.style.display = 'flex';
        modal.classList.add('visible');

        try {
            const sr = this.targetTrack.audioBuffer.sampleRate;
            const filters = this.matchEngine.computeBiquadCoefficients(sr);

            const masterParams = {
                inputGainDb: parseFloat(document.getElementById('slider-input-gain').value) || 0,
                matchAmount: this.matchEngine.matchAmount,
                compThresholdDb: parseFloat(document.getElementById('slider-comp-thresh').value) || -16,
                compRatio: parseFloat(document.getElementById('slider-comp-ratio').value) || 2.5,
                compAttackMs: 25.0,
                compReleaseMs: 150.0,
                limiterCeilingDb: parseFloat(document.getElementById('slider-limiter-ceil').value) || -0.2,
                limiterReleaseMs: 80.0,
                limiterLookaheadMs: 4.0,
                limiterSoftClip: true
            };

            const wasmModule = this.audioMgr.wasmBridge ? this.audioMgr.wasmBridge.wasmModule : null;

            const { masteredBuffer, stats } = await OfflineMasteringRenderer.render(
                this.targetTrack.audioBuffer,
                filters,
                masterParams,
                wasmModule,
                (progress, text) => {
                    progressBar.style.width = `${Math.round(progress * 100)}%`;
                    progressText.textContent = text;
                }
            );

            this.audioMgr.setMasteredBuffer(masteredBuffer);
            this.metersView.setMasteredMetrics(stats);

            // Generate filename based on target track name
            const baseName = this.targetTrack.name.replace(/\.[^/.]+$/, '');
            const filename = `${baseName}_Mastered_Match_${bitDepth}bit.wav`;

            progressText.textContent = 'Encoding WAV and saving to browser downloads...';
            WavExporter.downloadWav(masteredBuffer, filename, bitDepth, enableDither);

            setTimeout(() => {
                modal.classList.remove('visible');
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
            }, 1000);

        } catch (err) {
            console.error('[ExportMaster] Offline render failed:', err);
            progressText.textContent = 'Export error: ' + err.message;
            alert('Export failed: ' + err.message);
        }
    }

    setupAnimationLoop() {
        const loop = () => {
            if (this.audioMgr.isPlaying && this.audioMgr.ctx) {
                // Update real-time RTA spectrum
                const dataMastered = this.audioMgr.getFrequencyData(this.audioMgr.analyserMastered);
                const dataTarget = this.audioMgr.getFrequencyData(this.audioMgr.analyserTarget);
                this.spectrumView.setRealtimeData(dataTarget, dataMastered);

                // Update Wasm GR telemetry into meter bridge
                if (this.audioMgr.wasmBridge) {
                    this.audioMgr.wasmBridge.setMeteringCallback((m) => {
                        this.metersView.updateRealtimeMasterTelemetry(m.compGR, m.limGR);
                    });
                }
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

// Instantiate application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.__app = new MasteringApp();
    console.log('[AURA MASTER] Application initialized and ready.');
});
