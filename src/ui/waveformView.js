/**
 * High-DPI Waveform Canvas Visualizer
 * Renders min/max peaks, RMS envelope, scrub cursor, and interactive loop region.
 */

export class WaveformView {
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.options = {
            waveColor: options.waveColor || '#00f0ff',
            rmsColor: options.rmsColor || 'rgba(0, 240, 255, 0.45)',
            progressColor: options.progressColor || 'rgba(0, 240, 255, 0.25)',
            playheadColor: options.playheadColor || '#ffffff',
            loopColor: options.loopColor || 'rgba(255, 215, 0, 0.2)',
            ...options
        };

        this.peaks = null;
        this.originalPeaks = null;
        this.masteredPeaks = null;
        this.masteredStats = null;
        this.displayMode = 'original'; // 'original' | 'mastered' | 'comparison'
        this.duration = 0;
        this.currentTime = 0;
        this.loopStart = 0;
        this.loopEnd = 0;
        this.isLooping = false;

        this.onSeekCallback = null;
        this.onLoopRangeCallback = null;

        this.isDraggingSeek = false;
        this.setupEventListeners();
        this.resize();
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);
        this.ctx.scale(dpr, dpr);
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
        this.draw();
    }

    setTrackData(track) {
        if (!track) {
            this.peaks = null;
            this.originalPeaks = null;
            this.masteredPeaks = null;
            this.masteredStats = null;
            this.duration = 0;
            this.draw();
            return;
        }
        this.originalPeaks = track.waveformPeaks;
        this.peaks = this.displayMode === 'mastered' && this.masteredPeaks ? this.masteredPeaks : this.originalPeaks;
        this.duration = track.duration;
        this.loopEnd = track.duration;
        this.draw();
    }

    setMasteredPeaks(peaks, stats = null) {
        this.masteredPeaks = peaks;
        this.masteredStats = stats;
        this.peaks = peaks;
        this.displayMode = 'mastered';
        this.draw();
    }

    setDisplayMode(mode) {
        this.displayMode = mode;
        if (mode === 'original') {
            this.peaks = this.originalPeaks;
        } else if (mode === 'mastered') {
            this.peaks = this.masteredPeaks || this.originalPeaks;
        } else if (mode === 'comparison') {
            this.peaks = this.masteredPeaks || this.originalPeaks;
        }
        this.draw();
    }

    setTime(currentTime) {
        this.currentTime = currentTime;
        this.draw();
    }

    setLoopRegion(start, end, isLooping = true) {
        this.loopStart = start;
        this.loopEnd = end;
        this.isLooping = isLooping;
        this.draw();
    }

    onSeek(cb) {
        this.onSeekCallback = cb;
    }

    onLoopRange(cb) {
        this.onLoopRangeCallback = cb;
    }

    setupEventListeners() {
        const handleSeek = (e) => {
            if (!this.duration || !this.onSeekCallback) return;
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const targetTime = (x / rect.width) * this.duration;
            this.currentTime = targetTime;
            this.onSeekCallback(targetTime);
            this.draw();
        };

        this.canvas.addEventListener('mousedown', (e) => {
            this.isDraggingSeek = true;
            handleSeek(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDraggingSeek) {
                handleSeek(e);
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDraggingSeek = false;
        });

        this.canvas.addEventListener('touchstart', (e) => {
            this.isDraggingSeek = true;
            handleSeek(e);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (this.isDraggingSeek) {
                handleSeek(e);
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            this.isDraggingSeek = false;
        });

        window.addEventListener('resize', () => this.resize());
    }

    draw() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;

        if (!w || !h) return;

        ctx.clearRect(0, 0, w, h);

        // Center line
        const midY = h / 2;

        if (!this.peaks || !this.peaks.peaksMax || this.duration === 0) {
            // Draw placeholder grid / empty waveform line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, midY);
            ctx.lineTo(w, midY);
            ctx.stroke();
            ctx.setLineDash([]);
            return;
        }

        const numBins = this.peaks.numBins;
        const pMax = this.peaks.peaksMax;
        const pMin = this.peaks.peaksMin;
        const pRms = this.peaks.peaksRms;

        // 1. Draw Loop Region background
        if (this.isLooping && this.loopEnd > this.loopStart) {
            const x1 = (this.loopStart / this.duration) * w;
            const x2 = (this.loopEnd / this.duration) * w;
            ctx.fillStyle = this.options.loopColor;
            ctx.fillRect(x1, 0, x2 - x1, h);

            // Loop border lines
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
            ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
            ctx.stroke();
        }

        // 2. Draw Progress Overlay
        const progressX = (this.currentTime / this.duration) * w;
        if (progressX > 0) {
            ctx.fillStyle = this.options.progressColor;
            ctx.fillRect(0, 0, progressX, h);
        }

        // 3. Draw Waveform Peaks
        const halfH = midY * 0.92;

        const renderBins = (peaksObj, waveCol, rmsCol, outerAlpha = 0.6, rmsAlpha = 0.95) => {
            if (!peaksObj || !peaksObj.peaksMax) return;
            const pMax = peaksObj.peaksMax;
            const pMin = peaksObj.peaksMin;
            const pRms = peaksObj.peaksRms;
            const bins = peaksObj.numBins || numBins;
            const bWidth = Math.max(1, w / bins);

            for (let i = 0; i < bins; i++) {
                const x = (i / bins) * w;
                const isPlayed = x <= progressX;

                const maxVal = pMax[i];
                const minVal = pMin[i];
                const rmsVal = pRms[i];

                const topY = midY - maxVal * halfH;
                const bottomY = midY - minVal * halfH;
                const rmsTopY = midY - rmsVal * halfH;
                const rmsBottomY = midY + rmsVal * halfH;

                // Outer peak line
                ctx.fillStyle = isPlayed ? '#ffffff' : waveCol;
                ctx.globalAlpha = isPlayed ? 0.9 : outerAlpha;
                ctx.fillRect(x, topY, bWidth, Math.max(1, bottomY - topY));

                // Inner RMS core (dense energy)
                ctx.fillStyle = rmsCol;
                ctx.globalAlpha = rmsAlpha;
                ctx.fillRect(x, rmsTopY, bWidth, Math.max(1, rmsBottomY - rmsTopY));
            }
        };

        if (this.displayMode === 'comparison' && this.originalPeaks && this.masteredPeaks) {
            // Render original dry waveform in translucent cyan in background
            renderBins(this.originalPeaks, '#06b6d4', 'rgba(6, 182, 212, 0.4)', 0.35, 0.5);
            // Render mastered post-processed waveform on top in radiant gold/amber
            renderBins(this.masteredPeaks, '#fbbf24', 'rgba(245, 158, 11, 0.85)', 0.75, 0.95);
        } else if (this.displayMode === 'mastered' && this.masteredPeaks) {
            // Render mastered post-processed waveform in radiant gold/amber
            renderBins(this.masteredPeaks, '#fbbf24', 'rgba(245, 158, 11, 0.85)', 0.7, 0.95);
        } else {
            // Render original dry waveform
            const pObj = this.originalPeaks || this.peaks;
            renderBins(pObj, this.options.waveColor, this.options.rmsColor, 0.6, 0.95);
        }

        ctx.globalAlpha = 1.0;

        // 4. Draw Waveform Display Mode Badge in top right corner
        let badgeText = 'ORIGINAL DRY';
        let badgeBg = 'rgba(6, 182, 212, 0.2)';
        let badgeColor = '#22d3ee';
        let badgeBorder = 'rgba(6, 182, 212, 0.4)';

        if (this.displayMode === 'comparison' && this.masteredPeaks) {
            const lufsVal = this.masteredStats?.integrated ?? this.masteredStats?.integratedLUFS ?? this.masteredStats?.lufs;
            const lufsStr = (lufsVal !== undefined && lufsVal !== null && !isNaN(lufsVal))
                ? ` [${Number(lufsVal).toFixed(1)} LUFS]`
                : '';
            badgeText = `COMPARISON (CYAN: DRY | GOLD: MASTERED${lufsStr})`;
            badgeBg = 'rgba(245, 158, 11, 0.25)';
            badgeColor = '#fbbf24';
            badgeBorder = 'rgba(245, 158, 11, 0.5)';
        } else if (this.displayMode === 'mastered' && this.masteredPeaks) {
            const lufsVal = this.masteredStats?.integrated ?? this.masteredStats?.integratedLUFS ?? this.masteredStats?.lufs;
            const tpVal = this.masteredStats?.truePeak ?? this.masteredStats?.truePeakDb ?? this.masteredStats?.peakDb;
            let metaStr = '';
            if (lufsVal !== undefined && lufsVal !== null && !isNaN(lufsVal) && tpVal !== undefined && tpVal !== null && !isNaN(tpVal)) {
                metaStr = ` • ${Number(lufsVal).toFixed(1)} LUFS | ${Number(tpVal).toFixed(1)} dBTP`;
            } else if (lufsVal !== undefined && lufsVal !== null && !isNaN(lufsVal)) {
                metaStr = ` • ${Number(lufsVal).toFixed(1)} LUFS`;
            }
            badgeText = `POST-PROCESSED MASTER${metaStr}`;
            badgeBg = 'rgba(16, 185, 129, 0.25)';
            badgeColor = '#34d399';
            badgeBorder = 'rgba(16, 185, 129, 0.5)';
        }

        ctx.save();
        ctx.font = 'bold 9px monospace';
        const badgeWidth = ctx.measureText(badgeText).width + 14;
        const badgeHeight = 16;
        const badgeX = w - badgeWidth - 8;
        const badgeY = 6;

        ctx.fillStyle = badgeBg;
        ctx.strokeStyle = badgeBorder;
        ctx.lineWidth = 1;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
            ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);
        }

        ctx.fillStyle = badgeColor;
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, badgeX + 7, badgeY + badgeHeight / 2);
        ctx.restore();

        // 4. Draw Center Baseline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();

        // 5. Draw Glowing Playhead
        if (progressX >= 0 && progressX <= w) {
            ctx.save();
            ctx.shadowColor = this.options.playheadColor;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = this.options.playheadColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(progressX, 0);
            ctx.lineTo(progressX, h);
            ctx.stroke();

            // Playhead triangle handle on top
            ctx.fillStyle = this.options.playheadColor;
            ctx.beginPath();
            ctx.moveTo(progressX - 4, 0);
            ctx.lineTo(progressX + 4, 0);
            ctx.lineTo(progressX, 7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
}
