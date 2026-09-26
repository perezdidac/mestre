/**
 * Mastering Transport & Parameter Control Panel
 * Handles Transport (Play/Pause/Stop/Loop/Bypass), A/B switching,
 * Match Amount slider, Dynamics controls, and Export modal.
 */

export class TransportControls {
    constructor(callbacks = {}) {
        this.callbacks = {
            onPlay: () => {},
            onPause: () => {},
            onStop: () => {},
            onLoopToggle: () => {},
            onBypassToggle: () => {},
            onMonitorChange: () => {},
            onMatchReference: () => {},
            onMatchAmountChange: () => {},
            onSmoothingChange: () => {},
            onInputGainChange: () => {},
            onOutputGainChange: () => {},
            onCompressorChange: () => {},
            onLimiterChange: () => {},
            onExportMaster: () => {},
            onLoadDemo: () => {},
            ...callbacks
        };

        this.cacheElements();
        this.setupListeners();
    }

    cacheElements() {
        this.btnPlay = document.getElementById('btn-play');
        this.btnPause = document.getElementById('btn-pause');
        this.btnStop = document.getElementById('btn-stop');
        this.btnLoop = document.getElementById('btn-loop');
        this.btnBypass = document.getElementById('btn-bypass');
        this.timecodeDisplay = document.getElementById('timecode-display');

        // A/B Buttons
        this.btnMonitorMastered = document.getElementById('btn-mon-mastered');
        this.btnMonitorTarget = document.getElementById('btn-mon-target');
        this.btnMonitorRef = document.getElementById('btn-mon-ref');

        // Hero Match Action
        this.btnMatchAction = document.getElementById('btn-match-action');
        this.btnLoadDemo = document.getElementById('btn-load-demo');

        // Sliders
        this.sliderMatchAmount = document.getElementById('slider-match-amount');
        this.valMatchAmount = document.getElementById('val-match-amount');

        this.sliderSmoothing = document.getElementById('slider-smoothing');
        this.valSmoothing = document.getElementById('val-smoothing');

        this.sliderInputGain = document.getElementById('slider-input-gain');
        this.valInputGain = document.getElementById('val-input-gain');

        this.sliderCompThresh = document.getElementById('slider-comp-thresh');
        this.valCompThresh = document.getElementById('val-comp-thresh');

        this.sliderCompRatio = document.getElementById('slider-comp-ratio');
        this.valCompRatio = document.getElementById('val-comp-ratio');

        this.sliderLimiterCeil = document.getElementById('slider-limiter-ceil');
        this.valLimiterCeil = document.getElementById('val-limiter-ceil');

        // Export Modal & Button
        this.btnExport = document.getElementById('btn-export-master');
        this.exportModal = document.getElementById('export-modal');
        this.btnConfirmExport = document.getElementById('btn-confirm-export');
        this.btnCloseExport = document.getElementById('btn-close-export');
        this.selectBitDepth = document.getElementById('select-bit-depth');
        this.checkDither = document.getElementById('check-dither');
    }

    setupListeners() {
        if (this.btnPlay) {
            this.btnPlay.addEventListener('click', () => this.callbacks.onPlay());
        }
        if (this.btnPause) {
            this.btnPause.addEventListener('click', () => this.callbacks.onPause());
        }
        if (this.btnStop) {
            this.btnStop.addEventListener('click', () => this.callbacks.onStop());
        }
        if (this.btnLoop) {
            this.btnLoop.addEventListener('click', () => {
                const isActive = this.btnLoop.classList.toggle('active');
                this.callbacks.onLoopToggle(isActive);
            });
        }
        if (this.btnBypass) {
            this.btnBypass.addEventListener('click', () => {
                const isBypassed = this.btnBypass.classList.toggle('active');
                this.callbacks.onBypassToggle(isBypassed);
            });
        }

        // A/B Monitoring switcher
        const setMon = (mode) => {
            [this.btnMonitorMastered, this.btnMonitorTarget, this.btnMonitorRef].forEach(b => {
                if (b) b.classList.remove('active');
            });
            if (mode === 'mastered' && this.btnMonitorMastered) this.btnMonitorMastered.classList.add('active');
            if (mode === 'target_dry' && this.btnMonitorTarget) this.btnMonitorTarget.classList.add('active');
            if (mode === 'reference' && this.btnMonitorRef) this.btnMonitorRef.classList.add('active');
            this.callbacks.onMonitorChange(mode);
        };

        if (this.btnMonitorMastered) this.btnMonitorMastered.addEventListener('click', () => setMon('mastered'));
        if (this.btnMonitorTarget) this.btnMonitorTarget.addEventListener('click', () => setMon('target_dry'));
        if (this.btnMonitorRef) this.btnMonitorRef.addEventListener('click', () => setMon('reference'));

        // Hero Match Reference Button
        if (this.btnMatchAction) {
            this.btnMatchAction.addEventListener('click', () => {
                this.callbacks.onMatchReference();
            });
        }

        // Demo Loader Button
        if (this.btnLoadDemo) {
            this.btnLoadDemo.addEventListener('click', () => {
                this.callbacks.onLoadDemo();
            });
        }

        // Parameter Sliders
        if (this.sliderMatchAmount) {
            this.sliderMatchAmount.addEventListener('input', (e) => {
                const pct = parseInt(e.target.value, 10);
                this.valMatchAmount.textContent = `${pct}%`;
                this.callbacks.onMatchAmountChange(pct / 100);
            });
        }

        if (this.sliderSmoothing) {
            this.sliderSmoothing.addEventListener('input', (e) => {
                const pct = parseInt(e.target.value, 10);
                this.valSmoothing.textContent = `${pct}%`;
                this.callbacks.onSmoothingChange(pct / 100);
            });
        }

        if (this.sliderInputGain) {
            this.sliderInputGain.addEventListener('input', (e) => {
                const db = parseFloat(e.target.value);
                this.valInputGain.textContent = `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
                this.callbacks.onInputGainChange(db);
            });
        }

        if (this.sliderCompThresh) {
            this.sliderCompThresh.addEventListener('input', (e) => {
                const db = parseFloat(e.target.value);
                this.valCompThresh.textContent = `${db.toFixed(1)} dB`;
                this.triggerDynamicsUpdate();
            });
        }

        if (this.sliderCompRatio) {
            this.sliderCompRatio.addEventListener('input', (e) => {
                const ratio = parseFloat(e.target.value);
                this.valCompRatio.textContent = `${ratio.toFixed(1)}:1`;
                this.triggerDynamicsUpdate();
            });
        }

        if (this.sliderLimiterCeil) {
            this.sliderLimiterCeil.addEventListener('input', (e) => {
                const db = parseFloat(e.target.value);
                this.valLimiterCeil.textContent = `${db.toFixed(1)} dB`;
                this.callbacks.onLimiterChange(db);
            });
        }

        // Export Modal
        if (this.btnExport) {
            this.btnExport.addEventListener('click', () => {
                if (this.exportModal) this.exportModal.classList.add('visible');
            });
        }

        const cancelBtn = document.getElementById('btn-cancel-export');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (this.exportModal) this.exportModal.classList.remove('visible');
            });
        }

        if (this.btnCloseExport) {
            this.btnCloseExport.addEventListener('click', () => {
                if (this.exportModal) this.exportModal.classList.remove('visible');
            });
        }

        if (this.btnConfirmExport) {
            this.btnConfirmExport.addEventListener('click', () => {
                const bitDepth = parseInt(this.selectBitDepth.value, 10) || 24;
                const dither = this.checkDither ? this.checkDither.checked : true;
                this.callbacks.onExportMaster(bitDepth, dither);
            });
        }

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Ignore if typing in text inputs
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (this.btnPlay && this.btnPlay.style.display !== 'none') {
                    this.callbacks.onPlay();
                } else {
                    this.callbacks.onPause();
                }
            } else if (e.key === 'l' || e.key === 'L') {
                if (this.btnLoop) this.btnLoop.click();
            } else if (e.key === 'b' || e.key === 'B') {
                if (this.btnBypass) this.btnBypass.click();
            } else if (e.key === '1') {
                setMon('mastered');
            } else if (e.key === '2') {
                setMon('target_dry');
            } else if (e.key === '3') {
                setMon('reference');
            } else if (e.key === 'Escape') {
                if (this.exportModal) this.exportModal.classList.remove('visible');
            }
        });
    }

    triggerDynamicsUpdate() {
        const thresh = parseFloat(this.sliderCompThresh.value);
        const ratio = parseFloat(this.sliderCompRatio.value);
        this.callbacks.onCompressorChange(thresh, ratio);
    }

    updatePlaybackState(state) {
        if (this.btnPlay && this.btnPause) {
            if (state.isPlaying) {
                this.btnPlay.style.display = 'none';
                this.btnPause.style.display = 'inline-flex';
            } else {
                this.btnPlay.style.display = 'inline-flex';
                this.btnPause.style.display = 'none';
            }
        }

        if (this.btnLoop) {
            this.btnLoop.classList.toggle('active', !!state.isLooping);
        }

        if (this.btnBypass) {
            this.btnBypass.classList.toggle('active', !!state.isBypassed);
        }
    }

    updateTimecode(currentSec, totalSec) {
        if (!this.timecodeDisplay) return;
        const curM = Math.floor(currentSec / 60);
        const curS = Math.floor(currentSec % 60).toString().padStart(2, '0');
        const curMs = Math.floor((currentSec % 1) * 100).toString().padStart(2, '0');

        const totM = Math.floor(totalSec / 60);
        const totS = Math.floor(totalSec % 60).toString().padStart(2, '0');

        this.timecodeDisplay.textContent = `${curM}:${curS}.${curMs} / ${totM}:${totS}`;
    }

    snapSlidersToMatchedValues(params) {
        if (params.matchAmount !== undefined && this.sliderMatchAmount) {
            const pct = Math.round(params.matchAmount * 100);
            this.sliderMatchAmount.value = pct;
            this.valMatchAmount.textContent = `${pct}%`;
        }

        if (params.compThresholdDb !== undefined && this.sliderCompThresh) {
            this.sliderCompThresh.value = params.compThresholdDb;
            this.valCompThresh.textContent = `${params.compThresholdDb.toFixed(1)} dB`;
        }

        if (params.compRatio !== undefined && this.sliderCompRatio) {
            this.sliderCompRatio.value = params.compRatio;
            this.valCompRatio.textContent = `${params.compRatio.toFixed(1)}:1`;
        }

        if (params.limiterCeilingDb !== undefined && this.sliderLimiterCeil) {
            this.sliderLimiterCeil.value = params.limiterCeilingDb;
            this.valLimiterCeil.textContent = `${params.limiterCeilingDb.toFixed(1)} dB`;
        }

        if (params.inputGainDb !== undefined && this.sliderInputGain) {
            this.sliderInputGain.value = params.inputGainDb;
            this.valInputGain.textContent = `${params.inputGainDb > 0 ? '+' : ''}${params.inputGainDb.toFixed(1)} dB`;
        }
    }
}
