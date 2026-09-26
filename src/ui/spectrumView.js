/**
 * Professional Spectrum & Match Curve Visualizer
 * Dual FFT display comparing Reference Spectrum, Target Spectrum,
 * Live Master Output, and the EQ Difference Match Curve.
 */

import { ISO_31_BANDS } from '../dsp/analyzer.js';

export class SpectrumView {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        this.minFreq = 20;
        this.maxFreq = 20000;
        this.minDb = -60;
        this.maxDb = 12;

        this.targetAnalysis = null;
        this.referenceAnalysis = null;
        this.differenceData = null;
        this.matchAmount = 1.0;
        this.eqResponsePoints = null;

        this.realtimeTargetData = null;
        this.realtimeMasteredData = null;

        this.hoverFreq = null;
        this.hoverX = -1;
        this.hoverY = -1;

        this.setupInteractions();
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

    setTargetAnalysis(analysis) {
        this.targetAnalysis = analysis;
        this.draw();
    }

    setReferenceAnalysis(analysis) {
        this.referenceAnalysis = analysis;
        this.draw();
    }

    setDifferenceData(diffData, matchAmount = 1.0) {
        this.differenceData = diffData;
        this.matchAmount = matchAmount;
        this.draw();
    }

    setEqResponsePoints(points) {
        this.eqResponsePoints = points;
        this.draw();
    }

    setRealtimeData(targetData, masteredData) {
        this.realtimeTargetData = targetData;
        this.realtimeMasteredData = masteredData;
        this.draw();
    }

    freqToX(freq) {
        const logMin = Math.log10(this.minFreq);
        const logMax = Math.log10(this.maxFreq);
        const logF = Math.log10(Math.max(this.minFreq, Math.min(this.maxFreq, freq)));
        return ((logF - logMin) / (logMax - logMin)) * this.displayWidth;
    }

    xToFreq(x) {
        const logMin = Math.log10(this.minFreq);
        const logMax = Math.log10(this.maxFreq);
        const logF = logMin + (x / this.displayWidth) * (logMax - logMin);
        return Math.pow(10, logF);
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

    setupInteractions() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.hoverX = e.clientX - rect.left;
            this.hoverY = e.clientY - rect.top;
            this.hoverFreq = this.xToFreq(this.hoverX);
            this.draw();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoverX = -1;
            this.hoverY = -1;
            this.hoverFreq = null;
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

        // 1. Background Grid & Frequency / dB markings
        this.drawGrid(ctx, w, h);

        // 2. Real-time RTA FFT Spectrum (Mastered output)
        if (this.realtimeMasteredData) {
            this.drawRealtimeSpectrum(ctx, this.realtimeMasteredData, 'rgba(168, 85, 247, 0.35)', '#a855f7');
        }

        // 3. Target Track Average Spectrum (Cyan line)
        if (this.targetAnalysis && this.targetAnalysis.isoBandEnergies) {
            this.drawSpectralCurve(ctx, this.targetAnalysis.isoBandEnergies, 'rgba(0, 240, 255, 0.15)', '#00f0ff', 2);
        }

        // 4. Reference Track Average Spectrum (Amber/Gold line)
        if (this.referenceAnalysis && this.referenceAnalysis.isoBandEnergies) {
            this.drawSpectralCurve(ctx, this.referenceAnalysis.isoBandEnergies, 'rgba(245, 158, 11, 0.15)', '#f59e0b', 2);
        }

        // 5. EQ Difference Match Curve (Emerald/Green with filled delta)
        if (this.eqResponsePoints && this.eqResponsePoints.length > 0) {
            this.drawEqDifferenceCurve(ctx);
        } else if (this.differenceData && this.differenceData.smoothedDeltaDb) {
            this.drawIsoMatchCurve(ctx);
        }

        // 6. Tooltip crosshair on mouse hover
        if (this.hoverX >= 0 && this.hoverFreq) {
            this.drawHoverTooltip(ctx, w, h);
        }
    }

    drawGrid(ctx, w, h) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        // Vertical frequency grid lines
        const freqs = [30, 60, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        ctx.font = '10px "Inter", "Outfit", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';

        for (const f of freqs) {
            const x = this.freqToX(f);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();

            const label = (f >= 1000) ? `${f / 1000}k` : `${f}`;
            ctx.fillText(label, x + 3, h - 6);
        }

        // Horizontal dB grid lines
        const dbs = [12, 6, 0, -6, -12, -18, -24, -36, -48];
        for (const db of dbs) {
            const y = this.dbToY(db);
            ctx.strokeStyle = (db === 0) ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            ctx.fillText(`${db > 0 ? '+' : ''}${db} dB`, 6, y - 3);
        }

        ctx.restore();
    }

    drawSpectralCurve(ctx, bandEnergies, fillColor, strokeColor, lineWidth = 2) {
        ctx.save();
        ctx.beginPath();

        const numBands = ISO_31_BANDS.length;
        const points = [];

        for (let i = 0; i < numBands; i++) {
            const f = ISO_31_BANDS[i];
            const db = bandEnergies[i];
            points.push({ x: this.freqToX(f), y: this.dbToY(db) });
        }

        // Draw smooth Catmull-Rom spline
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i > 0 ? i - 1 : 0];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }

        // Fill under curve
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 6;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.lineTo(points[points.length - 1].x, this.displayHeight);
        ctx.lineTo(points[0].x, this.displayHeight);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        ctx.restore();
    }

    drawEqDifferenceCurve(ctx) {
        if (!this.eqResponsePoints || this.eqResponsePoints.length === 0) return;

        ctx.save();
        const zeroY = this.dbToY(0);

        // Fill region between 0dB and EQ curve
        ctx.beginPath();
        const first = this.eqResponsePoints[0];
        ctx.moveTo(this.freqToX(first.freq), zeroY);

        for (const pt of this.eqResponsePoints) {
            const x = this.freqToX(pt.freq);
            const y = this.dbToY(pt.gainDb);
            ctx.lineTo(x, y);
        }

        const last = this.eqResponsePoints[this.eqResponsePoints.length - 1];
        ctx.lineTo(this.freqToX(last.freq), zeroY);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, this.dbToY(12), 0, this.dbToY(-12));
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.1)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0.2)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke the curve line
        ctx.beginPath();
        ctx.moveTo(this.freqToX(first.freq), this.dbToY(first.gainDb));
        for (let i = 1; i < this.eqResponsePoints.length; i++) {
            const pt = this.eqResponsePoints[i];
            ctx.lineTo(this.freqToX(pt.freq), this.dbToY(pt.gainDb));
        }

        ctx.strokeStyle = '#10b981'; // Vibrant emerald green
        ctx.lineWidth = 3;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10;
        ctx.stroke();

        ctx.restore();
    }

    drawIsoMatchCurve(ctx) {
        const delta = this.differenceData.smoothedDeltaDb;
        const points = [];
        for (let i = 0; i < ISO_31_BANDS.length; i++) {
            const f = ISO_31_BANDS[i];
            const gain = (delta[i] || 0) * this.matchAmount;
            points.push({ x: this.freqToX(f), y: this.dbToY(gain) });
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
    }

    drawRealtimeSpectrum(ctx, freqData, fillColor, strokeColor) {
        ctx.save();
        const bufferLen = freqData.length;
        const nyquist = 24000;
        const binHz = nyquist / bufferLen;

        ctx.beginPath();
        let started = false;

        for (let i = 1; i < bufferLen; i++) {
            const f = i * binHz;
            if (f < this.minFreq) continue;
            if (f > this.maxFreq) break;

            const val = freqData[i]; // 0 - 255
            const db = -70 + (val / 255) * 76; // map to dB
            const x = this.freqToX(f);
            const y = this.dbToY(db);

            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.restore();
    }

    drawHoverTooltip(ctx, w, h) {
        ctx.save();
        // Crosshair lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(this.hoverX, 0); ctx.lineTo(this.hoverX, h);
        ctx.moveTo(0, this.hoverY); ctx.lineTo(w, this.hoverY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tooltip badge
        const freqText = (this.hoverFreq >= 1000) 
            ? `${(this.hoverFreq / 1000).toFixed(2)} kHz` 
            : `${Math.round(this.hoverFreq)} Hz`;
        const dbText = `${this.yToDb(this.hoverY).toFixed(1)} dB`;

        const badgeText = `${freqText} | ${dbText}`;
        ctx.font = '11px "Inter", sans-serif';
        const textWidth = ctx.measureText(badgeText).width;

        let badgeX = this.hoverX + 12;
        let badgeY = this.hoverY - 12;
        if (badgeX + textWidth + 16 > w) badgeX = this.hoverX - textWidth - 20;
        if (badgeY < 24) badgeY = this.hoverY + 24;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY - 16, textWidth + 14, 22, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(badgeText, badgeX + 7, badgeY);
        ctx.restore();
    }
}
