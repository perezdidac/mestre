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
import { PresetManager, MASTERING_PRESETS } from './dsp/masteringPresets.js';

import { WaveformView } from './ui/waveformView.js';
import { SpectrumView } from './ui/spectrumView.js';
import { EqPlotView } from './ui/eqPlotView.js';
import { MetersView } from './ui/metersView.js';
import { TransportControls } from './ui/transportControls.js';
import { ModularRackView } from './ui/modularRackView.js';
import { VectorscopeView } from './ui/vectorscopeView.js';
import { LoudnessRadarView } from './ui/loudnessRadarView.js';
import { QualityInspectorView } from './ui/qualityInspector.js';

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
        this.modularRackView = null;
        this.vectorscopeView = null;
        this.loudnessRadarView = null;
        this.qualityInspector = null;

        this.initUi();
        this.initDropZones();
        this.setupAnimationLoop();
    }

    initUi() {
        // Theme Switcher (Bright Studio vs Dark Console)
        const btnThemeToggle = document.getElementById('btn-theme-toggle');
        const iconTheme = document.getElementById('theme-toggle-icon');
        const labelTheme = document.getElementById('theme-toggle-label');
        let isDark = true;
        if (btnThemeToggle) {
            btnThemeToggle.addEventListener('click', () => {
                isDark = !isDark;
                if (isDark) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    if (iconTheme) iconTheme.textContent = '🌙';
                    if (labelTheme) labelTheme.textContent = 'Dark Console';
                } else {
                    document.documentElement.removeAttribute('data-theme');
                    if (iconTheme) iconTheme.textContent = '☀️';
                    if (labelTheme) labelTheme.textContent = 'Studio Bright';
                }
            });
        }

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

        // Independent Decoupled Seek Callbacks
        this.targetWaveform.onSeek((time) => this.audioMgr.seekTarget(time));
        this.refWaveform.onSeek((time) => this.audioMgr.seekReference(time));

        // Spectrum visualizer
        const canvasSpectrum = document.getElementById('canvas-spectrum');
        this.spectrumView = new SpectrumView(canvasSpectrum);

        // Real-Time Stereo Goniometer & Lissajous Phase Scope
        const canvasVectorscope = document.getElementById('canvas-vectorscope');
        const vectorscopeTelemetry = document.getElementById('vectorscope-telemetry-container');
        if (canvasVectorscope) {
            this.vectorscopeView = new VectorscopeView(canvasVectorscope, vectorscopeTelemetry);
        }

        // Rolling Loudness History Radar
        const canvasLoudness = document.getElementById('canvas-loudness-radar');
        if (canvasLoudness) {
            this.loudnessRadarView = new LoudnessRadarView(canvasLoudness);
        }

        // Scope Hub Navigation (Tabs & Dual Mode)
        const tabSpectrum = document.getElementById('tab-scope-spectrum');
        const tabVectorscope = document.getElementById('tab-scope-vectorscope');
        const tabLoudness = document.getElementById('tab-scope-loudness');
        const btnScopeSplit = document.getElementById('btn-scope-split');

        const scopeViewSpectrum = document.getElementById('scope-view-spectrum');
        const scopeViewVectorscope = document.getElementById('scope-view-vectorscope');
        const scopeViewLoudness = document.getElementById('scope-view-loudness');
        const scopeContainer = document.getElementById('scope-displays-container');

        this.currentScopeMode = 'spectrum';
        this.isDualScope = false;

        const updateScopeDisplay = () => {
            if (this.isDualScope) {
                if (scopeContainer) scopeContainer.classList.add('scope-dual-grid');
                if (scopeViewSpectrum) scopeViewSpectrum.style.display = 'block';
                if (scopeViewVectorscope) scopeViewVectorscope.style.display = 'block';
                if (scopeViewLoudness) scopeViewLoudness.style.display = 'none';
                if (this.spectrumView) this.spectrumView.resize();
                if (this.vectorscopeView) this.vectorscopeView.resize();
                return;
            }

            if (scopeContainer) scopeContainer.classList.remove('scope-dual-grid');
            [scopeViewSpectrum, scopeViewVectorscope, scopeViewLoudness].forEach(el => {
                if (el) el.style.display = 'none';
            });

            [tabSpectrum, tabVectorscope, tabLoudness].forEach(b => {
                if (b) b.classList.remove('active');
            });

            if (this.currentScopeMode === 'spectrum') {
                if (scopeViewSpectrum) scopeViewSpectrum.style.display = 'block';
                if (tabSpectrum) tabSpectrum.classList.add('active');
                if (this.spectrumView) this.spectrumView.resize();
            } else if (this.currentScopeMode === 'vectorscope') {
                if (scopeViewVectorscope) scopeViewVectorscope.style.display = 'block';
                if (tabVectorscope) tabVectorscope.classList.add('active');
                if (this.vectorscopeView) this.vectorscopeView.resize();
            } else if (this.currentScopeMode === 'loudness') {
                if (scopeViewLoudness) scopeViewLoudness.style.display = 'block';
                if (tabLoudness) tabLoudness.classList.add('active');
                if (this.loudnessRadarView) this.loudnessRadarView.resize();
            }
        };

        if (tabSpectrum) {
            tabSpectrum.addEventListener('click', () => {
                this.isDualScope = false;
                if (btnScopeSplit) btnScopeSplit.classList.remove('active');
                this.currentScopeMode = 'spectrum';
                updateScopeDisplay();
            });
        }
        if (tabVectorscope) {
            tabVectorscope.addEventListener('click', () => {
                this.isDualScope = false;
                if (btnScopeSplit) btnScopeSplit.classList.remove('active');
                this.currentScopeMode = 'vectorscope';
                updateScopeDisplay();
            });
        }
        if (tabLoudness) {
            tabLoudness.addEventListener('click', () => {
                this.isDualScope = false;
                if (btnScopeSplit) btnScopeSplit.classList.remove('active');
                this.currentScopeMode = 'loudness';
                updateScopeDisplay();
            });
        }
        if (btnScopeSplit) {
            btnScopeSplit.addEventListener('click', () => {
                this.isDualScope = !this.isDualScope;
                btnScopeSplit.classList.toggle('active', this.isDualScope);
                updateScopeDisplay();
            });
        }

        window.addEventListener('resize', () => {
            if (this.spectrumView) this.spectrumView.resize();
            if (this.eqPlotView) this.eqPlotView.resize();
            if (this.vectorscopeView) this.vectorscopeView.resize();
            if (this.loudnessRadarView) this.loudnessRadarView.resize();
        });

        // Interactive EQ Plot
        const canvasEq = document.getElementById('canvas-eq-plot');
        this.eqPlotView = new EqPlotView(canvasEq, (bandIndex, bandData) => {
            this.handleManualBandEdit(bandIndex, bandData);
        });

        // Meter bridge
        const metersContainer = document.getElementById('meters-section-container');
        this.metersView = new MetersView(metersContainer);

        // Modular Mastering Rack View
        const rackContainer = document.getElementById('modular-rack-container');
        if (rackContainer) {
            this.modularRackView = new ModularRackView(rackContainer, this.audioMgr.rack, {
                onChainModified: () => {
                    this.updateVisualizersFromRack();
                },
                onParamChanged: (modId, param, val) => {
                    this.updateVisualizersFromRack();
                }
            });
        }

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

        // Sync Audio Manager playback updates (decoupled Target vs Reference waveforms)
        this.audioMgr.onTimeUpdate((info) => {
            if (info && typeof info === 'object') {
                this.targetWaveform.setTime(info.targetTime);
                this.refWaveform.setTime(info.refTime);
                this.transport.updateTimecode(info.time, this.audioMgr.getActiveDuration());
            } else {
                this.targetWaveform.setTime(info);
                this.transport.updateTimecode(info, this.audioMgr.getActiveDuration());
            }
        });

        this.audioMgr.onStateChange((state) => {
            this.transport.updatePlaybackState(state);

            // Update Matrix Pills active state
            const matrixPills = document.querySelectorAll('.matrix-pill');
            matrixPills.forEach(pill => {
                pill.classList.toggle('active', pill.dataset.matrix === state.monitorMatrix);
            });

            // Update Auto-Gain Match Button and Offset Badge
            const btnAutoGain = document.getElementById('btn-autogain-match');
            const badgeOffset = document.getElementById('badge-autogain-offset');
            if (btnAutoGain) {
                btnAutoGain.classList.toggle('active', !!state.isAutoGainMatch);
            }
            if (badgeOffset) {
                if (state.isAutoGainMatch && Math.abs(state.autoGainOffsetDb) > 0.05) {
                    badgeOffset.style.display = 'inline-block';
                    badgeOffset.textContent = `${state.autoGainOffsetDb >= 0 ? '+' : ''}${state.autoGainOffsetDb.toFixed(1)} dB`;
                } else {
                    badgeOffset.style.display = 'none';
                }
            }

            // In Delta Listen mode, highlight vectorscope in amber phosphor
            if (this.vectorscopeView) {
                if (state.monitorMatrix === 'delta') {
                    this.vectorscopeView.setColorTheme('amber');
                } else {
                    this.vectorscopeView.setColorTheme('cyan');
                }
            }

            // Update live telemetry in Quality Inspector if open
            if (this.qualityInspector && this.qualityInspector.isOpen) {
                this.qualityInspector.analyzeAndRender();
            }
        });

        // Initialize Master Pre-Flight Quality Inspector
        this.qualityInspector = new QualityInspectorView(this.audioMgr, this.audioMgr.rack);
        const btnOpenQuality = document.getElementById('btn-open-quality-inspector');
        if (btnOpenQuality) {
            btnOpenQuality.addEventListener('click', () => {
                this.qualityInspector.open();
            });
        }

        // Initialize Master Presets Dropdown
        this.initPresetDropdown();

        // Spectrum Target Reference Curve Selector
        const selectTargetCurve = document.getElementById('select-target-curve');
        if (selectTargetCurve) {
            selectTargetCurve.addEventListener('change', (e) => {
                if (this.spectrumView) {
                    this.spectrumView.setTargetCurve(e.target.value);
                }
            });
        }

        // Auto-Gain Match Button (A/B Fletcher-Munson Trap Defeater)
        const btnAutoGain = document.getElementById('btn-autogain-match');
        if (btnAutoGain) {
            btnAutoGain.addEventListener('click', () => {
                this.audioMgr.setAutoGainMatch(!this.audioMgr.isAutoGainMatch);
            });
        }

        // Monitoring Matrix Switchers (Stereo, Mono Mid, Sides L-R, Delta Listen)
        const matrixPills = document.querySelectorAll('.matrix-pill');
        matrixPills.forEach(pill => {
            pill.addEventListener('click', () => {
                const mode = pill.dataset.matrix;
                this.audioMgr.setMonitorMatrix(mode);
            });
        });

        // Target Preset buttons (Legacy quick buttons)
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

        // Global Studio Hotkeys
        this.setupKeyboardShortcuts();
    }

    initPresetDropdown() {
        const selectPreset = document.getElementById('select-master-preset');
        const optgroupCustom = document.getElementById('optgroup-user-presets');
        const btnSaveCustom = document.getElementById('btn-save-custom-preset');

        const refreshCustomOptions = () => {
            if (!optgroupCustom) return;
            const customs = PresetManager.getCustomPresets();
            optgroupCustom.innerHTML = customs.map(c => `
                <option value="${c.id}">${c.name}</option>
            `).join('');
        };

        refreshCustomOptions();

        if (selectPreset) {
            selectPreset.addEventListener('change', (e) => {
                const presetId = e.target.value;
                const standardPreset = MASTERING_PRESETS.find(p => p.id === presetId);
                const customPreset = PresetManager.getCustomPresets().find(p => p.id === presetId);
                const targetPreset = standardPreset || customPreset;

                if (targetPreset && this.audioMgr.rack) {
                    PresetManager.applyPreset(targetPreset, this.audioMgr.rack);
                    this.updateVisualizersFromRack();
                    if (this.modularRackView) this.modularRackView.render();

                    // Notify audioManager about estimated target LUFS for Auto-Gain Match
                    if (presetId === 'streaming_standard') {
                        this.audioMgr.setMasteredLufs(-14.0);
                    } else if (presetId === 'edm_club_punch') {
                        this.audioMgr.setMasteredLufs(-8.0);
                    } else if (presetId === 'hiphop_trap_warmth') {
                        this.audioMgr.setMasteredLufs(-9.5);
                    } else if (presetId === 'vintage_analog_vinyl') {
                        this.audioMgr.setMasteredLufs(-12.0);
                    } else if (presetId === 'acoustic_vocal_clarity') {
                        this.audioMgr.setMasteredLufs(-16.0);
                    } else if (presetId === 'heavy_rock_punch') {
                        this.audioMgr.setMasteredLufs(-9.0);
                    }
                }
            });
        }

        if (btnSaveCustom) {
            btnSaveCustom.addEventListener('click', () => {
                const name = prompt('Enter a name for your custom mastering preset profile:', 'Custom Master Profile');
                if (name && name.trim()) {
                    PresetManager.saveCustomPreset(name.trim(), this.audioMgr.rack);
                    refreshCustomOptions();
                    selectPreset.value = `custom_${Date.now()}`;
                    alert(`Custom mastering preset "${name.trim()}" saved to local storage!`);
                }
            });
        }
    }

    setupKeyboardShortcuts() {
        const modalShortcuts = document.getElementById('shortcuts-modal');
        const btnOpenShortcuts = document.getElementById('btn-open-shortcuts');
        const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
        const btnDismissShortcuts = document.getElementById('btn-dismiss-shortcuts');

        const openShortcuts = () => { if (modalShortcuts) modalShortcuts.classList.add('visible'); };
        const closeShortcuts = () => { if (modalShortcuts) modalShortcuts.classList.remove('visible'); };

        if (btnOpenShortcuts) btnOpenShortcuts.addEventListener('click', openShortcuts);
        if (btnCloseShortcuts) btnCloseShortcuts.addEventListener('click', closeShortcuts);
        if (btnDismissShortcuts) btnDismissShortcuts.addEventListener('click', closeShortcuts);
        if (modalShortcuts) {
            modalShortcuts.addEventListener('click', (e) => {
                if (e.target === modalShortcuts) closeShortcuts();
            });
        }

        window.addEventListener('keydown', (e) => {
            // Ignore keystrokes when typing into input, textarea, or select
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

            const key = e.key;

            if (key === ' ' || e.code === 'Space') {
                e.preventDefault();
                if (this.audioMgr.isPlaying) {
                    this.audioMgr.pause();
                } else {
                    this.audioMgr.play();
                }
            } else if (key === 'b' || key === 'B') {
                this.audioMgr.setBypass(!this.audioMgr.isBypassed);
            } else if (key === 'l' || key === 'L') {
                this.audioMgr.setLoop(!this.audioMgr.isLooping);
            } else if (key === '1') {
                this.audioMgr.setMonitorSource('mastered');
            } else if (key === '2') {
                this.audioMgr.setMonitorSource('target_dry');
            } else if (key === '3') {
                this.audioMgr.setMonitorSource('reference');
            } else if (key === 'm' || key === 'M') {
                const nextMode = this.audioMgr.monitorMatrix === 'mono' ? 'stereo' : 'mono';
                this.audioMgr.setMonitorMatrix(nextMode);
            } else if (key === 's' || key === 'S') {
                const nextMode = this.audioMgr.monitorMatrix === 'sides' ? 'stereo' : 'sides';
                this.audioMgr.setMonitorMatrix(nextMode);
            } else if (key === 'd' || key === 'D') {
                const nextMode = this.audioMgr.monitorMatrix === 'delta' ? 'stereo' : 'delta';
                this.audioMgr.setMonitorMatrix(nextMode);
            } else if (key === 'a' || key === 'A') {
                this.audioMgr.setAutoGainMatch(!this.audioMgr.isAutoGainMatch);
            } else if (key === 'q' || key === 'Q') {
                if (this.qualityInspector) {
                    if (this.qualityInspector.isOpen) {
                        this.qualityInspector.close();
                    } else {
                        this.qualityInspector.open();
                    }
                }
            } else if (key === '?') {
                openShortcuts();
            } else if (key === 'Escape') {
                closeShortcuts();
                if (this.qualityInspector) this.qualityInspector.close();
                const exportModal = document.getElementById('export-modal');
                if (exportModal) exportModal.classList.remove('visible');
            }
        });
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

        if (this.audioMgr.rack) {
            const comp = this.audioMgr.rack.modules.find(m => m.type === 'master_compressor');
            if (comp) {
                comp.setParam('threshold', params.compThresholdDb);
                comp.setParam('ratio', params.compRatio);
            }
            const eq = this.audioMgr.rack.modules.find(m => m.type === 'parametric_eq');
            if (eq) {
                eq.setParam('matchAmount', params.matchAmount);
            }
            const lim = this.audioMgr.rack.modules.find(m => m.type === 'lookahead_limiter');
            if (lim) {
                lim.setParam('ceiling', params.limiterCeilingDb);
                lim.setParam('drive', Math.max(0, params.inputGainDb));
            }
            if (this.modularRackView) this.modularRackView.render();
        }

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
        if (this.modularRackView && this.audioMgr.rack && !this.modularRackView.rack) {
            this.modularRackView.setRackEngine(this.audioMgr.rack);
        }
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
        if (this.modularRackView && this.audioMgr.rack && !this.modularRackView.rack) {
            this.modularRackView.setRackEngine(this.audioMgr.rack);
        }
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

            // 4. Map directly into live Hardware-Accelerated Modular Mastering Rack
            if (this.audioMgr.rack) {
                this.audioMgr.rack.applyReferenceMatch(this.differenceData, this.matchEngine.matchAmount);
                if (this.modularRackView) {
                    this.modularRackView.render();
                }
            }

            // 5. Calculate biquad filter coefficients and map to Wasm module
            const filters = this.matchEngine.computeBiquadCoefficients(this.audioMgr.ctx.sampleRate);
            if (this.audioMgr.wasmBridge) {
                this.audioMgr.wasmBridge.setAllEqBands(filters);
            }

            // 6. Update interactive visualizers
            const evalPoints = this.matchEngine.evaluateMagnitudeResponse(filters, 256, this.audioMgr.ctx.sampleRate);
            this.spectrumView.setDifferenceData(this.differenceData, this.matchEngine.matchAmount);
            this.spectrumView.setEqResponsePoints(evalPoints);
            this.eqPlotView.setBands(filters);

            // 7. Snap UI parameter sliders to matched values
            const suggestedInputDrive = Math.max(-6, Math.min(8, this.differenceData.deltaLoudnessDb));
            const matchedParams = {
                matchAmount: this.matchEngine.matchAmount,
                inputGainDb: suggestedInputDrive,
                compThresholdDb: this.differenceData.suggestedCompThreshold,
                compRatio: this.differenceData.suggestedCompRatio,
                limiterCeilingDb: -0.2
            };

            this.transport.snapSlidersToMatchedValues(matchedParams);

            // Dispatch to Wasm DSP Engine if available
            if (this.audioMgr.wasmBridge) {
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
            }

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

    updateVisualizersFromRack() {
        if (!this.audioMgr.rack) return;
        const eqMod = this.audioMgr.rack.modules.find(m => m.type === 'parametric_eq');
        if (eqMod && eqMod.params && eqMod.params.bands) {
            const sr = this.audioMgr.ctx ? this.audioMgr.ctx.sampleRate : 48000;
            const matchAmt = eqMod.params.matchAmount !== undefined ? eqMod.params.matchAmount : 1.0;
            const filters = eqMod.params.bands.map(b => ({
                id: b.id,
                type: b.type,
                freq: b.freq,
                gainDb: b.enabled ? (b.gain * matchAmt) : 0.0,
                q: b.q
            }));
            this.eqPlotView.setBands(filters);
            const evalPoints = this.matchEngine.evaluateMagnitudeResponse(filters, 256, sr);
            this.spectrumView.setEqResponsePoints(evalPoints);
        }

        // Sync transport sliders with rack parameters
        const compMod = this.audioMgr.rack.modules.find(m => m.type === 'master_compressor');
        if (compMod && compMod.params) {
            const slThresh = document.getElementById('slider-comp-thresh');
            const slRatio = document.getElementById('slider-comp-ratio');
            const valThresh = document.getElementById('val-comp-thresh');
            const valRatio = document.getElementById('val-comp-ratio');
            if (slThresh && valThresh && Math.abs(parseFloat(slThresh.value) - compMod.params.threshold) > 0.5) {
                slThresh.value = compMod.params.threshold;
                valThresh.textContent = `${compMod.params.threshold.toFixed(1)} dB`;
            }
            if (slRatio && valRatio && Math.abs(parseFloat(slRatio.value) - compMod.params.ratio) > 0.2) {
                slRatio.value = compMod.params.ratio;
                valRatio.textContent = `${compMod.params.ratio.toFixed(1)}:1`;
            }
        }

        const limMod = this.audioMgr.rack.modules.find(m => m.type === 'lookahead_limiter');
        if (limMod && limMod.params) {
            const slCeil = document.getElementById('slider-limiter-ceil');
            const valCeil = document.getElementById('val-limiter-ceil');
            if (slCeil && valCeil && Math.abs(parseFloat(slCeil.value) - limMod.params.ceiling) > 0.1) {
                slCeil.value = limMod.params.ceiling;
                valCeil.textContent = `${limMod.params.ceiling.toFixed(1)} dB`;
            }
        }
    }

    handleMatchAmountChange(amount) {
        this.matchEngine.setMatchAmount(amount);
        if (this.audioMgr.rack) {
            const eqMod = this.audioMgr.rack.modules.find(m => m.type === 'parametric_eq');
            if (eqMod) {
                eqMod.setParam('matchAmount', amount);
            }
            if (this.modularRackView) this.modularRackView.render();
        }
        this.recomputeAndPushFilters();
    }

    handleSmoothingChange(smoothing) {
        this.matchEngine.setSmoothing(smoothing);
        if (this.audioMgr.rack) {
            const eqMod = this.audioMgr.rack.modules.find(m => m.type === 'parametric_eq');
            if (eqMod) {
                eqMod.setParam('smoothing', smoothing);
            }
        }
        if (this.targetAnalysis && this.referenceAnalysis) {
            this.differenceData = this.analyzer.computeDifferenceCurve(
                this.targetAnalysis,
                this.referenceAnalysis,
                smoothing
            );
            this.matchEngine.setDifferenceData(this.differenceData);
            if (this.audioMgr.rack) {
                this.audioMgr.rack.applyReferenceMatch(this.differenceData, this.matchEngine.matchAmount);
                if (this.modularRackView) this.modularRackView.render();
            }
            this.recomputeAndPushFilters();
        }
    }

    handleManualBandEdit(bandIndex, bandData) {
        if (bandData.gainDb !== undefined) {
            this.matchEngine.setManualBandGain(bandIndex, bandData.gainDb);
        }
        if (this.audioMgr.rack) {
            const eqMod = this.audioMgr.rack.modules.find(m => m.type === 'parametric_eq');
            if (eqMod && eqMod.params && eqMod.params.bands && eqMod.params.bands[bandIndex]) {
                if (bandData.gainDb !== undefined) eqMod.setParam('bandGain', { bandIndex, gain: bandData.gainDb });
                if (bandData.freq !== undefined) eqMod.setParam('bandFreq', { bandIndex, freq: bandData.freq });
                if (bandData.q !== undefined) eqMod.setParam('bandQ', { bandIndex, q: bandData.q });
                if (bandData.enabled !== undefined) eqMod.setParam('bandToggle', { bandIndex, enabled: bandData.enabled });
                if (this.modularRackView) this.modularRackView.render();
            }
        }
        this.recomputeAndPushFilters();
    }

    recomputeAndPushFilters() {
        const sr = this.audioMgr.ctx ? this.audioMgr.ctx.sampleRate : 48000;
        const filters = this.matchEngine.computeBiquadCoefficients(sr);
        if (this.audioMgr.wasmBridge) {
            this.audioMgr.wasmBridge.setAllEqBands(filters);
        } else {
            this.audioMgr.ensureContext().then(() => {
                if (this.audioMgr.wasmBridge) this.audioMgr.wasmBridge.setAllEqBands(filters);
            });
        }

        const evalPoints = this.matchEngine.evaluateMagnitudeResponse(filters, 256, sr);
        this.spectrumView.setDifferenceData(this.differenceData, this.matchEngine.matchAmount);
        this.spectrumView.setEqResponsePoints(evalPoints);
        this.eqPlotView.setBands(filters);
    }

    handleInputGainChange(gainDb) {
        if (this.audioMgr.rack) {
            const limMod = this.audioMgr.rack.modules.find(m => m.type === 'lookahead_limiter');
            if (limMod) {
                limMod.setParam('drive', Math.max(0, gainDb));
            }
            const satMod = this.audioMgr.rack.modules.find(m => m.type === 'tube_saturator');
            if (satMod && gainDb > 0) {
                satMod.setParam('drive', Math.min(100, 15.0 + gainDb * 3));
            }
            if (this.modularRackView) this.modularRackView.render();
        }
        if (this.audioMgr.wasmBridge) {
            this.audioMgr.wasmBridge.setInputGain(gainDb);
        }
    }

    handleCompressorChange(threshDb, ratio) {
        if (this.audioMgr.rack) {
            const compMod = this.audioMgr.rack.modules.find(m => m.type === 'master_compressor');
            if (compMod) {
                compMod.setParam('threshold', threshDb);
                compMod.setParam('ratio', ratio);
            }
            if (this.modularRackView) this.modularRackView.render();
        }
        if (this.audioMgr.wasmBridge) {
            this.audioMgr.wasmBridge.setCompressor(threshDb, ratio, 25.0, 150.0, 6.0, 0.0);
        }
    }

    handleLimiterChange(ceilingDb) {
        if (this.audioMgr.rack) {
            const limMod = this.audioMgr.rack.modules.find(m => m.type === 'lookahead_limiter');
            if (limMod) {
                limMod.setParam('ceiling', ceilingDb);
            }
            if (this.modularRackView) this.modularRackView.render();
        }
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

    calculateMomentaryLufs() {
        if (!this.audioMgr.analyserMastered) return -36;
        const buf = new Float32Array(this.audioMgr.analyserMastered.fftSize);
        this.audioMgr.analyserMastered.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
            sum += buf[i] * buf[i];
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms < 1e-4) return -48;
        return Math.max(-48, Math.min(0, 20 * Math.log10(rms)));
    }

    setupAnimationLoop() {
        let meteringAttached = false;
        const loop = () => {
            if (this.audioMgr.isPlaying && this.audioMgr.ctx) {
                // 1. Update real-time RTA spectrum
                const dataMastered = this.audioMgr.getFrequencyData(this.audioMgr.analyserMastered);
                const dataTarget = this.audioMgr.getFrequencyData(this.audioMgr.analyserTarget);
                if (this.spectrumView) {
                    this.spectrumView.setRealtimeData(dataTarget, dataMastered);
                }

                // 2. Update real-time Stereo Goniometer & Phase Vectorscope
                if (this.vectorscopeView && (this.currentScopeMode === 'vectorscope' || this.isDualScope)) {
                    const stereoData = this.audioMgr.getStereoTimeDomainData();
                    this.vectorscopeView.render(stereoData);
                }

                // 3. Update real-time Rolling Loudness History Radar
                if (this.loudnessRadarView && this.currentScopeMode === 'loudness') {
                    const mVal = this.calculateMomentaryLufs();
                    this.loudnessRadarView.pushTelemetry(mVal, mVal - 1.2);
                }

                // 4. Update real-time gain reduction meters directly from hardware rack
                if (this.audioMgr.rack) {
                    const compMod = this.audioMgr.rack.modules.find(m => m.type === 'master_compressor' || m.type === 'opto_compressor');
                    const limMod = this.audioMgr.rack.modules.find(m => m.type === 'lookahead_limiter');
                    const compGR = (compMod && typeof compMod.getReduction === 'function') ? compMod.getReduction() : 0;
                    const limGR = (limMod && typeof limMod.getReduction === 'function') ? limMod.getReduction() : 0;
                    this.metersView.updateRealtimeMasterTelemetry(compGR, limGR);
                } else if (this.audioMgr.wasmBridge && !meteringAttached) {
                    this.audioMgr.wasmBridge.setMeteringCallback((m) => {
                        this.metersView.updateRealtimeMasterTelemetry(m.compGR, m.limGR);
                    });
                    meteringAttached = true;
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
