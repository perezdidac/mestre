/**
 * Interactive Multi-Band Match EQ Curve Editor
 * Displays the 32-band ISO parametric filter nodes, allows fine-tuning,
 * manual node dragging, and visualizes the active biquad magnitude response.
 */

import { ISO_31_BANDS } from '../dsp/analyzer.js';

export class EqPlotView {
    constructor(canvasElement, onBandChange = null) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.onBandChange = onBandChange;

        this.minFreq = 20;
        this.maxFreq = 20000;
        this.minDb = -18;
        this.maxDb = 18;

        this.bands = ISO_31_BANDS.map(f => ({
            freq: f,
            gainDb: 0.0,
            q: 1.8,
            enabled: true
        }));

        this.activeBandIndex = -1;
        this.isDragging = false;
        this.hoverBandIndex = -1;

        this.setupEvents();
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

    setBands(bandConfigs) {
        if (Array.isArray(bandConfigs)) {
            for (let i = 0; i < Math.min(this.bands.length, bandConfigs.length); i++) {
                this.bands[i].gainDb = bandConfigs[i].gainDb || 0;
                this.bands[i].enabled = bandConfigs[i].enabled !== undefined ? bandConfigs[i].enabled : true;
            }
            this.draw();
        }
    }

    freqToX(freq) {
        const logMin = Math.log10(this.minFreq);
        const logMax = Math.log10(this.maxFreq);
        const logF = Math.log10(Math.max(this.minFreq, Math.min(this.maxFreq, freq)));
        return ((logF - logMin) / (logMax - logMin)) * this.displayWidth;
    }

    dbToY(db) {
        const clamped = Math.max(this.minDb, Math.min(this.maxDb, db));
        const norm = (clamped - this.minDb) / (this.maxDb - this.minDb);
        return (1.0 - norm) * this.displayHeight;
    }

    yToDb(y) {
        const norm = 1.0 - (y / this.displayHeight);
        return this.minDb + norm * (this.maxDb - this.minDb);
    }

    setupEvents() {
        const findNearestBand = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            let closestIdx = -1;
            let minDistSq = 400; // 20px hit radius

            for (let i = 0; i < this.bands.length; i++) {
                const bx = this.freqToX(this.bands[i].freq);
                const by = this.dbToY(this.bands[i].gainDb);
                const dSq = (x - bx) * (x - bx) + (y - by) * (y - by);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closestIdx = i;
                }
            }
            return { index: closestIdx, y: y };
        };

        this.canvas.addEventListener('mousedown', (e) => {
            const hit = findNearestBand(e.clientX, e.clientY);
            if (hit.index !== -1) {
                this.activeBandIndex = hit.index;
                this.isDragging = true;
                this.draw();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.activeBandIndex !== -1) {
                const rect = this.canvas.getBoundingClientRect();
                const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
                const newDb = Math.round(this.yToDb(y) * 10) / 10;
                this.bands[this.activeBandIndex].gainDb = Math.max(-15, Math.min(12, newDb));
                if (this.onBandChange) {
                    this.onBandChange(this.activeBandIndex, this.bands[this.activeBandIndex]);
                }
                this.draw();
            } else {
                const hit = findNearestBand(e.clientX, e.clientY);
                if (hit.index !== this.hoverBandIndex) {
                    this.hoverBandIndex = hit.index;
                    this.draw();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.activeBandIndex = -1;
            this.draw();
        });

        window.addEventListener('resize', () => this.resize());
    }

    draw() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;

        if (!w || !h) return;

        ctx.clearRect(0, 0, w, h);

        // 1. Center 0dB Reference Line
        const zeroY = this.dbToY(0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, zeroY);
        ctx.lineTo(w, zeroY);
        ctx.stroke();

        // 2. Continuous EQ Response curve
        ctx.save();
        ctx.beginPath();
        const startX = this.freqToX(this.bands[0].freq);
        ctx.moveTo(startX, this.dbToY(this.bands[0].gainDb));

        for (let i = 0; i < this.bands.length - 1; i++) {
            const p0 = this.bands[i > 0 ? i - 1 : 0];
            const p1 = this.bands[i];
            const p2 = this.bands[i + 1];
            const p3 = this.bands[i + 2 < this.bands.length ? i + 2 : this.bands.length - 1];

            const x1 = this.freqToX(p1.freq);
            const y1 = this.dbToY(p1.gainDb);
            const x2 = this.freqToX(p2.freq);
            const y2 = this.dbToY(p2.gainDb);

            const x0 = this.freqToX(p0.freq);
            const y0 = this.dbToY(p0.gainDb);
            const x3 = this.freqToX(p3.freq);
            const y3 = this.dbToY(p3.gainDb);

            const cp1x = x1 + (x2 - x0) / 6;
            const cp1y = y1 + (y2 - y0) / 6;
            const cp2x = x2 - (x3 - x1) / 6;
            const cp2y = y2 - (y3 - y1) / 6;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
        }

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Fill under curve
        ctx.lineTo(this.freqToX(this.bands[this.bands.length - 1].freq), zeroY);
        ctx.lineTo(startX, zeroY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.fill();
        ctx.restore();

        // 3. Interactive Frequency Band Nodes
        for (let i = 0; i < this.bands.length; i++) {
            const b = this.bands[i];
            const x = this.freqToX(b.freq);
            const y = this.dbToY(b.gainDb);

            const isHover = (i === this.hoverBandIndex);
            const isActive = (i === this.activeBandIndex);

            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, (isHover || isActive) ? 7 : 4, 0, Math.PI * 2);

            if (isActive) {
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 10;
            } else if (isHover) {
                ctx.fillStyle = '#00f0ff';
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 8;
            } else {
                ctx.fillStyle = '#10b981';
            }
            ctx.fill();

            ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    }
}
