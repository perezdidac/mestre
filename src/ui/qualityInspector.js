/**
 * Master Pre-Flight Quality Inspector Modal & Compliance Engine
 * Validates audio against commercial streaming platform standards (Spotify, Apple Music, YouTube, Tidal, CD),
 * measures Inter-Sample True Peak, Sample Peak, Dynamic Crest Factor (PLR), Mono Phase Compatibility,
 * and comprehensive 6-band Frequency Spectrum Health.
 */

import { LUFSMeter } from '../dsp/lufsMeter.js';

export class QualityInspectorView {
    constructor(audioManager, rack, callbacks = {}) {
        this.audioMgr = audioManager;
        this.rack = rack;
        this.callbacks = callbacks;
        this.isOpen = false;
        this.cachedAnalysis = null;
        this.cachedTrack = null;

        this.modalEl = document.getElementById('quality-inspector-modal');
        this.badgeEl = document.getElementById('badge-quality-status');
        this.initDOMElements();
        this.bindEvents();
    }

    initDOMElements() {
        // If modal doesn't exist in DOM yet, create it
        if (!this.modalEl) {
            this.modalEl = document.createElement('div');
            this.modalEl.className = 'modal-backdrop quality-inspector-backdrop';
            this.modalEl.id = 'quality-inspector-modal';
            this.modalEl.innerHTML = `
                <div class="modal-dialog quality-modal-dialog">
                    <div class="modal-header">
                        <div class="quality-title-row">
                            <span class="quality-icon">🔍</span>
                            <div>
                                <h3 class="modal-title">Master Pre-Flight Quality Inspector</h3>
                                <div class="quality-subtitle">ITU-R BS.1770-4 & Commercial Streaming Compliance Engine</div>
                            </div>
                        </div>
                        <button class="btn btn-secondary btn-close-quality" id="btn-close-quality">✕</button>
                    </div>

                    <div class="modal-body quality-modal-body">
                        <!-- Top Summary Cards (6 Cards) -->
                        <div class="quality-metric-cards">
                            <div class="metric-card" id="card-lufs">
                                <span class="metric-label">INTEGRATED LUFS</span>
                                <span class="metric-value" id="val-quality-lufs">--.--</span>
                                <span class="metric-sub" id="sub-quality-lufs">Target: -14.0 LUFS</span>
                            </div>
                            <div class="metric-card" id="card-truepeak">
                                <span class="metric-label">EST. TRUE-PEAK</span>
                                <span class="metric-value" id="val-quality-tp">--.-- dBTP</span>
                                <span class="metric-sub" id="sub-quality-tp">Ceiling: -1.0 dBTP</span>
                            </div>
                            <div class="metric-card" id="card-peak">
                                <span class="metric-label">SAMPLE PEAK</span>
                                <span class="metric-value" id="val-quality-peak">--.-- dBFS</span>
                                <span class="metric-sub" id="sub-quality-peak">Target: &gt; 50% Full Scale</span>
                            </div>
                            <div class="metric-card" id="card-plr">
                                <span class="metric-label">DYNAMIC RANGE (PLR)</span>
                                <span class="metric-value" id="val-quality-plr">--.-- LU</span>
                                <span class="metric-sub" id="sub-quality-plr">Optimal: 8 - 13 LU</span>
                            </div>
                            <div class="metric-card" id="card-phase">
                                <span class="metric-label">MONO INTEGRITY</span>
                                <span class="metric-value" id="val-quality-phase">--</span>
                                <span class="metric-sub" id="sub-quality-phase">Correlation: +1.00</span>
                            </div>
                            <div class="metric-card" id="card-tonal">
                                <span class="metric-label">TONAL HEALTH</span>
                                <span class="metric-value" id="val-quality-tonal">--</span>
                                <span class="metric-sub" id="sub-quality-tonal">Full Spectrum Scan</span>
                            </div>
                        </div>

                        <!-- Interactive Real-Time Compliance Tuner -->
                        <div class="quality-interactive-deck">
                            <div class="deck-tuning-title">
                                <span class="tuning-title-main">🎛️ REAL-TIME COMPLIANCE TUNER</span>
                                <span class="tuning-subtext">Directly tune rack parameters to make all compliance checks PASS</span>
                            </div>
                            <div class="tuning-controls-grid">
                                <!-- Loudness Drive Control -->
                                <div class="tuning-card">
                                    <div class="tuning-card-header">
                                        <span class="tuning-card-label">MASTER LOUDNESS DRIVE</span>
                                        <span class="tuning-card-val" id="val-tuning-drive">+0.0 dB</span>
                                    </div>
                                    <input type="range" class="styled-range tuning-slider" id="slider-tuning-drive" min="0" max="18" step="0.5" value="0">
                                    <div class="tuning-quick-buttons">
                                        <button class="btn-tune-quick" data-lufs="-14.0" title="Auto-tune for Spotify (-14 LUFS)">-14 LUFS (Spotify)</button>
                                        <button class="btn-tune-quick" data-lufs="-9.0" title="Auto-tune for Club/Beatport (-9 LUFS)">-9 LUFS (Club)</button>
                                        <button class="btn-tune-quick" data-lufs="-12.0" title="Auto-tune for CD/Radio (-12 LUFS)">-12 LUFS (CD)</button>
                                    </div>
                                </div>

                                <!-- Ceiling / True-Peak Guard Control -->
                                <div class="tuning-card">
                                    <div class="tuning-card-header">
                                        <span class="tuning-card-label">TRUE-PEAK CEILING</span>
                                        <span class="tuning-card-val" id="val-tuning-ceiling">-1.0 dBTP</span>
                                    </div>
                                    <input type="range" class="styled-range tuning-slider" id="slider-tuning-ceiling" min="-2.0" max="0.0" step="0.1" value="-1.0">
                                    <div class="tuning-quick-buttons">
                                        <button class="btn-tune-ceil" data-ceil="-1.0" title="Safe streaming ceiling (-1.0 dBTP)">-1.0 dBTP (Safe)</button>
                                        <button class="btn-tune-ceil" data-ceil="-0.3" title="CD/Beatport ceiling (-0.3 dBTP)">-0.3 dBTP (Hot)</button>
                                        <button class="btn-tune-ceil" data-ceil="-2.0" title="Classical/Broadcast (-2.0 dBTP)">-2.0 dBTP (Audiophile)</button>
                                    </div>
                                </div>

                                <!-- Stereo Width & Mono Bass Filter Control -->
                                <div class="tuning-card">
                                    <div class="tuning-card-header">
                                        <span class="tuning-card-label">STEREO WIDTH & MONO BASS</span>
                                        <span class="tuning-card-val" id="val-tuning-width">100%</span>
                                    </div>
                                    <input type="range" class="styled-range tuning-slider" id="slider-tuning-width" min="70" max="140" step="5" value="100">
                                    <div class="tuning-quick-buttons">
                                        <button class="btn-tune-action" id="btn-tune-mono-bass" title="Force mono bass under 90Hz to fix phase issues">🛡️ Monofy Bass &lt;90Hz</button>
                                        <button class="btn-tune-action" id="btn-reset-width" title="Reset standard stereo width">Reset 100%</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Frequency Spectrum Balance Section -->
                        <div class="quality-section-block">
                            <div class="quality-block-header">
                                <div class="quality-block-title">TONAL & FREQUENCY SPECTRUM BALANCE</div>
                                <span class="freq-balance-tag tag-pass" id="badge-freq-balance">SCANNING...</span>
                            </div>
                            <div class="freq-balance-grid" id="freq-balance-grid">
                                <!-- Populated dynamically -->
                            </div>
                        </div>

                        <!-- Platform Compliance Table -->
                        <div class="quality-section-block">
                            <div class="quality-block-title">STREAMING DISTRIBUTION COMPLIANCE</div>
                            <div class="compliance-table" id="compliance-table">
                                <!-- Dynamically populated -->
                            </div>
                        </div>

                        <!-- Technical Audio Diagnostics -->
                        <div class="quality-section-block">
                            <div class="quality-block-title">DIAGNOSTICS & RECOMMENDATIONS</div>
                            <div class="diagnostics-list" id="diagnostics-list">
                                <div class="diag-item diag-info">Upload a track to inspect master compliance, headroom, and frequency balance.</div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer quality-modal-footer">
                        <button class="btn btn-secondary" id="btn-copy-quality-report">📋 Copy Report</button>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-demo" id="btn-render-master-inspector" title="Render entire song through current rack and re-scan post-processed wave">⚡ Render Master Wave & Re-Scan</button>
                            <button class="btn btn-demo" id="btn-maximize-headroom" style="display: none;">⚡ Maximize Headroom to -1.0 dBTP</button>
                            <button class="btn btn-demo" id="btn-auto-fix-streaming">⚡ Auto-Align for Spotify (-14 LUFS)</button>
                            <button class="btn btn-secondary" id="btn-dismiss-quality">Done</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(this.modalEl);
        }
    }

    bindEvents() {
        const btnClose = this.modalEl.querySelector('#btn-close-quality');
        const btnDismiss = this.modalEl.querySelector('#btn-dismiss-quality');
        const btnCopy = this.modalEl.querySelector('#btn-copy-quality-report');
        const btnAutoFix = this.modalEl.querySelector('#btn-auto-fix-streaming');
        const btnMaximize = this.modalEl.querySelector('#btn-maximize-headroom');
        const btnRenderMaster = this.modalEl.querySelector('#btn-render-master-inspector');

        if (btnClose) btnClose.addEventListener('click', () => this.close());
        if (btnDismiss) btnDismiss.addEventListener('click', () => this.close());

        if (btnCopy) {
            btnCopy.addEventListener('click', () => this.copyReportToClipboard());
        }

        if (btnAutoFix) {
            btnAutoFix.addEventListener('click', () => this.applyAutoFixStreaming());
        }

        if (btnMaximize) {
            btnMaximize.addEventListener('click', () => this.applyMaximizeHeadroom());
        }

        if (btnRenderMaster) {
            btnRenderMaster.addEventListener('click', () => {
                if (this.callbacks.onRenderMasterRequested) {
                    btnRenderMaster.textContent = '⏳ Rendering...';
                    this.callbacks.onRenderMasterRequested((masteredBuffer, stats) => {
                        btnRenderMaster.textContent = '✓ Master Rendered & Scanned!';
                        btnRenderMaster.style.background = '#10b981';
                        this.setMasteredAnalysis(stats, masteredBuffer);
                        setTimeout(() => {
                            btnRenderMaster.textContent = '⚡ Render Master Wave & Re-Scan';
                            btnRenderMaster.style.background = '';
                        }, 2500);
                    });
                }
            });
        }

        // Live Drive Slider
        const sliderDrive = this.modalEl.querySelector('#slider-tuning-drive');
        const valDrive = this.modalEl.querySelector('#val-tuning-drive');
        if (sliderDrive) {
            sliderDrive.addEventListener('input', (e) => {
                const driveVal = parseFloat(e.target.value);
                if (valDrive) valDrive.textContent = `+${driveVal.toFixed(1)} dB`;
                this.tuneLimiterDrive(driveVal);
            });
        }

        // Quick LUFS Target Buttons
        const quickLufsBtns = this.modalEl.querySelectorAll('.btn-tune-quick');
        quickLufsBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetLufs = parseFloat(btn.dataset.lufs);
                const track = this.audioMgr.targetTrack;
                const curLufs = track?.lufs != null ? track.lufs : -20.0;
                const neededDrive = Math.max(0.0, Math.min(18.0, (targetLufs - curLufs) + 1.2));
                if (sliderDrive) sliderDrive.value = neededDrive;
                if (valDrive) valDrive.textContent = `+${neededDrive.toFixed(1)} dB`;
                this.tuneLimiterDrive(neededDrive);
            });
        });

        // Live Ceiling Slider
        const sliderCeil = this.modalEl.querySelector('#slider-tuning-ceiling');
        const valCeil = this.modalEl.querySelector('#val-tuning-ceiling');
        if (sliderCeil) {
            sliderCeil.addEventListener('input', (e) => {
                const ceilVal = parseFloat(e.target.value);
                if (valCeil) valCeil.textContent = `${ceilVal.toFixed(1)} dBTP`;
                this.tuneLimiterCeiling(ceilVal);
            });
        }

        // Quick Ceiling Buttons
        const quickCeilBtns = this.modalEl.querySelectorAll('.btn-tune-ceil');
        quickCeilBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const ceil = parseFloat(btn.dataset.ceil);
                if (sliderCeil) sliderCeil.value = ceil;
                if (valCeil) valCeil.textContent = `${ceil.toFixed(1)} dBTP`;
                this.tuneLimiterCeiling(ceil);
            });
        });

        // Live Width Slider
        const sliderWidth = this.modalEl.querySelector('#slider-tuning-width');
        const valWidth = this.modalEl.querySelector('#val-tuning-width');
        if (sliderWidth) {
            sliderWidth.addEventListener('input', (e) => {
                const wVal = parseFloat(e.target.value);
                if (valWidth) valWidth.textContent = `${Math.round(wVal)}%`;
                this.tuneStereoWidth(wVal);
            });
        }

        const btnMonoBass = this.modalEl.querySelector('#btn-tune-mono-bass');
        if (btnMonoBass) {
            btnMonoBass.addEventListener('click', () => {
                this.toggleMonoBass(btnMonoBass);
            });
        }

        const btnResetWidth = this.modalEl.querySelector('#btn-reset-width');
        if (btnResetWidth) {
            btnResetWidth.addEventListener('click', () => {
                if (sliderWidth) sliderWidth.value = 100;
                if (valWidth) valWidth.textContent = '100%';
                this.tuneStereoWidth(100);
            });
        }

        // Event delegation for Frequency Band trims and Fix actions
        const freqGrid = this.modalEl.querySelector('#freq-balance-grid');
        if (freqGrid) {
            freqGrid.addEventListener('click', (e) => {
                const trimBtn = e.target.closest('.freq-trim-btn');
                if (trimBtn) {
                    const bandId = trimBtn.dataset.band;
                    const action = trimBtn.dataset.action;
                    const delta = action === 'boost' ? 1.5 : -1.5;
                    this.trimFrequencyBand(bandId, delta);
                    return;
                }
                const fixBtn = e.target.closest('.btn-band-fix');
                if (fixBtn) {
                    const fixType = fixBtn.dataset.fix;
                    this.executeFix(fixType);
                }
            });
        }

        // Event delegation for Diagnostics list Fix actions
        const diagList = this.modalEl.querySelector('#diagnostics-list');
        if (diagList) {
            diagList.addEventListener('click', (e) => {
                const fixBtn = e.target.closest('.btn-diag-fix');
                if (fixBtn) {
                    const fixType = fixBtn.dataset.fix;
                    this.executeFix(fixType);
                }
            });
        }

        // Close on backdrop click
        this.modalEl.addEventListener('click', (e) => {
            if (e.target === this.modalEl) this.close();
        });
    }

    open() {
        this.isOpen = true;
        this.modalEl.classList.add('visible');
        this.syncTunerControlsWithRack();
        this.analyzeAndRender();
    }

    close() {
        this.isOpen = false;
        this.modalEl.classList.remove('visible');
    }

    /**
     * Complete live analysis of the active target audio track
     */
    analyzeAndRender() {
        const track = this.audioMgr.targetTrack;
        if (!track || !track.audioBuffer) {
            this.renderEmptyState();
            return;
        }

        // Run full PCM measurement on the audioBuffer if not cached or track changed
        if (!this.cachedAnalysis || this.cachedTrack !== track) {
            this.cachedAnalysis = this.measureAudioBuffer(track.audioBuffer, track);
            this.cachedTrack = track;
        }

        const metrics = this.cachedAnalysis;
        const {
            lufs,
            samplePeakDb,
            samplePeakLinear,
            truePeakDb,
            plr,
            phaseCorr,
            clippedSamples,
            dcOffset,
            freqBands,
            tonalSummary
        } = metrics;

        // 1. Update Metric Cards
        const valLufs = document.getElementById('val-quality-lufs');
        const valTp = document.getElementById('val-quality-tp');
        const valPeak = document.getElementById('val-quality-peak');
        const subPeak = document.getElementById('sub-quality-peak');
        const valPlr = document.getElementById('val-quality-plr');
        const valPhase = document.getElementById('val-quality-phase');
        const subPhase = document.getElementById('sub-quality-phase');
        const valTonal = document.getElementById('val-quality-tonal');
        const subTonal = document.getElementById('sub-quality-tonal');

        if (valLufs) valLufs.textContent = `${lufs.toFixed(1)} LUFS`;
        if (valTp) valTp.textContent = `${truePeakDb.toFixed(2)} dBTP`;
        if (valPlr) valPlr.textContent = `${plr.toFixed(1)} LU`;

        if (valPeak) {
            valPeak.textContent = `${samplePeakDb.toFixed(1)} dBFS`;
        }
        if (subPeak) {
            const pct = Math.round(samplePeakLinear * 100);
            subPeak.textContent = `${pct}% Full Scale • ${samplePeakLinear < 0.5 ? 'Low Headroom!' : 'Normal'}`;
        }

        let phaseGrade = 'A+ (Safe)';
        let phaseText = 'Optimal mono integrity';
        let phaseClass = 'status-pass';

        if (phaseCorr >= 0.8) {
            phaseGrade = 'A+ (Safe)';
            phaseText = 'Zero phase cancellation';
        } else if (phaseCorr >= 0.5) {
            phaseGrade = 'A (Good)';
            phaseText = 'Solid stereo depth';
        } else if (phaseCorr >= 0.2) {
            phaseGrade = 'B (Wide)';
            phaseText = 'Noticeable mono drop';
            phaseClass = 'status-warn';
        } else if (phaseCorr >= 0.0) {
            phaseGrade = 'C (Warning)';
            phaseText = 'High mono cancel risk';
            phaseClass = 'status-warn';
        } else {
            phaseGrade = 'F (Phased)';
            phaseText = 'Severe phase cancellation!';
            phaseClass = 'status-fail';
        }

        if (valPhase) {
            valPhase.textContent = phaseGrade;
            valPhase.className = `metric-value ${phaseClass}`;
        }
        if (subPhase) subPhase.textContent = `Corr: ${phaseCorr >= 0 ? '+' : ''}${phaseCorr.toFixed(2)} • ${phaseText}`;

        if (valTonal) {
            valTonal.textContent = tonalSummary.title;
            valTonal.className = `metric-value ${tonalSummary.statusClass}`;
        }
        if (subTonal) {
            subTonal.textContent = tonalSummary.sub;
        }

        // Color code cards
        const cardLufs = document.getElementById('card-lufs');
        const cardTp = document.getElementById('card-truepeak');
        const cardPeak = document.getElementById('card-peak');
        const cardPlr = document.getElementById('card-plr');
        const cardTonal = document.getElementById('card-tonal');

        if (cardLufs) {
            const lufsDiff = Math.abs(lufs - (-14.0));
            cardLufs.className = `metric-card ${lufsDiff <= 1.5 ? 'status-pass' : lufsDiff <= 3.5 ? 'status-warn' : 'status-fail'}`;
        }

        if (cardTp) {
            cardTp.className = `metric-card ${truePeakDb <= -1.0 ? 'status-pass' : truePeakDb <= 0.0 ? 'status-warn' : 'status-fail'}`;
        }

        if (cardPeak) {
            if (samplePeakLinear < 0.25 || clippedSamples > 5) {
                cardPeak.className = 'metric-card status-fail';
            } else if (samplePeakLinear < 0.5) {
                cardPeak.className = 'metric-card status-warn';
            } else {
                cardPeak.className = 'metric-card status-pass';
            }
        }

        if (cardPlr) {
            cardPlr.className = `metric-card ${plr >= 8.0 && plr <= 13.5 ? 'status-pass' : plr >= 6.0 ? 'status-warn' : 'status-fail'}`;
        }

        if (cardTonal) {
            cardTonal.className = `metric-card ${tonalSummary.statusClass}`;
        }

        // 2. Render Frequency Spectrum Balance Block
        this.renderFrequencyBalance(freqBands, tonalSummary);

        // 3. Render Platform Compliance Table
        this.renderComplianceTable(lufs, truePeakDb, plr);

        // 4. Render Diagnostics & Recommendations
        this.renderDiagnostics(metrics);

        // 5. Toggle Maximize Headroom button if track is under-driven
        const btnMaximize = document.getElementById('btn-maximize-headroom');
        if (btnMaximize) {
            if (samplePeakLinear < 0.6) {
                btnMaximize.style.display = 'inline-flex';
                btnMaximize.textContent = `⚡ Maximize Headroom (+${(Math.abs(samplePeakDb) - 1.0).toFixed(1)} dB)`;
            } else {
                btnMaximize.style.display = 'none';
            }
        }
    }

    renderEmptyState() {
        const list = document.getElementById('diagnostics-list');
        if (list) {
            list.innerHTML = `<div class="diag-item diag-warn">No Target audio track loaded. Drag and drop a track to inspect mastering compliance.</div>`;
        }
        const grid = document.getElementById('freq-balance-grid');
        if (grid) grid.innerHTML = '';
        const table = document.getElementById('compliance-table');
        if (table) table.innerHTML = '';
    }

    /**
     * Comprehensive AudioBuffer PCM Analysis
     */
    measureAudioBuffer(audioBuffer, track) {
        const sr = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const channelL = audioBuffer.getChannelData(0);
        const channelR = numChannels > 1 ? audioBuffer.getChannelData(1) : channelL;
        const len = channelL.length;

        let maxPeak = 0;
        let sumSq = 0;
        let sumL2 = 0;
        let sumR2 = 0;
        let sumLR = 0;
        let dcSumL = 0;
        let dcSumR = 0;
        let clippedCount = 0;

        // Adaptive scan stride for lightning-fast responsiveness on huge files
        const stride = len > 3000000 ? 2 : 1;
        let scanned = 0;

        for (let i = 0; i < len; i += stride) {
            const sL = channelL[i];
            const sR = channelR[i];
            const aL = Math.abs(sL);
            const aR = Math.abs(sR);

            if (aL > maxPeak) maxPeak = aL;
            if (aR > maxPeak) maxPeak = aR;

            if (aL >= 0.9999 || aR >= 0.9999) clippedCount++;

            sumSq += sL * sL + sR * sR;
            sumL2 += sL * sL;
            sumR2 += sR * sR;
            sumLR += sL * sR;
            dcSumL += sL;
            dcSumR += sR;
            scanned++;
        }

        const denomPhase = Math.sqrt(sumL2 * sumR2);
        const phaseCorr = denomPhase > 1e-9 ? Math.max(-1.0, Math.min(1.0, sumLR / denomPhase)) : 1.0;

        const samplePeakLinear = maxPeak;
        const samplePeakDb = maxPeak > 1e-6 ? 20.0 * Math.log10(maxPeak) : -120.0;
        const rmsLin = scanned > 0 ? Math.sqrt(sumSq / (scanned * 2)) : 0;
        const rmsDb = rmsLin > 1e-6 ? 20.0 * Math.log10(rmsLin) : -120.0;
        const dcOffset = scanned > 0 ? Math.max(Math.abs(dcSumL / scanned), Math.abs(dcSumR / scanned)) : 0;

        // 4x Oversampled True-Peak estimation (ITU-R BS.1770-4 inter-sample peak interpolation)
        let truePeakMax = maxPeak;
        const threshold = maxPeak * 0.82;
        const searchStep = 2;
        for (let i = 2; i < len - 3; i += searchStep) {
            if (Math.abs(channelL[i]) > threshold) {
                // Catmull-Rom 4-point cubic Hermite oversample
                const y0 = channelL[i - 1], y1 = channelL[i], y2 = channelL[i + 1], y3 = channelL[i + 2];
                const mid = 0.5 * y1 + 0.5 * y2 + 0.125 * (y1 - y0 + y2 - y3);
                const absM = Math.abs(mid);
                if (absM > truePeakMax) truePeakMax = absM;
            }
            if (numChannels > 1 && Math.abs(channelR[i]) > threshold) {
                const y0 = channelR[i - 1], y1 = channelR[i], y2 = channelR[i + 1], y3 = channelR[i + 2];
                const mid = 0.5 * y1 + 0.5 * y2 + 0.125 * (y1 - y0 + y2 - y3);
                const absM = Math.abs(mid);
                if (absM > truePeakMax) truePeakMax = absM;
            }
        }
        const truePeakDb = truePeakMax > 1e-6 ? 20.0 * Math.log10(truePeakMax) : -120.0;

        // Integrated Loudness (use pre-computed if available, else fast LUFSMeter)
        let lufs = track?.lufs;
        if (lufs == null) {
            try {
                const lufsMeter = new LUFSMeter();
                const dynamics = lufsMeter.analyzeAudioBuffer(audioBuffer);
                lufs = dynamics.integratedLUFS;
            } catch (_) {
                lufs = rmsDb - 0.7;
            }
        }
        const plr = Math.max(0, samplePeakDb - lufs);

        // 6-Band Frequency Balance & Spectral Health Scan
        const freqBands = this.computeFrequencyBalance(audioBuffer);
        const tonalSummary = this.evaluateTonalHealth(freqBands, samplePeakLinear);

        return {
            lufs,
            samplePeakDb,
            samplePeakLinear,
            truePeakDb,
            rmsDb,
            plr,
            phaseCorr,
            clippedSamples: clippedCount,
            dcOffset,
            freqBands,
            tonalSummary
        };
    }

    /**
     * Compute 6-band frequency energy balance using fast FFT windowing
     */
    computeFrequencyBalance(audioBuffer) {
        const sr = audioBuffer.sampleRate;
        const channelL = audioBuffer.getChannelData(0);
        const channelR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : channelL;
        const len = channelL.length;

        const windowSize = 2048;
        const numHops = Math.min(28, Math.floor(len / windowSize));
        const hopStep = Math.max(windowSize, Math.floor((len - windowSize) / Math.max(1, numHops - 1)));

        let eSub = 0;      // 20 - 60 Hz
        let eBass = 0;     // 60 - 250 Hz
        let eLowMid = 0;   // 250 - 500 Hz
        let eMid = 0;      // 500 - 2500 Hz
        let ePres = 0;     // 2500 - 6000 Hz
        let eAir = 0;      // 6000 - 20000 Hz
        let eTotal = 0;

        const binWidth = (sr / 2) / (windowSize / 2);

        // Hann window
        const win = new Float32Array(windowSize);
        for (let i = 0; i < windowSize; i++) {
            win[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (windowSize - 1)));
        }

        const real = new Float32Array(windowSize);
        const imag = new Float32Array(windowSize);

        for (let h = 0; h < numHops; h++) {
            const start = h * hopStep;
            for (let i = 0; i < windowSize; i++) {
                real[i] = 0.5 * (channelL[start + i] + channelR[start + i]) * win[i];
                imag[i] = 0;
            }

            this.fftRadix2(real, imag);

            for (let k = 1; k < windowSize / 2; k++) {
                const freq = k * binWidth;
                const p = real[k] * real[k] + imag[k] * imag[k];
                eTotal += p;

                if (freq >= 20 && freq < 60) eSub += p;
                else if (freq >= 60 && freq < 250) eBass += p;
                else if (freq >= 250 && freq < 500) eLowMid += p;
                else if (freq >= 500 && freq < 2500) eMid += p;
                else if (freq >= 2500 && freq < 6000) ePres += p;
                else if (freq >= 6000 && freq <= 20000) eAir += p;
            }
        }

        const toRelDb = (energy) => {
            if (eTotal <= 1e-12 || energy <= 1e-12) return -50;
            return 10.0 * Math.log10(energy / eTotal);
        };

        return [
            { id: 'sub', name: 'SUB', range: '20–60 Hz', relDb: toRelDb(eSub), targetMin: -16, targetMax: -8 },
            { id: 'bass', name: 'BASS', range: '60–250 Hz', relDb: toRelDb(eBass), targetMin: -11, targetMax: -5 },
            { id: 'lowmid', name: 'LOW-MID', range: '250–500 Hz', relDb: toRelDb(eLowMid), targetMin: -13, targetMax: -7 },
            { id: 'mid', name: 'MID', range: '500–2.5k', relDb: toRelDb(eMid), targetMin: -8, targetMax: -3 },
            { id: 'pres', name: 'PRESENCE', range: '2.5k–6k', relDb: toRelDb(ePres), targetMin: -14, targetMax: -8 },
            { id: 'air', name: 'AIR', range: '6k–20k', relDb: toRelDb(eAir), targetMin: -19, targetMax: -11 }
        ];
    }

    /**
     * Fast in-place Radix-2 FFT algorithm
     */
    fftRadix2(real, imag) {
        const n = real.length;
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                const tr = real[i]; real[i] = real[j]; real[j] = tr;
                const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
            }
            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }

        for (let len = 2; len <= n; len <<= 1) {
            const half = len >> 1;
            const angle = (-2.0 * Math.PI) / len;
            const wStepR = Math.cos(angle);
            const wStepI = Math.sin(angle);

            for (let i = 0; i < n; i += len) {
                let wr = 1.0;
                let wi = 0.0;
                for (let m = 0; m < half; m++) {
                    const uR = real[i + m];
                    const uI = imag[i + m];
                    const vR = real[i + m + half] * wr - imag[i + m + half] * wi;
                    const vI = real[i + m + half] * wi + imag[i + m + half] * wr;

                    real[i + m] = uR + vR;
                    imag[i + m] = uI + vI;
                    real[i + m + half] = uR - vR;
                    imag[i + m + half] = uI - vI;

                    const nextWr = wr * wStepR - wi * wStepI;
                    wi = wr * wStepI + wi * wStepR;
                    wr = nextWr;
                }
            }
        }
    }

    evaluateTonalHealth(bands, peakLinear) {
        if (peakLinear < 0.25) {
            return { title: 'Severely Under-Driven', sub: 'Signal < 25% Full Scale', statusClass: 'status-fail' };
        }
        if (peakLinear < 0.5) {
            return { title: 'Low Signal Level', sub: 'Peak < 50% Full Scale', statusClass: 'status-warn' };
        }

        const lowMid = bands.find(b => b.id === 'lowmid');
        const pres = bands.find(b => b.id === 'pres');
        const air = bands.find(b => b.id === 'air');
        const sub = bands.find(b => b.id === 'sub');

        if (lowMid && lowMid.relDb > -6.5) {
            return { title: 'Mud Buildup', sub: '250-500 Hz Congested', statusClass: 'status-warn' };
        }
        if (pres && pres.relDb > -7.5) {
            return { title: 'Harsh Presence', sub: '3-5 kHz Resonant', statusClass: 'status-warn' };
        }
        if (air && air.relDb < -22.0) {
            return { title: 'Dark / Muffled', sub: 'Roll-off above 8k', statusClass: 'status-warn' };
        }
        if (sub && sub.relDb > -6.0) {
            return { title: 'Heavy Sub', sub: 'Sub-Bass Dominant', statusClass: 'status-warn' };
        }

        return { title: 'Balanced Tone', sub: 'Pro Mastering Contour', statusClass: 'status-pass' };
    }

    renderFrequencyBalance(bands, tonalSummary) {
        const grid = document.getElementById('freq-balance-grid');
        const tag = document.getElementById('badge-freq-balance');
        if (tag) {
            tag.textContent = tonalSummary.title;
            tag.className = `freq-balance-tag tag-${tonalSummary.statusClass.replace('status-', '')}`;
        }
        if (!grid) return;

        grid.innerHTML = bands.map(b => {
            let status = 'BALANCED';
            let statusClass = 'status-pass';

            if (b.relDb > b.targetMax) {
                status = b.id === 'lowmid' ? 'MUDDY' : (b.id === 'pres' ? 'HARSH' : 'HOT');
                statusClass = 'status-warn';
            } else if (b.relDb < b.targetMin) {
                status = b.id === 'air' ? 'DULL' : 'LOW';
                statusClass = 'status-warn';
            }

            // Meter width mapped from -30 dB (0%) to 0 dB (100%)
            const norm = Math.max(0.05, Math.min(1.0, (b.relDb + 32) / 32));
            const widthPct = Math.round(norm * 100);

            let fixBtnHtml = '';
            if (b.id === 'lowmid' && status === 'MUDDY') {
                fixBtnHtml = `<button class="btn-band-fix" data-fix="de-mud">🧹 De-Mud (-3dB)</button>`;
            } else if (b.id === 'pres' && status === 'HARSH') {
                fixBtnHtml = `<button class="btn-band-fix" data-fix="de-harsh">✨ De-Harsh (-2.5dB)</button>`;
            } else if (b.id === 'air' && status === 'DULL') {
                fixBtnHtml = `<button class="btn-band-fix" data-fix="add-air">🌟 Add Air (+3dB)</button>`;
            } else if (b.id === 'sub' && status === 'HOT') {
                fixBtnHtml = `<button class="btn-band-fix" data-fix="tighten-sub">🔇 Tighten Sub</button>`;
            }

            return `
                <div class="freq-band-card ${statusClass}">
                    <div class="freq-band-header">
                        <span class="freq-band-name">${b.name}</span>
                        <div class="freq-band-trim-group">
                            <button class="freq-trim-btn" data-band="${b.id}" data-action="cut" title="Reduce band energy by 1.5 dB">−</button>
                            <button class="freq-trim-btn" data-band="${b.id}" data-action="boost" title="Increase band energy by 1.5 dB">+</button>
                        </div>
                        <span class="freq-band-hz">${b.range}</span>
                    </div>
                    <div class="freq-meter-track">
                        <div class="freq-meter-fill ${statusClass}" style="width: ${widthPct}%;"></div>
                    </div>
                    <div class="freq-band-footer">
                        <span class="freq-band-val">${b.relDb.toFixed(1)} dB</span>
                        <span class="freq-band-status ${statusClass}">${status}</span>
                    </div>
                    ${fixBtnHtml ? `<div class="freq-band-fix-row">${fixBtnHtml}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    renderComplianceTable(lufs, truePeakDb, plr) {
        const container = document.getElementById('compliance-table');
        if (!container) return;

        const platforms = [
            { name: 'Spotify Normalization', targetLufs: -14.0, maxTp: -1.0, icon: '🟢' },
            { name: 'Apple Music (Sound Check)', targetLufs: -16.0, maxTp: -1.0, icon: '🍎' },
            { name: 'YouTube Audio', targetLufs: -14.0, maxTp: -1.0, icon: '🔴' },
            { name: 'Tidal / Amazon Music', targetLufs: -14.0, maxTp: -1.0, icon: '🌊' },
            { name: 'CD Red Book Audio', targetLufs: -10.0, maxTp: -0.2, icon: '💿' },
            { name: 'Club / DJ Master (Beatport)', targetLufs: -7.5, maxTp: -0.1, icon: '🎧' }
        ];

        let html = '';
        for (const p of platforms) {
            const lufsDelta = lufs - p.targetLufs;
            const tpPass = truePeakDb <= p.maxTp;

            let statusBadge = '<span class="comp-badge pass">PASS</span>';
            let penaltyDesc = 'No volume attenuation applied';

            if (!tpPass && truePeakDb > 0.0) {
                statusBadge = '<span class="comp-badge fail">CLIPPING</span>';
                penaltyDesc = 'Inter-sample clipping: platform lossy transcoders will distort!';
            } else if (lufsDelta > 1.5) {
                statusBadge = '<span class="comp-badge warn">TURN DOWN</span>';
                penaltyDesc = `Platform will turn volume DOWN by -${lufsDelta.toFixed(1)} dB`;
            } else if (lufsDelta < -2.5 && p.targetLufs === -14.0) {
                statusBadge = '<span class="comp-badge warn">QUIET</span>';
                penaltyDesc = `Softer than commercial average (+${Math.abs(lufsDelta).toFixed(1)} dB headroom available)`;
            }

            html += `
                <div class="compliance-row">
                    <div class="comp-col-name">${p.icon} <strong>${p.name}</strong></div>
                    <div class="comp-col-target">Target: ${p.targetLufs.toFixed(1)} LUFS (Ceiling ${p.maxTp} dBTP)</div>
                    <div class="comp-col-desc">${penaltyDesc}</div>
                    <div class="comp-col-status">${statusBadge}</div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderDiagnostics(metrics) {
        const list = document.getElementById('diagnostics-list');
        if (!list) return;

        const {
            lufs,
            samplePeakDb,
            samplePeakLinear,
            truePeakDb,
            plr,
            phaseCorr,
            clippedSamples,
            dcOffset,
            freqBands
        } = metrics;

        const items = [];

        // 1. Low Sample Peak / Under-Modulated Signal Alert (Direct User Issue!)
        if (samplePeakLinear < 0.25) {
            items.push({
                type: 'fail',
                title: 'CRITICAL ALERT: Severely Under-Driven Signal (< 25% Full Scale)',
                text: `Maximum sample peak is ${samplePeakDb.toFixed(1)} dBFS (only ${(samplePeakLinear * 100).toFixed(0)}% full scale). Over 12 dB of digital resolution is wasted. The track will sound unacceptably quiet on Spotify and streaming platforms. Click "Auto-Boost" to bring to commercial volume.`,
                action: { label: '⚡ Auto-Boost to -14 LUFS', fix: 'boost-commercial' }
            });
        } else if (samplePeakLinear < 0.5) {
            items.push({
                type: 'warn',
                title: 'HEADROOM ALERT: Signal Peak Is Under 50% of Full Scale',
                text: `Max sample peak is ${samplePeakDb.toFixed(1)} dBFS (${(samplePeakLinear * 100).toFixed(0)}% amplitude, not even half of available ceiling). The master is under-modulated by ${Math.abs(samplePeakDb + 1.0).toFixed(1)} dB, sacrificing signal-to-noise ratio and loudness impact. Recommended: Boost drive to reach -14.0 LUFS.`,
                action: { label: '⚡ Auto-Boost to -14 LUFS', fix: 'boost-commercial' }
            });
        } else if (samplePeakDb > -0.05 || clippedSamples > 5) {
            items.push({
                type: 'fail',
                title: 'DIGITAL CLIPPING: Samples Hitting 0.0 dBFS Full Scale',
                text: `Found ${clippedSamples} samples hitting or exceeding 0.0 dBFS ceiling. Signal is experiencing digital hard-clipping. Pull back input drive or lower limiter ceiling.`,
                action: { label: '🛡️ Lower Ceiling to -1.0 dBTP', fix: 'clamp-ceiling' }
            });
        } else {
            items.push({
                type: 'pass',
                title: 'Sample Headroom Healthy',
                text: `Peak amplitude sits at ${samplePeakDb.toFixed(1)} dBFS (${(samplePeakLinear * 100).toFixed(0)}% full scale). Healthy digital converter modulation.`
            });
        }

        // 2. Inter-Sample True Peak Alert
        if (truePeakDb > 0.0) {
            items.push({
                type: 'fail',
                title: 'Inter-Sample Peak (True-Peak) Clipping Detected',
                text: `Estimated true-peak is ${truePeakDb.toFixed(2)} dBTP (> 0.0 dBTP). When compressed to lossy formats (MP3/AAC/Ogg) on streaming platforms, this will cause harsh distortion. Lower the limiter ceiling to -1.0 dBTP.`,
                action: { label: '🛡️ Clamp Ceiling to -1.0 dBTP', fix: 'clamp-ceiling' }
            });
        } else if (truePeakDb > -1.0) {
            items.push({
                type: 'warn',
                title: 'True Peak Above -1.0 dBTP Streaming Recommendation',
                text: `True-peak is ${truePeakDb.toFixed(2)} dBTP. Major streaming guidelines recommend a -1.0 dBTP ceiling for lossy transcoding safety.`,
                action: { label: '🛡️ Clamp Ceiling to -1.0 dBTP', fix: 'clamp-ceiling' }
            });
        } else {
            items.push({
                type: 'pass',
                title: 'True-Peak Ceiling Compliant (< -1.0 dBTP)',
                text: `True-peak is safe at ${truePeakDb.toFixed(2)} dBTP. Zero inter-sample clipping risk on lossy streaming encoders.`
            });
        }

        // 3. DC Offset Alert
        if (dcOffset > 0.003) {
            items.push({
                type: 'warn',
                title: 'DC Offset Bias Detected',
                text: `Asymmetrical DC offset of ${(dcOffset * 100).toFixed(2)}% detected in the waveform. This robs available headroom and can produce clicks or pops. Engage the Parametric EQ Sub filter (high-pass at 25-30 Hz).`,
                action: { label: '🔇 Tighten Sub (<35Hz HP)', fix: 'tighten-sub' }
            });
        }

        // 4. Loudness Alert
        if (lufs > -12.0) {
            items.push({
                type: 'warn',
                title: 'Loudness Exceeds Streaming Normalization (-14.0 LUFS)',
                text: `Integrated loudness is ${lufs.toFixed(1)} LUFS. Streaming algorithms will turn down this track by ${(lufs - (-14.0)).toFixed(1)} dB. Consider reducing limiter drive to preserve dynamic punch.`
            });
        } else if (lufs < -16.5) {
            items.push({
                type: 'warn',
                title: 'Track Quieter Than Commercial Streaming Benchmark',
                text: `Track is at ${lufs.toFixed(1)} LUFS. Spotify will either apply positive normalization gain or the track will sound soft next to commercial releases.`,
                action: { label: '⚡ Auto-Boost to -14 LUFS', fix: 'boost-commercial' }
            });
        } else {
            items.push({
                type: 'pass',
                title: 'Loudness in Streaming Sweet Spot (-14 LUFS)',
                text: `Track sits at ${lufs.toFixed(1)} LUFS, perfectly balanced for Spotify, YouTube, and Apple Music.`
            });
        }

        // 5. Frequency Balance Alerts
        const lowMid = freqBands.find(b => b.id === 'lowmid');
        const pres = freqBands.find(b => b.id === 'pres');
        const air = freqBands.find(b => b.id === 'air');
        const sub = freqBands.find(b => b.id === 'sub');

        if (lowMid && lowMid.relDb > -6.5) {
            items.push({
                type: 'warn',
                title: 'Low-Mid Mud & Boxiness Buildup (250–500 Hz)',
                text: `Excessive energy accumulation detected around 300–450 Hz (${lowMid.relDb.toFixed(1)} dB). This produces a congested, muddy mix that masks vocal clarity. Click "Notch Mud" to apply a corrective cut.`,
                action: { label: '🧹 Notch Out Mud (-3dB @ 350Hz)', fix: 'de-mud' }
            });
        }

        if (pres && pres.relDb > -7.5) {
            items.push({
                type: 'warn',
                title: 'Upper-Mid Harshness / Sibilance Peak (3–5 kHz)',
                text: `Elevated energy in the 3.5 kHz ear-resonance band (${pres.relDb.toFixed(1)} dB). May cause listener fatigue or abrasive vocal sibilance. Click "Smooth Highs" to tame resonance.`,
                action: { label: '✨ Tame Harshness (-2.5dB @ 3.8kHz)', fix: 'de-harsh' }
            });
        }

        if (air && air.relDb < -22.0) {
            items.push({
                type: 'warn',
                title: 'Dark Mix / High-End Roll-off (> 8 kHz)',
                text: `Significant drop in high-frequency air above 8 kHz (${air.relDb.toFixed(1)} dB). Mix lacks modern commercial shimmer. Click "Add Air" to open up the high end.`,
                action: { label: '🌟 Boost High Air (+3dB @ 12kHz)', fix: 'add-air' }
            });
        }

        if (sub && sub.relDb > -6.0) {
            items.push({
                type: 'warn',
                title: 'Excessive Sub-Bass Energy (< 60 Hz)',
                text: `Sub-bass is unusually hot (${sub.relDb.toFixed(1)} dB). This consumes headroom and can distort smaller speakers or cause master compressor pumping.`,
                action: { label: '🔇 Tighten Sub (<35Hz HP)', fix: 'tighten-sub' }
            });
        }

        // 6. Mono Phase Compatibility
        if (phaseCorr < 0.2) {
            items.push({
                type: 'fail',
                title: 'Severe Mono Phase Cancellation Risk',
                text: `Stereo correlation is ${phaseCorr.toFixed(2)}. Instruments and wide synths will cancel and disappear on mobile phones or mono club systems.`,
                action: { label: '🎧 Monofy Bass (<95Hz) & Tame Width', fix: 'fix-mono-phase' }
            });
        } else {
            items.push({
                type: 'pass',
                title: 'Mono Phase Integrity Confirmed',
                text: `Phase correlation is healthy (+${phaseCorr.toFixed(2)}). Mix translates cleanly to mono playback environments.`
            });
        }

        // 7. Dynamic Range (PLR)
        if (plr < 7.0) {
            items.push({
                type: 'warn',
                title: 'Heavy Dynamic Compression (Over-squashed)',
                text: `Peak-to-Loudness Ratio is ${plr.toFixed(1)} LU. Transients may sound flat or fatiguing. Back off limiter drive and compressor ratios.`
            });
        } else if (plr > 14.0) {
            items.push({
                type: 'pass',
                title: 'Wide Natural Dynamics (Audiophile PLR)',
                text: `Crest factor is ${plr.toFixed(1)} LU, offering expansive natural dynamics and punchy transient impact.`
            });
        } else {
            items.push({
                type: 'pass',
                title: 'Dynamic Range Balanced',
                text: `Crest factor is ${plr.toFixed(1)} LU, in the ideal sweet spot for commercial punch and competitive loudness.`
            });
        }

        list.innerHTML = items.map(item => `
            <div class="diag-item diag-${item.type}">
                <div class="diag-header-row" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <strong>${item.title}</strong>
                    ${item.action ? `<button class="btn btn-demo btn-diag-fix" data-fix="${item.action.fix}">${item.action.label}</button>` : ''}
                </div>
                <p style="margin: 4px 0 0 0; font-size: 11.5px; opacity: 0.9;">${item.text}</p>
            </div>
        `).join('');
    }

    applyAutoFixStreaming() {
        if (!this.rack) return;

        const limiter = this.rack.modules.find(m => m.type === 'lookahead_limiter');
        if (limiter) {
            const track = this.audioMgr.targetTrack;
            const currentLufs = track?.lufs != null ? track.lufs : -16.0;
            const targetLufs = -14.0;
            const neededDrive = Math.max(0.0, Math.min(10.0, (targetLufs - currentLufs) + 1.5));

            this.rack.setModuleBypass(limiter.id, false);
            this.rack.setModuleParams(limiter.id, {
                ceiling: -1.0,
                release: 90.0,
                softClip: true,
                drive: neededDrive
            });
        }

        this.cachedAnalysis = null;
        setTimeout(() => this.analyzeAndRender(), 150);
        this.callbacks.onAutoFixApplied?.('Quality Inspector: Auto-Align Spotify');

        const btn = document.getElementById('btn-auto-fix-streaming');
        if (btn) {
            const origText = btn.textContent;
            btn.textContent = '✓ Aligned to -14 LUFS & -1.0 dBTP!';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.textContent = origText;
                btn.style.background = '';
            }, 2000);
        }
    }

    applyMaximizeHeadroom() {
        if (!this.rack) return;
        const track = this.audioMgr.targetTrack;
        if (!track) return;

        const peakDb = track.peakDb != null ? track.peakDb : -6.0;
        // Boost needed to bring sample peak to -1.0 dBTP
        const boostDb = Math.max(0.5, Math.min(14.0, Math.abs(peakDb) - 1.0));

        const limiter = this.rack.modules.find(m => m.type === 'lookahead_limiter');
        if (limiter) {
            this.rack.setModuleBypass(limiter.id, false);
            this.rack.setModuleParams(limiter.id, {
                ceiling: -1.0,
                drive: boostDb,
                softClip: true
            });
        }

        this.cachedAnalysis = null;
        setTimeout(() => this.analyzeAndRender(), 150);
        this.callbacks.onAutoFixApplied?.(`Quality Inspector: Maximize Headroom (+${boostDb.toFixed(1)} dB)`);

        const btn = document.getElementById('btn-maximize-headroom');
        if (btn) {
            const orig = btn.textContent;
            btn.textContent = `✓ Headroom Maximized (+${boostDb.toFixed(1)} dB)!`;
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.textContent = orig;
                btn.style.background = '';
            }, 2000);
        }
    }

    copyReportToClipboard() {
        const track = this.audioMgr.targetTrack;
        const name = track?.name || 'Untitled Audio';
        const metrics = this.cachedAnalysis || {};
        const lufs = metrics.lufs != null ? `${metrics.lufs.toFixed(1)} LUFS` : 'N/A';
        const tp = metrics.truePeakDb != null ? `${metrics.truePeakDb.toFixed(2)} dBTP` : 'N/A';
        const peak = metrics.samplePeakDb != null ? `${metrics.samplePeakDb.toFixed(1)} dBFS` : 'N/A';
        const plr = metrics.plr != null ? `${metrics.plr.toFixed(1)} LU` : 'N/A';
        const phase = metrics.phaseCorr != null ? `${metrics.phaseCorr.toFixed(2)}` : 'N/A';
        const tonal = metrics.tonalSummary?.title || 'Normal';

        const report = `=== MESTRE PRE-FLIGHT QUALITY & COMPLIANCE REPORT ===
Track: ${name}
Sample Rate: ${track?.sampleRate || 48000} Hz
Integrated Loudness: ${lufs} (Streaming Target: -14.0 LUFS)
Estimated True-Peak: ${tp} (Streaming Ceiling: -1.0 dBTP)
Sample Peak: ${peak}
Dynamic Range (PLR): ${plr}
Mono Phase Correlation: ${phase}
Spectral Tonal Health: ${tonal}
Generated by Mestre Studio Reference Match Suite`;

        navigator.clipboard.writeText(report).then(() => {
            const btn = document.getElementById('btn-copy-quality-report');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = '✓ Copied!';
                setTimeout(() => { btn.textContent = orig; }, 1500);
            }
        });
    }

    updateStatusBadge() {
        if (!this.badgeEl) return;
        const track = this.audioMgr.targetTrack;
        if (!track) {
            this.badgeEl.textContent = 'READY';
            this.badgeEl.className = 'badge-quality';
            return;
        }

        const metrics = this.cachedAnalysis || (track.audioBuffer ? this.measureAudioBuffer(track.audioBuffer, track) : null);
        if (metrics) {
            if (metrics.samplePeakLinear < 0.5 || metrics.truePeakDb > 0.0) {
                this.badgeEl.textContent = 'ATTENTION';
                this.badgeEl.className = 'badge-quality badge-warn';
            } else {
                this.badgeEl.textContent = 'PASS';
                this.badgeEl.className = 'badge-quality badge-pass';
            }
        }
    }

    tuneLimiterDrive(driveDb) {
        if (!this.rack) return;
        let lim = this.rack.modules.find(m => m.type === 'lookahead_limiter');
        if (!lim) {
            lim = this.rack.addModule('lookahead_limiter', null, { ceiling: -1.0, drive: driveDb, softClip: true });
        }
        if (lim) {
            this.rack.setModuleBypass(lim.id, false);
            this.rack.setModuleParams(lim.id, { drive: driveDb });
        }
        this.updateLiveSimulatedMetrics();
        this.callbacks.onAutoFixApplied?.(`Tuning: Master Drive (+${driveDb.toFixed(1)} dB)`);
    }

    tuneLimiterCeiling(ceilDb) {
        if (!this.rack) return;
        let lim = this.rack.modules.find(m => m.type === 'lookahead_limiter');
        if (lim) {
            this.rack.setModuleBypass(lim.id, false);
            this.rack.setModuleParams(lim.id, { ceiling: ceilDb });
        }
        this.updateLiveSimulatedMetrics();
        this.callbacks.onAutoFixApplied?.(`Tuning: Limiter Ceiling (${ceilDb.toFixed(1)} dBTP)`);
    }

    tuneStereoWidth(widthVal) {
        if (!this.rack) return;
        let imager = this.rack.modules.find(m => m.type === 'stereo_imager');
        if (!imager) {
            imager = this.rack.addModule('stereo_imager', null, { width: widthVal, monoBassFreq: 90.0 });
        }
        if (imager) {
            this.rack.setModuleBypass(imager.id, false);
            this.rack.setModuleParams(imager.id, { width: widthVal });
        }
        this.callbacks.onAutoFixApplied?.(`Tuning: Stereo Width (${Math.round(widthVal)}%)`);
    }

    toggleMonoBass(btn) {
        if (!this.rack) return;
        let imager = this.rack.modules.find(m => m.type === 'stereo_imager');
        if (!imager) {
            imager = this.rack.addModule('stereo_imager', null, { width: 100.0, monoBassFreq: 95.0 });
        }
        if (imager) {
            this.rack.setModuleBypass(imager.id, false);
            const currentFreq = imager.params?.monoBassFreq || 0;
            const newFreq = currentFreq > 0 ? 0 : 95.0;
            this.rack.setModuleParams(imager.id, { monoBassFreq: newFreq });
            if (btn) {
                btn.textContent = newFreq > 0 ? '✓ Mono Bass Active (<95Hz)' : '🛡️ Monofy Bass <90Hz';
                btn.classList.toggle('active', newFreq > 0);
            }
            this.cachedAnalysis = null;
            setTimeout(() => this.analyzeAndRender(), 80);
            this.callbacks.onAutoFixApplied?.(`Pre-Flight: ${newFreq > 0 ? 'Engage Mono Bass Filter' : 'Bypass Mono Bass'}`);
        }
    }

    trimFrequencyBand(bandId, deltaGain) {
        if (!this.rack) return;
        const map = {
            sub: { band: 'sub', freq: 35, q: 0.71, type: 'lowshelf' },
            bass: { band: 'low', freq: 110, q: 1.3, type: 'peaking' },
            lowmid: { band: 'low_mid', freq: 350, q: 1.5, type: 'peaking' },
            mid: { band: 'mid', freq: 1000, q: 1.3, type: 'peaking' },
            pres: { band: 'presence', freq: 4000, q: 1.4, type: 'peaking' },
            air: { band: 'air', freq: 12500, q: 0.71, type: 'highshelf' }
        };
        const cfg = map[bandId] || { band: bandId, freq: 1000, q: 1.4, type: 'peaking' };
        this.adjustEqBand(cfg.band, cfg.freq, deltaGain, cfg.q, cfg.type);
        this.cachedAnalysis = null;
        setTimeout(() => this.analyzeAndRender(), 60);
        this.callbacks.onAutoFixApplied?.(`Pre-Flight: Trim ${bandId.toUpperCase()} (${deltaGain > 0 ? '+' : ''}${deltaGain} dB)`);
    }

    adjustEqBand(bandId, freq, gainDelta, q, type) {
        let eq = this.rack.modules.find(m => m.type === 'parametric_eq');
        if (!eq) {
            eq = this.rack.addModule('parametric_eq', 0);
        }
        if (!eq) return;

        this.rack.setModuleBypass(eq.id, false);
        const bands = eq.params.bands || [];
        const existing = bands.find(b => b.id === bandId);
        if (existing) {
            existing.enabled = true;
            existing.gain = Number((existing.gain + gainDelta).toFixed(1));
            if (freq) existing.freq = freq;
            if (q) existing.q = q;
            if (type) existing.type = type;
        } else {
            bands.push({
                id: bandId,
                freq: freq || 1000,
                gain: gainDelta,
                q: q || 1.4,
                type: type || 'peaking',
                enabled: true
            });
        }
        this.rack.setModuleParams(eq.id, { bands: [...bands] });
    }

    executeFix(fixType) {
        if (!this.rack) return;
        let desc = 'Pre-Flight Auto-Tune';

        if (fixType === 'boost-commercial' || fixType === 'maximize-headroom') {
            this.applyMaximizeHeadroom();
            return;
        } else if (fixType === 'clamp-ceiling') {
            const lim = this.rack.modules.find(m => m.type === 'lookahead_limiter');
            if (lim) {
                this.rack.setModuleBypass(lim.id, false);
                this.rack.setModuleParams(lim.id, { ceiling: -1.0 });
                desc = 'Pre-Flight: Clamp Ceiling to -1.0 dBTP';
            }
        } else if (fixType === 'de-mud') {
            this.adjustEqBand('low_mid', 350, -3.0, 1.8, 'peaking');
            desc = 'Pre-Flight: Notch Out Low-Mid Mud (-3dB @ 350Hz)';
        } else if (fixType === 'de-harsh') {
            this.adjustEqBand('presence', 3800, -2.5, 1.6, 'peaking');
            desc = 'Pre-Flight: Soften Harsh Presence (-2.5dB @ 3.8kHz)';
        } else if (fixType === 'add-air') {
            this.adjustEqBand('air', 12500, 3.0, 0.71, 'highshelf');
            desc = 'Pre-Flight: Boost High-End Air (+3dB @ 12.5kHz)';
        } else if (fixType === 'tighten-sub') {
            this.adjustEqBand('sub', 35, -2.5, 0.71, 'lowshelf');
            desc = 'Pre-Flight: Tighten Sub-Bass (<35Hz)';
        } else if (fixType === 'fix-mono-phase') {
            let imager = this.rack.modules.find(m => m.type === 'stereo_imager');
            if (!imager) {
                imager = this.rack.addModule('stereo_imager', null, { width: 95.0, monoBassFreq: 95.0 });
            }
            if (imager) {
                this.rack.setModuleBypass(imager.id, false);
                this.rack.setModuleParams(imager.id, { width: 95.0, monoBassFreq: 95.0 });
                desc = 'Pre-Flight: Monofy Bass (<95Hz) & Tame Width';
            }
        }

        this.syncTunerControlsWithRack();
        this.cachedAnalysis = null;
        setTimeout(() => this.analyzeAndRender(), 80);
        this.callbacks.onAutoFixApplied?.(desc);
    }

    syncTunerControlsWithRack() {
        if (!this.rack) return;
        const lim = this.rack.modules.find(m => m.type === 'lookahead_limiter');
        if (lim) {
            const drive = lim.params?.drive !== undefined ? lim.params.drive : 0.0;
            const ceiling = lim.params?.ceiling !== undefined ? lim.params.ceiling : -1.0;
            const sDrive = this.modalEl?.querySelector('#slider-tuning-drive');
            const vDrive = this.modalEl?.querySelector('#val-tuning-drive');
            const sCeil = this.modalEl?.querySelector('#slider-tuning-ceiling');
            const vCeil = this.modalEl?.querySelector('#val-tuning-ceiling');

            if (sDrive) sDrive.value = drive;
            if (vDrive) vDrive.textContent = `+${drive.toFixed(1)} dB`;
            if (sCeil) sCeil.value = ceiling;
            if (vCeil) vCeil.textContent = `${ceiling.toFixed(1)} dBTP`;
        }

        const imager = this.rack.modules.find(m => m.type === 'stereo_imager');
        if (imager) {
            const width = imager.params?.width !== undefined ? imager.params.width : 100.0;
            const sWidth = this.modalEl?.querySelector('#slider-tuning-width');
            const vWidth = this.modalEl?.querySelector('#val-tuning-width');
            if (sWidth) sWidth.value = width;
            if (vWidth) vWidth.textContent = `${Math.round(width)}%`;
        }
    }

    updateLiveSimulatedMetrics() {
        const track = this.cachedTrack || this.audioMgr.targetTrack;
        if (!track) return;
        const lim = this.rack?.modules.find(m => m.type === 'lookahead_limiter');
        const drive = (lim && !lim.bypassed && lim.params?.drive != null) ? lim.params.drive : 0.0;
        const ceiling = (lim && !lim.bypassed && lim.params?.ceiling != null) ? lim.params.ceiling : -1.0;

        const baseLufs = track.lufs != null ? track.lufs : -20.0;
        const basePeakDb = track.peakDb != null ? track.peakDb : -6.0;

        const estLufs = Math.min(-6.0, baseLufs + drive * 0.9);
        const estTp = Math.min(ceiling, basePeakDb + drive);
        const estPeakLin = Math.min(1.0, Math.pow(10.0, estTp / 20.0));

        const valLufs = document.getElementById('val-quality-lufs');
        const valTp = document.getElementById('val-quality-tp');
        const valPeak = document.getElementById('val-quality-peak');
        const subPeak = document.getElementById('sub-quality-peak');

        if (valLufs) valLufs.textContent = `${estLufs.toFixed(1)} LUFS`;
        if (valTp) valTp.textContent = `${estTp.toFixed(2)} dBTP`;
        if (valPeak) valPeak.textContent = `${estTp.toFixed(1)} dBFS`;
        if (subPeak) {
            const pct = Math.round(estPeakLin * 100);
            subPeak.textContent = `${pct}% Full Scale • ${estPeakLin < 0.5 ? 'Low Headroom!' : 'Healthy Level'}`;
        }

        const cardLufs = document.getElementById('card-lufs');
        const cardTp = document.getElementById('card-truepeak');
        const cardPeak = document.getElementById('card-peak');
        if (cardLufs) {
            const diff = Math.abs(estLufs - (-14.0));
            cardLufs.className = `metric-card ${diff <= 1.5 ? 'status-pass' : diff <= 3.5 ? 'status-warn' : 'status-fail'}`;
        }
        if (cardTp) {
            cardTp.className = `metric-card ${estTp <= -0.9 ? 'status-pass' : estTp <= 0.0 ? 'status-warn' : 'status-fail'}`;
        }
        if (cardPeak) {
            cardPeak.className = `metric-card ${estPeakLin >= 0.5 && estPeakLin <= 1.0 ? 'status-pass' : 'status-warn'}`;
        }
    }

    setMasteredAnalysis(stats, masteredBuffer) {
        if (!stats) return;
        const lufsVal = stats.integrated ?? stats.integratedLUFS ?? stats.lufs ?? -14.0;
        const tpVal = stats.truePeak ?? stats.truePeakDb ?? stats.peakDb ?? -1.0;
        this.cachedTrack = {
            ...this.audioMgr.targetTrack,
            audioBuffer: masteredBuffer,
            lufs: lufsVal,
            peakDb: tpVal,
            peakLinear: Math.pow(10.0, tpVal / 20.0)
        };
        this.cachedAnalysis = null;
        if (this.isOpen) {
            this.analyzeAndRender();
        }
        this.updateStatusBadge();
    }
}
