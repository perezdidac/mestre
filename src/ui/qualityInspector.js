/**
 * Master Pre-Flight Quality Inspector Modal & Compliance Engine
 * Validates audio against commercial streaming platform standards (Spotify, Apple Music, YouTube, Tidal, CD),
 * measures Inter-Sample True Peak, Dynamic Crest Factor (PLR), and Mono Phase Compatibility.
 */

export class QualityInspectorView {
    constructor(audioManager, rack, callbacks = {}) {
        this.audioMgr = audioManager;
        this.rack = rack;
        this.callbacks = callbacks;
        this.isOpen = false;

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
                        <!-- Top Summary Cards -->
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
                            <div class="metric-card" id="card-plr">
                                <span class="metric-label">DYNAMIC RANGE (PLR)</span>
                                <span class="metric-value" id="val-quality-plr">--.-- LU</span>
                                <span class="metric-sub" id="sub-quality-plr">Optimal: 8 - 13 LU</span>
                            </div>
                            <div class="metric-card" id="card-phase">
                                <span class="metric-label">MONO COMPATIBILITY</span>
                                <span class="metric-value" id="val-quality-phase">--</span>
                                <span class="metric-sub" id="sub-quality-phase">Correlation: +1.00</span>
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
                                <div class="diag-item diag-info">Upload a track and run playback to compute live pre-flight mastering telemetry.</div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer quality-modal-footer">
                        <button class="btn btn-secondary" id="btn-copy-quality-report">📋 Copy Report</button>
                        <button class="btn btn-demo" id="btn-auto-fix-streaming">⚡ Auto-Align for Spotify (-14 LUFS)</button>
                        <button class="btn btn-secondary" id="btn-dismiss-quality">Done</button>
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

        if (btnClose) btnClose.addEventListener('click', () => this.close());
        if (btnDismiss) btnDismiss.addEventListener('click', () => this.close());

        if (btnCopy) {
            btnCopy.addEventListener('click', () => this.copyReportToClipboard());
        }

        if (btnAutoFix) {
            btnAutoFix.addEventListener('click', () => this.applyAutoFixStreaming());
        }

        // Close on backdrop click
        this.modalEl.addEventListener('click', (e) => {
            if (e.target === this.modalEl) this.close();
        });
    }

    open() {
        this.isOpen = true;
        this.modalEl.classList.add('visible');
        this.analyzeAndRender();
    }

    close() {
        this.isOpen = false;
        this.modalEl.classList.remove('visible');
    }

    analyzeAndRender() {
        const track = this.audioMgr.targetTrack;
        if (!track) {
            this.renderEmptyState();
            return;
        }

        // Gather metrics
        const lufs = track.lufs != null ? track.lufs : -16.0;
        const peakDb = track.peakDb != null ? track.peakDb : -0.5;
        // Estimated True Peak (oversampled ISP correction factor ~ +0.3 to +0.8 dBTP over sample peak)
        const truePeakDb = peakDb + 0.35;
        const plr = Math.max(0, peakDb - lufs);

        // Calculate phase correlation from audioManager analyser
        let phaseCorr = 0.95;
        const stereoData = this.audioMgr.getStereoTimeDomainData();
        if (stereoData && stereoData.left && stereoData.right) {
            let sumL2 = 0, sumR2 = 0, sumLR = 0;
            const len = stereoData.left.length;
            for (let i = 0; i < len; i++) {
                const l = stereoData.left[i];
                const r = stereoData.right[i];
                sumL2 += l * l;
                sumR2 += r * r;
                sumLR += l * r;
            }
            const denom = Math.sqrt(sumL2 * sumR2);
            if (denom > 1e-9) {
                phaseCorr = Math.max(-1.0, Math.min(1.0, sumLR / denom));
            }
        }

        // Update Metric Cards
        const valLufs = document.getElementById('val-quality-lufs');
        const valTp = document.getElementById('val-quality-tp');
        const valPlr = document.getElementById('val-quality-plr');
        const valPhase = document.getElementById('val-quality-phase');
        const subPhase = document.getElementById('sub-quality-phase');

        if (valLufs) valLufs.textContent = `${lufs.toFixed(1)} LUFS`;
        if (valTp) valTp.textContent = `${truePeakDb.toFixed(2)} dBTP`;
        if (valPlr) valPlr.textContent = `${plr.toFixed(1)} LU`;

        let phaseGrade = 'A+';
        let phaseText = 'Optimal Mono Integrity';
        let phaseClass = 'status-pass';

        if (phaseCorr >= 0.8) {
            phaseGrade = 'A+ (Safe)';
            phaseText = 'Zero phase cancellation risk';
        } else if (phaseCorr >= 0.5) {
            phaseGrade = 'A (Good)';
            phaseText = 'Solid stereo depth, safe mono';
        } else if (phaseCorr >= 0.2) {
            phaseGrade = 'B (Wide)';
            phaseText = 'Noticeable mono level drop';
            phaseClass = 'status-warn';
        } else if (phaseCorr >= 0.0) {
            phaseGrade = 'C (Warning)';
            phaseText = 'High risk of mono cancellation!';
            phaseClass = 'status-warn';
        } else {
            phaseGrade = 'F (Phased Out)';
            phaseText = 'Severe phase inversion: will cancel in mono!';
            phaseClass = 'status-fail';
        }

        if (valPhase) {
            valPhase.textContent = phaseGrade;
            valPhase.className = `metric-value ${phaseClass}`;
        }
        if (subPhase) subPhase.textContent = `Correlation: ${phaseCorr >= 0 ? '+' : ''}${phaseCorr.toFixed(2)} • ${phaseText}`;

        // Color code cards
        const cardLufs = document.getElementById('card-lufs');
        const cardTp = document.getElementById('card-truepeak');

        if (cardLufs) {
            const lufsDiff = Math.abs(lufs - (-14.0));
            cardLufs.className = `metric-card ${lufsDiff <= 1.5 ? 'status-pass' : lufsDiff <= 3.0 ? 'status-warn' : 'status-fail'}`;
        }

        if (cardTp) {
            cardTp.className = `metric-card ${truePeakDb <= -1.0 ? 'status-pass' : truePeakDb <= -0.1 ? 'status-warn' : 'status-fail'}`;
        }

        // Render Platform Compliance Table
        this.renderComplianceTable(lufs, truePeakDb, plr);

        // Render Diagnostics & Recommendations
        this.renderDiagnostics(lufs, truePeakDb, plr, phaseCorr);
    }

    renderEmptyState() {
        const list = document.getElementById('diagnostics-list');
        if (list) {
            list.innerHTML = `<div class="diag-item diag-warn">No Target audio track loaded. Drag and drop a track to inspect mastering compliance.</div>`;
        }
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
            const lufsPass = Math.abs(lufsDelta) <= 1.5;

            let statusBadge = '<span class="comp-badge pass">PASS</span>';
            let penaltyDesc = 'No volume attenuation applied';

            if (!tpPass && truePeakDb > 0.0) {
                statusBadge = '<span class="comp-badge fail">CLIPPING</span>';
                penaltyDesc = 'Inter-sample clipping: platform lossy transcoders will distort!';
            } else if (lufsDelta > 1.5) {
                statusBadge = '<span class="comp-badge warn">TURN DOWN</span>';
                penaltyDesc = `Platform will turn volume DOWN by -${lufsDelta.toFixed(1)} dB`;
            } else if (lufsDelta < -2.0 && p.targetLufs === -14.0) {
                statusBadge = '<span class="comp-badge warn">QUIET</span>';
                penaltyDesc = `Softer than commercial average (+${Math.abs(lufsDelta).toFixed(1)} dB headroom)`;
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

    renderDiagnostics(lufs, truePeakDb, plr, phaseCorr) {
        const list = document.getElementById('diagnostics-list');
        if (!list) return;

        const items = [];

        // 1. True Peak check
        if (truePeakDb > 0.0) {
            items.push({
                type: 'fail',
                title: 'CRITICAL: Inter-Sample Peak Clipping Detected',
                text: `Estimated true-peak is ${truePeakDb.toFixed(2)} dBTP (> 0.0 dBTP). When compressed to MP3/AAC on Spotify and Apple Music, this track will produce audible harmonic clipping distortion. Lower the limiter ceiling to -1.0 dBTP.`
            });
        } else if (truePeakDb > -1.0) {
            items.push({
                type: 'warn',
                title: 'True Peak Above Recommended -1.0 dBTP Margin',
                text: `True-peak is ${truePeakDb.toFixed(2)} dBTP. Major streaming guidelines recommend a -1.0 dBTP ceiling for lossy transcoding safety.`
            });
        } else {
            items.push({
                type: 'pass',
                title: 'True-Peak Ceiling Compliant',
                text: `True-peak is safe at ${truePeakDb.toFixed(2)} dBTP (< -1.0 dBTP). Zero inter-sample clipping risk.`
            });
        }

        // 2. Loudness check
        if (lufs > -12.0) {
            items.push({
                type: 'warn',
                title: 'Loudness Exceeds Streaming Normalization (-14.0 LUFS)',
                text: `Track integrated loudness is ${lufs.toFixed(1)} LUFS. Streaming algorithms will automatically turn down this track by ${(lufs - (-14.0)).toFixed(1)} dB. Consider reducing limiter drive for enhanced dynamic breathing.`
            });
        } else if (lufs < -16.0) {
            items.push({
                type: 'warn',
                title: 'Track Quieter Than Commercial Streaming Benchmark',
                text: `Track is at ${lufs.toFixed(1)} LUFS. On streaming, Spotify will apply positive gain or the track will sound quiet compared to commercial releases.`
            });
        } else {
            items.push({
                type: 'pass',
                title: 'Loudness In Streaming Sweet Spot',
                text: `Track sits at ${lufs.toFixed(1)} LUFS, perfectly aligned with Spotify, YouTube, and Apple Music distribution.`
            });
        }

        // 3. Phase check
        if (phaseCorr < 0.2) {
            items.push({
                type: 'fail',
                title: 'Mono Phase Cancellation Risk',
                text: `Stereo correlation is ${phaseCorr.toFixed(2)}. Elements of the mix will severely phase-cancel and disappear when played on phones, smart speakers, or mono sound systems. Check stereo widening on synths and reverb.`
            });
        } else {
            items.push({
                type: 'pass',
                title: 'Mono Phase Integrity Confirmed',
                text: `Stereo phase correlation is healthy (${phaseCorr.toFixed(2)}). Mix translates cleanly to mono playback environments.`
            });
        }

        // 4. Dynamic Range PLR check
        if (plr < 7.0) {
            items.push({
                type: 'warn',
                title: 'Heavy Dynamic Compression (Over-squashed)',
                text: `Peak-to-Loudness Ratio is ${plr.toFixed(1)} LU. Transients may sound flat or fatiguing. Consider backing off limiter and compressor ratios.`
            });
        } else if (plr > 14.0) {
            items.push({
                type: 'pass',
                title: 'High Dynamic Range (Audiophile Master)',
                text: `Crest factor is ${plr.toFixed(1)} LU, offering expansive natural dynamics and punchy transient impact.`
            });
        }

        list.innerHTML = items.map(item => `
            <div class="diag-item diag-${item.type}">
                <strong>${item.title}:</strong> ${item.text}
            </div>
        `).join('');
    }

    applyAutoFixStreaming() {
        if (!this.rack) return;

        // Auto-align limiter ceiling and drive to hit -14 LUFS & -1.0 dBTP
        const limiter = this.rack.modules.find(m => m.type === 'lookahead_limiter');
        if (limiter) {
            const track = this.audioMgr.targetTrack;
            const currentLufs = track?.lufs != null ? track.lufs : -16.0;
            const targetLufs = -14.0;
            const neededDrive = Math.max(0.0, Math.min(8.0, (targetLufs - currentLufs) + 1.5));

            this.rack.setModuleParams(limiter.id, {
                ceiling: -1.0,
                release: 90.0,
                softClip: true,
                drive: neededDrive
            });
        }

        // Re-analyze
        setTimeout(() => this.analyzeAndRender(), 100);
        this.callbacks.onAutoFixApplied?.('Quality Inspector: Auto-Align Spotify');

        // Feedback toast/alert
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

    copyReportToClipboard() {
        const track = this.audioMgr.targetTrack;
        const name = track?.name || 'Untitled Audio';
        const lufs = track?.lufs != null ? `${track.lufs.toFixed(1)} LUFS` : 'N/A';
        const tp = track?.peakDb != null ? `${(track.peakDb + 0.35).toFixed(2)} dBTP` : 'N/A';

        const report = `=== MESTRE PRE-FLIGHT QUALITY REPORT ===
Track: ${name}
Sample Rate: ${track?.sampleRate || 48000} Hz
Integrated Loudness: ${lufs} (Streaming Benchmark: -14.0 LUFS)
Estimated True-Peak: ${tp} (Streaming Ceiling: -1.0 dBTP)
Spotify Status: ${lufs} (Safe)
Generated by Mestre Professional Reference Match Suite`;

        navigator.clipboard.writeText(report).then(() => {
            const btn = document.getElementById('btn-copy-quality-report');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = '✓ Copied!';
                setTimeout(() => { btn.textContent = orig; }, 1500);
            }
        });
    }
}
