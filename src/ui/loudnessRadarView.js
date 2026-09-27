/**
 * Rolling Real-Time Loudness History & Dynamic Range Radar
 * Visualizes short-term & momentary LUFS contour over the past 30 seconds,
 * streaming compliance target boundaries (-14 LUFS), and dynamic range breathing.
 */

export class LoudnessRadarView {
    constructor(canvasElement, metaElement = null) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.metaContainer = metaElement;

        this.displayWidth = 0;
        this.displayHeight = 0;

        // 30 seconds buffer @ ~10 updates per second = 300 points
        this.maxHistory = 240;
        this.history = []; // { momentary, shortTerm, peak, timestamp }
        this.targetLufs = -14.0; // Streaming target
        this.minLufs = -36.0;
        this.maxLufs = -4.0;

        this.resize();
        this.drawEmpty();
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);
        this.ctx.scale(dpr, dpr);
    }

    pushTelemetry(momentaryLufs, shortTermLufs, peakDb = -12) {
        const clampedM = Math.max(this.minLufs, Math.min(0, momentaryLufs));
        const clampedS = Math.max(this.minLufs, Math.min(0, shortTermLufs));

        this.history.push({
            m: clampedM,
            s: clampedS,
            peak: peakDb,
            t: Date.now()
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this.render();
    }

    lufsToY(lufs) {
        const norm = (lufs - this.minLufs) / (this.maxLufs - this.minLufs);
        const clamped = Math.max(0, Math.min(1, norm));
        return this.displayHeight - (clamped * (this.displayHeight - 30) + 15);
    }

    drawEmpty() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;
        if (!w || !h) return;

        ctx.fillStyle = '#060a12';
        ctx.fillRect(0, 0, w, h);
        this.drawGrid(ctx, w, h);
    }

    drawGrid(ctx, w, h) {
        // Grid lines for standard mastering reference levels
        const gridLevels = [-6, -9, -12, -14, -18, -24, -30];

        ctx.save();
        for (const lufs of gridLevels) {
            const y = this.lufsToY(lufs);
            const isTarget = (lufs === this.targetLufs);

            if (isTarget) {
                // Target -14 LUFS line
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.setLineDash([]);
                ctx.lineWidth = 1;
            }

            ctx.beginPath();
            ctx.moveTo(50, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            // Label
            ctx.fillStyle = isTarget ? '#f59e0b' : 'rgba(255, 255, 255, 0.3)';
            ctx.font = isTarget ? 'bold 10px monospace' : '9px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${lufs} LUFS`, 46, y + 3);
        }
        ctx.restore();
    }

    render() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;
        if (!w || !h) return;

        // Clear background
        ctx.fillStyle = '#060a12';
        ctx.fillRect(0, 0, w, h);

        this.drawGrid(ctx, w, h);

        if (this.history.length < 2) return;

        const leftMargin = 55;
        const plotWidth = w - leftMargin - 15;
        const count = this.history.length;
        const xStep = plotWidth / (this.maxHistory - 1);

        // 1. Draw Momentary LUFS Area & Curve (Subtle Glow Fill)
        ctx.save();
        const startX = w - 15 - (count - 1) * xStep;

        ctx.beginPath();
        ctx.moveTo(startX, this.displayHeight - 15);

        for (let i = 0; i < count; i++) {
            const pt = this.history[i];
            const x = startX + i * xStep;
            const y = this.lufsToY(pt.m);
            ctx.lineTo(x, y);
        }

        ctx.lineTo(w - 15, this.displayHeight - 15);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, this.lufsToY(-9), 0, this.displayHeight);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.28)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();

        // 2. Draw Short-Term LUFS Solid Curve (Main Broadcast Loudness)
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const pt = this.history[i];
            const x = startX + i * xStep;
            const y = this.lufsToY(pt.s);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();

        // 3. Current Live Point Indicator on the Right Edge
        const latest = this.history[count - 1];
        const latestX = w - 15;
        const latestY = this.lufsToY(latest.s);

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(latestX, latestY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
