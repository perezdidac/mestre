/**
 * Precision Mastering Meter Bridge
 * Renders Integrated, Short-Term, Momentary LUFS, True-Peak dBTP,
 * Dynamic Range score, and real-time Compressor & Limiter Gain Reduction ladders.
 */

export class MetersView {
    constructor(containerElement) {
        this.container = containerElement;
        this.renderDom();
        this.cacheElements();

        this.compGrDb = 0;
        this.limGrDb = 0;
        this.peakHoldDb = -60;
        this.peakHoldTimer = null;
    }

    renderDom() {
        this.container.innerHTML = `
            <div class="meter-bridge-grid">
                <!-- Target Track Metrics -->
                <div class="meter-card" id="meter-card-target">
                    <div class="meter-card-header">
                        <span class="meter-tag target-tag">TARGET</span>
                        <span class="meter-title">Input Dynamics</span>
                    </div>
                    <div class="meter-stats">
                        <div class="stat-item">
                            <span class="stat-label">INTEGRATED</span>
                            <span class="stat-val" id="target-lufs-val">-- LUFS</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">TRUE PEAK</span>
                            <span class="stat-val" id="target-peak-val">-- dB</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">DYN RANGE</span>
                            <span class="stat-val" id="target-dr-val">-- DR</span>
                        </div>
                    </div>
                    <div class="meter-bar-container">
                        <div class="meter-bar-track">
                            <div class="meter-bar-fill" id="target-lufs-bar" style="width: 0%"></div>
                            <div class="target-marker" style="left: 65%" title="Streaming Standard -14 LUFS"></div>
                        </div>
                        <div class="meter-scale-labels">
                            <span>-36</span><span>-24</span><span>-14</span><span>-9</span><span>0</span>
                        </div>
                    </div>
                </div>

                <!-- Reference Track Metrics -->
                <div class="meter-card" id="meter-card-ref">
                    <div class="meter-card-header">
                        <span class="meter-tag ref-tag">REFERENCE</span>
                        <span class="meter-title">Target Profile</span>
                    </div>
                    <div class="meter-stats">
                        <div class="stat-item">
                            <span class="stat-label">INTEGRATED</span>
                            <span class="stat-val" id="ref-lufs-val">-- LUFS</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">TRUE PEAK</span>
                            <span class="stat-val" id="ref-peak-val">-- dB</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">DYN RANGE</span>
                            <span class="stat-val" id="ref-dr-val">-- DR</span>
                        </div>
                    </div>
                    <div class="meter-bar-container">
                        <div class="meter-bar-track">
                            <div class="meter-bar-fill ref-fill" id="ref-lufs-bar" style="width: 0%"></div>
                            <div class="target-marker" style="left: 65%" title="Streaming Standard -14 LUFS"></div>
                        </div>
                        <div class="meter-scale-labels">
                            <span>-36</span><span>-24</span><span>-14</span><span>-9</span><span>0</span>
                        </div>
                    </div>
                </div>

                <!-- Live Mastered Metrics -->
                <div class="meter-card" id="meter-card-mastered">
                    <div class="meter-card-header">
                        <span class="meter-tag master-tag">MASTERED</span>
                        <span class="meter-title">Active Output</span>
                        <div class="clip-led" id="clip-led" title="True Peak Clip Indicator">CLIP</div>
                    </div>
                    <div class="meter-stats">
                        <div class="stat-item">
                            <span class="stat-label">INTEGRATED</span>
                            <span class="stat-val highlight" id="master-lufs-val">-- LUFS</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">SHORT-TERM</span>
                            <span class="stat-val" id="master-st-val">-- LUFS</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">TRUE PEAK</span>
                            <span class="stat-val" id="master-peak-val">-- dB</span>
                        </div>
                    </div>
                    <div class="meter-bar-container">
                        <div class="meter-bar-track">
                            <div class="meter-bar-fill master-fill" id="master-lufs-bar" style="width: 0%"></div>
                            <div class="meter-peak-hold" id="master-peak-hold" style="left: 0%"></div>
                            <div class="target-marker" style="left: 65%"></div>
                        </div>
                        <div class="meter-scale-labels">
                            <span>-36</span><span>-24</span><span>-14</span><span>-9</span><span>0</span>
                        </div>
                    </div>
                </div>

                <!-- Gain Reduction Ladders (Compressor & Limiter) -->
                <div class="meter-card gr-card" id="meter-card-gr">
                    <div class="meter-card-header">
                        <span class="meter-tag gr-tag">DYNAMICS GR</span>
                        <span class="meter-title">DSP Attenuation</span>
                    </div>
                    <div class="gr-meters-flex">
                        <!-- Compressor GR -->
                        <div class="gr-column">
                            <div class="gr-column-label">COMPRESSOR</div>
                            <div class="gr-bar-track">
                                <div class="gr-bar-fill comp-fill" id="comp-gr-fill" style="height: 0%"></div>
                            </div>
                            <div class="gr-value" id="comp-gr-val">0.0 dB</div>
                        </div>

                        <!-- Limiter GR -->
                        <div class="gr-column">
                            <div class="gr-column-label">LIMITER</div>
                            <div class="gr-bar-track">
                                <div class="gr-bar-fill lim-fill" id="lim-gr-fill" style="height: 0%"></div>
                            </div>
                            <div class="gr-value" id="lim-gr-val">0.0 dB</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.targetLufsVal = document.getElementById('target-lufs-val');
        this.targetPeakVal = document.getElementById('target-peak-val');
        this.targetDrVal = document.getElementById('target-dr-val');
        this.targetLufsBar = document.getElementById('target-lufs-bar');

        this.refLufsVal = document.getElementById('ref-lufs-val');
        this.refPeakVal = document.getElementById('ref-peak-val');
        this.refDrVal = document.getElementById('ref-dr-val');
        this.refLufsBar = document.getElementById('ref-lufs-bar');

        this.masterLufsVal = document.getElementById('master-lufs-val');
        this.masterStVal = document.getElementById('master-st-val');
        this.masterPeakVal = document.getElementById('master-peak-val');
        this.masterLufsBar = document.getElementById('master-lufs-bar');
        this.masterPeakHold = document.getElementById('master-peak-hold');
        this.clipLed = document.getElementById('clip-led');

        this.compGrFill = document.getElementById('comp-gr-fill');
        this.compGrVal = document.getElementById('comp-gr-val');
        this.limGrFill = document.getElementById('lim-gr-fill');
        this.limGrVal = document.getElementById('lim-gr-val');
    }

    lufsToPercent(lufs) {
        // Maps -48 LUFS (0%) to 0 LUFS (100%)
        const clamped = Math.max(-48, Math.min(0, lufs));
        return ((clamped - -48) / 48) * 100;
    }

    setTargetMetrics(stats) {
        if (!stats) return;
        this.targetLufsVal.textContent = `${stats.integratedLUFS.toFixed(1)}\u00A0LUFS`;
        this.targetPeakVal.textContent = `${stats.peakDb.toFixed(1)}\u00A0dB`;
        this.targetDrVal.textContent = `DR\u00A0${Math.round(stats.dynamicRangeDb)}`;
        this.targetLufsBar.style.width = `${this.lufsToPercent(stats.integratedLUFS)}%`;
    }

    setReferenceMetrics(stats) {
        if (!stats) return;
        this.refLufsVal.textContent = `${stats.integratedLUFS.toFixed(1)}\u00A0LUFS`;
        this.refPeakVal.textContent = `${stats.peakDb.toFixed(1)}\u00A0dB`;
        this.refDrVal.textContent = `DR\u00A0${Math.round(stats.dynamicRangeDb)}`;
        this.refLufsBar.style.width = `${this.lufsToPercent(stats.integratedLUFS)}%`;
    }

    setMasteredMetrics(stats) {
        if (!stats) return;
        this.masterLufsVal.textContent = `${stats.integratedLUFS.toFixed(1)}\u00A0LUFS`;
        this.masterPeakVal.textContent = `${stats.peakDb.toFixed(1)}\u00A0dB`;
        this.masterLufsBar.style.width = `${this.lufsToPercent(stats.integratedLUFS)}%`;

        if (stats.peakDb >= -0.1) {
            this.triggerClip();
        }
    }

    updateRealtimeMasterTelemetry(compGR, limGR, peakDb = -12, stLufs = -14) {
        // Compressor GR (0 to 12 dB scale)
        const compPct = Math.min(100, (compGR / 12) * 100);
        this.compGrFill.style.height = `${compPct}%`;
        this.compGrVal.textContent = `${compGR > 0.05 ? '-' : ''}${compGR.toFixed(1)}\u00A0dB`;

        // Limiter GR (0 to 8 dB scale)
        const limPct = Math.min(100, (limGR / 8) * 100);
        this.limGrFill.style.height = `${limPct}%`;
        this.limGrVal.textContent = `${limGR > 0.05 ? '-' : ''}${limGR.toFixed(1)}\u00A0dB`;

        // Peak Hold
        if (peakDb > this.peakHoldDb) {
            this.peakHoldDb = peakDb;
            clearTimeout(this.peakHoldTimer);
            this.peakHoldTimer = setTimeout(() => {
                this.peakHoldDb = -60;
            }, 1500);
        }

        const holdPct = this.lufsToPercent(this.peakHoldDb);
        this.masterPeakHold.style.left = `${holdPct}%`;

        if (peakDb >= -0.1) {
            this.triggerClip();
        }
    }

    triggerClip() {
        this.clipLed.classList.add('active');
        clearTimeout(this.clipTimer);
        this.clipTimer = setTimeout(() => {
            this.clipLed.classList.remove('active');
        }, 1200);
    }
}
