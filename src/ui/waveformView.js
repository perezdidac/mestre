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
            this.duration = 0;
            this.draw();
            return;
        }
        this.peaks = track.waveformPeaks;
        this.duration = track.duration;
        this.loopEnd = track.duration;
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
        const barWidth = Math.max(1, w / numBins);
        const halfH = midY * 0.92;

        for (let i = 0; i < numBins; i++) {
            const x = (i / numBins) * w;
            const isPlayed = x <= progressX;

            const maxVal = pMax[i];
            const minVal = pMin[i];
            const rmsVal = pRms[i];

            const topY = midY - maxVal * halfH;
            const bottomY = midY - minVal * halfH;
            const rmsTopY = midY - rmsVal * halfH;
            const rmsBottomY = midY + rmsVal * halfH;

            // Outer peak line
            ctx.fillStyle = isPlayed ? '#ffffff' : this.options.waveColor;
            ctx.globalAlpha = isPlayed ? 0.9 : 0.6;
            ctx.fillRect(x, topY, barWidth, Math.max(1, bottomY - topY));

            // Inner RMS core (dense energy)
            ctx.fillStyle = this.options.rmsColor;
            ctx.globalAlpha = 0.95;
            ctx.fillRect(x, rmsTopY, barWidth, Math.max(1, rmsBottomY - rmsTopY));
        }

        ctx.globalAlpha = 1.0;

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
