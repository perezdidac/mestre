/**
 * Studio Mastering Stereo Goniometer & Lissajous Phase Scope
 * Visualizes stereo width, phase correlation, Mid/Side balance,
 * and mono compatibility in real time using time-domain sample analysis.
 */

export class VectorscopeView {
    constructor(canvasElement, correlationElement = null, metaElement = null) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.correlationContainer = correlationElement;
        this.metaContainer = metaElement;

        this.displayWidth = 0;
        this.displayHeight = 0;
        this.zoom = 1.0;
        this.colorTheme = 'cyan'; // 'cyan' | 'emerald' | 'amber'

        this.correlation = 1.0;
        this.smoothedCorrelation = 1.0;
        this.midEnergy = 0.0;
        this.sideEnergy = 0.0;

        this.resize();
        this.drawEmptyGrid();
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

    setZoom(zoomFactor) {
        this.zoom = zoomFactor;
    }

    setColorTheme(theme) {
        this.colorTheme = theme;
    }

    drawEmptyGrid() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;
        if (!w || !h) return;

        ctx.fillStyle = '#060a12';
        ctx.fillRect(0, 0, w, h);
        this.drawScopeGrid(ctx, w, h);
    }

    drawScopeGrid(ctx, w, h) {
        const cx = w / 2;
        const cy = h / 2;
        const maxRadius = Math.min(cx, cy) * 0.88;

        // Subtle CRT scanline background pattern
        ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
        for (let y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 1);
        }

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;

        // Concentric Calibration Rings (0dB, -6dB, -12dB, -18dB)
        const rings = [0.25, 0.5, 0.75, 1.0];
        const ringLabels = ['-18dB', '-12dB', '-6dB', '0dB'];
        rings.forEach((r, idx) => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxRadius * r, 0, Math.PI * 2);
            ctx.stroke();

            // Calibration ring labels
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(ringLabels[idx], cx + maxRadius * r - 12, cy - 3);
        });

        // Axes: M (Mid/Mono, vertical), S (Side/Stereo, horizontal)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        // Mid vertical axis
        ctx.moveTo(cx, cy - maxRadius);
        ctx.lineTo(cx, cy + maxRadius);
        // Side horizontal axis
        ctx.moveTo(cx - maxRadius, cy);
        ctx.lineTo(cx + maxRadius, cy);
        ctx.stroke();

        // 45° Diagonal Axes: Left (top-left to bottom-right) and Right (top-right to bottom-left)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        const diagDist = maxRadius * 0.95;
        // Left Channel axis (45° left)
        ctx.moveTo(cx - diagDist * 0.707, cy - diagDist * 0.707);
        ctx.lineTo(cx + diagDist * 0.707, cy + diagDist * 0.707);
        // Right Channel axis (45° right)
        ctx.moveTo(cx + diagDist * 0.707, cy - diagDist * 0.707);
        ctx.lineTo(cx - diagDist * 0.707, cy + diagDist * 0.707);
        ctx.stroke();
        ctx.setLineDash([]);

        // Axis Labels
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fontWeight = '700';

        // M (Mid / Mono)
        ctx.fillStyle = '#06b6d4';
        ctx.textAlign = 'center';
        ctx.fillText('+M (MONO)', cx, cy - maxRadius - 6);

        // S (Side / Stereo)
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText('+S (SIDE)', cx - maxRadius - 8, cy + 3);
        ctx.textAlign = 'left';
        ctx.fillText('-S', cx + maxRadius + 8, cy + 3);

        // L & R Diagonal channel markers
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('L (LEFT)', cx - diagDist * 0.707 - 24, cy - diagDist * 0.707 - 4);
        ctx.fillText('R (RIGHT)', cx + diagDist * 0.707 + 8, cy - diagDist * 0.707 - 4);

        ctx.restore();
    }

    render(stereoData) {
        if (!stereoData || !stereoData.left || !stereoData.right) {
            this.drawEmptyGrid();
            return;
        }

        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;
        if (!w || !h) return;

        const left = stereoData.left;
        const right = stereoData.right;
        const len = Math.min(left.length, right.length);
        if (len === 0) return;

        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) * 0.88;

        // Simulated analog CRT phosphor decay: fade canvas with low-alpha black
        ctx.fillStyle = 'rgba(6, 10, 18, 0.22)';
        ctx.fillRect(0, 0, w, h);

        // Draw background grid lines on top
        this.drawScopeGrid(ctx, w, h);

        // Calculate Phase Correlation and Mid/Side energy
        let dotProduct = 0;
        let sumSqL = 0;
        let sumSqR = 0;
        let sumMidSq = 0;
        let sumSideSq = 0;

        // Choose theme colors
        let pointColor = 'rgba(6, 182, 212, 0.65)';
        let glowColor = 'rgba(6, 182, 212, 0.35)';
        if (this.colorTheme === 'emerald') {
            pointColor = 'rgba(16, 185, 129, 0.75)';
            glowColor = 'rgba(16, 185, 129, 0.4)';
        } else if (this.colorTheme === 'amber') {
            pointColor = 'rgba(245, 158, 11, 0.75)';
            glowColor = 'rgba(245, 158, 11, 0.4)';
        }

        // Draw Lissajous Polar Vectorscope Points
        ctx.save();
        ctx.fillStyle = pointColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 4;

        const scale = radius * this.zoom;
        const step = 2; // sample decimation for optimal 60fps rendering

        for (let i = 0; i < len; i += step) {
            const l = left[i];
            const r = right[i];

            dotProduct += l * r;
            sumSqL += l * l;
            sumSqR += r * r;

            const m = (l + r) * 0.5;
            const s = (l - r) * 0.5;
            sumMidSq += m * m;
            sumSideSq += s * s;

            // Rotate coordinate system by 45°:
            // x = Right - Left (Side channel)
            // y = Left + Right (Mid channel, pointing up)
            const x = cx + s * scale * 1.414;
            const y = cy - m * scale * 1.414;

            // Draw phosphor dot
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Calculate normalized correlation r in [-1, +1]
        const denom = Math.sqrt(sumSqL * sumSqR);
        let rawCorr = denom > 1e-6 ? dotProduct / denom : 1.0;
        rawCorr = Math.max(-1.0, Math.min(1.0, rawCorr));

        // Smooth correlation for buttery UI movement
        this.smoothedCorrelation += (rawCorr - this.smoothedCorrelation) * 0.12;

        const totalEnergy = sumMidSq + sumSideSq;
        const midPct = totalEnergy > 1e-6 ? (sumMidSq / totalEnergy) * 100 : 100;
        const sidePct = totalEnergy > 1e-6 ? (sumSideSq / totalEnergy) * 100 : 0;

        this.updateTelemetryDom(this.smoothedCorrelation, midPct, sidePct);
    }

    updateTelemetryDom(corr, midPct, sidePct) {
        if (!this.correlationContainer) return;

        // Map correlation [-1, +1] to percentage [0%, 100%]
        const pct = ((corr + 1) / 2) * 100;

        let statusText = 'STEREO PHASE SAFE';
        let statusClass = 'phase-safe';

        if (corr > 0.6) {
            statusText = 'MONO COMPATIBLE';
            statusClass = 'phase-safe';
        } else if (corr > 0.15) {
            statusText = 'BALANCED STEREO';
            statusClass = 'phase-balanced';
        } else if (corr > -0.2) {
            statusText = 'WIDE / CAUTION';
            statusClass = 'phase-warn';
        } else {
            statusText = 'OUT OF PHASE (MONO RISK)';
            statusClass = 'phase-danger';
        }

        this.correlationContainer.innerHTML = `
            <div class="vectorscope-meter-row">
                <div class="corr-scale-header">
                    <span class="corr-title">PHASE CORRELATION</span>
                    <span class="corr-badge ${statusClass}">${corr >= 0 ? '+' : ''}${corr.toFixed(2)} • ${statusText}</span>
                </div>
                <div class="corr-bar-track">
                    <div class="corr-center-mark"></div>
                    <div class="corr-bar-fill ${statusClass}" style="left: ${Math.min(50, pct)}%; width: ${Math.abs(pct - 50)}%;"></div>
                    <div class="corr-needle" style="left: ${pct}%;"></div>
                </div>
                <div class="corr-scale-labels">
                    <span>-1.0 (OUT OF PHASE)</span>
                    <span>0.0 (WIDE)</span>
                    <span>+1.0 (MONO)</span>
                </div>
            </div>

            <div class="vectorscope-ms-row">
                <div class="ms-stat">
                    <span class="ms-label">MID (MONO):</span>
                    <span class="ms-val">${Math.round(midPct)}%</span>
                </div>
                <div class="ms-bar-track">
                    <div class="ms-bar-mid" style="width: ${midPct}%"></div>
                    <div class="ms-bar-side" style="width: ${sidePct}%"></div>
                </div>
                <div class="ms-stat">
                    <span class="ms-label">SIDE (STEREO):</span>
                    <span class="ms-val">${Math.round(sidePct)}%</span>
                </div>
            </div>
        `;
    }
}
