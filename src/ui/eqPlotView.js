/**
 * Pro Studio Interactive Parametric EQ Curve Editor (FabFilter Pro-Q Style)
 * Precision 8-band mastering equalizer with draggable nodes, mouse-wheel Q bandwidth adjustment,
 * compound magnitude response curve, floating parameter HUD, and 1-click mastering presets.
 */

export class EqPlotView {
    constructor(canvasElement, onBandChange = null) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.onBandChange = onBandChange;

        this.minFreq = 20;
        this.maxFreq = 20000;
        this.minDb = -18;
        this.maxDb = 18;

        // 8 Musical Mastering Bands
        this.bands = [
            { id: 'sub', name: 'Sub', freq: 32, gainDb: 0.0, q: 0.71, type: 'lowshelf', enabled: true, color: '#00f0ff' },
            { id: 'low', name: 'Bass', freq: 80, gainDb: 0.0, q: 1.41, type: 'peaking', enabled: true, color: '#38bdf8' },
            { id: 'low_mid', name: 'Body', freq: 250, gainDb: 0.0, q: 1.41, type: 'peaking', enabled: true, color: '#10b981' },
            { id: 'mid', name: 'Mid', freq: 650, gainDb: 0.0, q: 1.41, type: 'peaking', enabled: true, color: '#84cc16' },
            { id: 'high_mid', name: 'Vocal', freq: 1800, gainDb: 0.0, q: 1.41, type: 'peaking', enabled: true, color: '#f59e0b' },
            { id: 'presence', name: 'Presence', freq: 4500, gainDb: 0.0, q: 1.41, type: 'peaking', enabled: true, color: '#f97316' },
            { id: 'brilliance', name: 'Sheen', freq: 9000, gainDb: 0.0, q: 1.41, type: 'peaking', enabled: true, color: '#a855f7' },
            { id: 'air', name: 'Air', freq: 14000, gainDb: 0.0, q: 0.71, type: 'highshelf', enabled: true, color: '#ec4899' }
        ];

        this.activeBandIndex = -1;
        this.hoverBandIndex = -1;
        this.isDragging = false;
        this.isAuditioning = false;
        this.auditionBandIndex = -1;

        this.hudElement = document.getElementById('pro-q-hud');
        this.setupPresets();
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
        if (this.activeBandIndex !== -1) {
            this.positionHud(this.activeBandIndex);
        }
    }

    setBands(bandConfigs) {
        if (Array.isArray(bandConfigs)) {
            for (let i = 0; i < Math.min(this.bands.length, bandConfigs.length); i++) {
                const cfg = bandConfigs[i];
                if (cfg.freq) this.bands[i].freq = cfg.freq;
                if (cfg.gainDb !== undefined) this.bands[i].gainDb = cfg.gainDb;
                if (cfg.gain !== undefined) this.bands[i].gainDb = cfg.gain;
                if (cfg.q !== undefined) this.bands[i].q = cfg.q;
                if (cfg.type) this.bands[i].type = cfg.type;
                if (cfg.enabled !== undefined) this.bands[i].enabled = cfg.enabled;
            }
            this.draw();
            if (this.activeBandIndex !== -1) {
                this.updateHudContent(this.activeBandIndex);
            }
        }
    }

    freqToX(freq) {
        const logMin = Math.log10(this.minFreq);
        const logMax = Math.log10(this.maxFreq);
        const logF = Math.log10(Math.max(this.minFreq, Math.min(this.maxFreq, freq)));
        return ((logF - logMin) / (logMax - logMin)) * this.displayWidth;
    }

    xToFreq(x) {
        const norm = Math.max(0, Math.min(1, x / this.displayWidth));
        const logMin = Math.log10(this.minFreq);
        const logMax = Math.log10(this.maxFreq);
        return Math.pow(10, logMin + norm * (logMax - logMin));
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

    /**
     * Compute compound magnitude response in dB at a given frequency
     */
    evalCompoundResponse(f) {
        let totalDb = 0;
        for (const b of this.bands) {
            if (!b.enabled || Math.abs(b.gainDb) < 0.01) continue;

            const f0 = b.freq;
            const q = Math.max(0.1, b.q);
            const g = b.gainDb;

            if (b.type === 'peaking') {
                // Bell curve approximation
                const octDist = Math.log2(f / f0);
                const bandwidth = 1.0 / q;
                const gainAtF = g * Math.exp(-0.5 * Math.pow(octDist / (0.5 * bandwidth), 2));
                totalDb += gainAtF;
            } else if (b.type === 'lowshelf') {
                if (f <= f0) {
                    totalDb += g;
                } else if (f < f0 * 4) {
                    const t = Math.log2(f / f0) / 2.0;
                    totalDb += g * (1.0 - t);
                }
            } else if (b.type === 'highshelf') {
                if (f >= f0) {
                    totalDb += g;
                } else if (f > f0 / 4) {
                    const t = Math.log2(f0 / f) / 2.0;
                    totalDb += g * (1.0 - t);
                }
            } else if (b.type === 'highpass') {
                if (f < f0) {
                    const octBelow = Math.log2(f0 / f);
                    totalDb -= octBelow * 12.0; // 12 dB/oct slope
                }
            } else if (b.type === 'lowpass') {
                if (f > f0) {
                    const octAbove = Math.log2(f / f0);
                    totalDb -= octAbove * 12.0;
                }
            } else if (b.type === 'notch') {
                const octDist = Math.abs(Math.log2(f / f0));
                if (octDist < (0.2 / q)) {
                    totalDb -= 24.0 * (1.0 - octDist / (0.2 / q));
                }
            }
        }
        return Math.max(this.minDb, Math.min(this.maxDb, totalDb));
    }

    setupEvents() {
        const findNearestBand = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            let closestIdx = -1;
            let minDistSq = 700; // 26px hit radius

            for (let i = 0; i < this.bands.length; i++) {
                const bx = this.freqToX(this.bands[i].freq);
                const by = this.dbToY(this.bands[i].gainDb);
                const dSq = (x - bx) * (x - bx) + (y - by) * (y - by);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closestIdx = i;
                }
            }
            return closestIdx;
        };

        this.canvas.addEventListener('mousedown', (e) => {
            const hit = findNearestBand(e.clientX, e.clientY);
            if (hit !== -1) {
                this.activeBandIndex = hit;
                this.isDragging = true;
                this.showHud(hit);
                this.draw();
            } else {
                this.hideHud();
                this.activeBandIndex = -1;
                this.draw();
            }
        });

        this.canvas.addEventListener('dblclick', (e) => {
            const hit = findNearestBand(e.clientX, e.clientY);
            if (hit !== -1) {
                // Double click resets band to 0 dB
                this.bands[hit].gainDb = 0.0;
                this.emitBandChange(hit);
                this.draw();
                this.updateHudContent(hit);
            } else {
                // Double click creates / activates band at location
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const freq = Math.round(this.xToFreq(x));
                const gain = Math.round(this.yToDb(y) * 10) / 10;

                // Find closest band and move it here
                let closest = 0;
                let minDiff = Infinity;
                this.bands.forEach((b, idx) => {
                    const diff = Math.abs(Math.log2(b.freq / freq));
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = idx;
                    }
                });

                this.bands[closest].freq = freq;
                this.bands[closest].gainDb = gain;
                this.bands[closest].enabled = true;
                this.activeBandIndex = closest;
                this.showHud(closest);
                this.emitBandChange(closest);
                this.draw();
            }
        });

        // Wheel adjusts Q factor smoothly (Signature Pro-Q feature!)
        this.canvas.addEventListener('wheel', (e) => {
            const targetIdx = (this.hoverBandIndex !== -1) ? this.hoverBandIndex : this.activeBandIndex;
            if (targetIdx !== -1) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.15 : 0.15;
                const b = this.bands[targetIdx];
                b.q = Math.max(0.2, Math.min(18.0, Math.round((b.q + delta) * 100) / 100));
                this.emitBandChange(targetIdx);
                this.draw();
                this.updateHudContent(targetIdx);
            }
        }, { passive: false });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.activeBandIndex !== -1) {
                const rect = this.canvas.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

                const newFreq = Math.round(this.xToFreq(x));
                const newDb = Math.round(this.yToDb(y) * 10) / 10;

                this.bands[this.activeBandIndex].freq = newFreq;
                this.bands[this.activeBandIndex].gainDb = newDb;

                this.emitBandChange(this.activeBandIndex);
                this.positionHud(this.activeBandIndex);
                this.updateHudContent(this.activeBandIndex);
                this.draw();
            } else {
                const hit = findNearestBand(e.clientX, e.clientY);
                if (hit !== this.hoverBandIndex) {
                    this.hoverBandIndex = hit;
                    this.draw();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        window.addEventListener('resize', () => this.resize());
    }

    emitBandChange(bandIndex) {
        if (this.onBandChange && this.bands[bandIndex]) {
            this.onBandChange(bandIndex, { ...this.bands[bandIndex] });
        }
    }

    setupPresets() {
        const presetContainer = document.getElementById('pro-eq-presets');
        if (!presetContainer) return;

        presetContainer.querySelectorAll('.btn-eq-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                this.applyPreset(preset);
            });
        });
    }

    applyPreset(presetName) {
        switch (presetName) {
            case 'flat':
                this.bands.forEach(b => { b.gainDb = 0.0; b.enabled = true; });
                break;
            case 'air':
                this.bands[0].gainDb = 0.0;
                this.bands[1].gainDb = 0.5;
                this.bands[2].gainDb = 0.0;
                this.bands[3].gainDb = -0.5;
                this.bands[4].gainDb = 0.5;
                this.bands[5].gainDb = 1.0;
                this.bands[6].gainDb = 2.0;
                this.bands[7].gainDb = 3.5;
                break;
            case 'vocal':
                this.bands[0].gainDb = -1.0;
                this.bands[1].gainDb = 0.0;
                this.bands[2].gainDb = -2.0;
                this.bands[3].gainDb = -1.0;
                this.bands[4].gainDb = 2.5;
                this.bands[5].gainDb = 2.0;
                this.bands[6].gainDb = 1.0;
                this.bands[7].gainDb = 1.5;
                break;
            case 'punch':
                this.bands[0].gainDb = 1.5;
                this.bands[1].gainDb = 3.0;
                this.bands[2].gainDb = -1.5;
                this.bands[3].gainDb = 0.0;
                this.bands[4].gainDb = 0.5;
                this.bands[5].gainDb = 1.5;
                this.bands[6].gainDb = 1.0;
                this.bands[7].gainDb = 1.0;
                break;
            case 'demud':
                this.bands[0].gainDb = 0.0;
                this.bands[1].gainDb = 0.5;
                this.bands[2].gainDb = -3.5; // De-mud 250Hz
                this.bands[3].gainDb = -1.5;
                this.bands[4].gainDb = 0.5;
                this.bands[5].gainDb = 1.0;
                this.bands[6].gainDb = 1.5;
                this.bands[7].gainDb = 1.5;
                break;
            case 'smile':
                this.bands[0].gainDb = 2.5;
                this.bands[1].gainDb = 2.0;
                this.bands[2].gainDb = -0.5;
                this.bands[3].gainDb = -1.5;
                this.bands[4].gainDb = -1.0;
                this.bands[5].gainDb = 1.0;
                this.bands[6].gainDb = 2.0;
                this.bands[7].gainDb = 3.0;
                break;
        }

        for (let i = 0; i < this.bands.length; i++) {
            this.emitBandChange(i);
        }
        this.draw();
        if (this.activeBandIndex !== -1) {
            this.updateHudContent(this.activeBandIndex);
        }
    }

    showHud(bandIndex) {
        if (!this.hudElement) return;
        this.updateHudContent(bandIndex);
        this.positionHud(bandIndex);
        this.hudElement.style.display = 'flex';
    }

    hideHud() {
        if (this.hudElement) {
            this.hudElement.style.display = 'none';
        }
    }

    positionHud(bandIndex) {
        if (!this.hudElement || !this.bands[bandIndex]) return;
        const b = this.bands[bandIndex];
        const x = this.freqToX(b.freq);
        const y = this.dbToY(b.gainDb);

        const hudW = 380;
        const hudH = 50;
        const clampedX = Math.max(hudW / 2 + 10, Math.min(this.displayWidth - hudW / 2 - 10, x));
        const placeAbove = y > hudH + 20;
        const targetY = placeAbove ? (y - hudH - 14) : (y + 24);

        this.hudElement.style.left = `${clampedX}px`;
        this.hudElement.style.top = `${targetY}px`;
    }

    updateHudContent(bandIndex) {
        if (!this.hudElement || !this.bands[bandIndex]) return;
        const b = this.bands[bandIndex];

        this.hudElement.style.setProperty('--hud-band-color', b.color);
        this.hudElement.innerHTML = `
            <div class="hud-band-badge">${bandIndex + 1}</div>

            <div class="hud-shapes-group">
                <button class="btn-hud-shape ${b.type === 'bell' || b.type === 'peaking' ? 'active' : ''}" data-shape="peaking" title="Bell / Peaking">∿</button>
                <button class="btn-hud-shape ${b.type === 'lowshelf' ? 'active' : ''}" data-shape="lowshelf" title="Low Shelf">⤹</button>
                <button class="btn-hud-shape ${b.type === 'highshelf' ? 'active' : ''}" data-shape="highshelf" title="High Shelf">⤸</button>
                <button class="btn-hud-shape ${b.type === 'highpass' ? 'active' : ''}" data-shape="highpass" title="Low Cut / HP">⤴</button>
                <button class="btn-hud-shape ${b.type === 'lowpass' ? 'active' : ''}" data-shape="lowpass" title="High Cut / LP">⤵</button>
                <button class="btn-hud-shape ${b.type === 'notch' ? 'active' : ''}" data-shape="notch" title="Notch">⋁</button>
            </div>

            <div class="hud-control-group">
                <span class="hud-control-label">FREQ</span>
                <div class="hud-value-nudge">
                    <button class="btn-hud-nudge btn-freq-down">◀</button>
                    <span class="hud-val-text">${b.freq >= 1000 ? `${(b.freq / 1000).toFixed(1)}k` : `${b.freq}`}\u00A0Hz</span>
                    <button class="btn-hud-nudge btn-freq-up">▶</button>
                </div>
            </div>

            <div class="hud-control-group">
                <span class="hud-control-label">GAIN</span>
                <div class="hud-value-nudge">
                    <button class="btn-hud-nudge btn-gain-down">-</button>
                    <span class="hud-val-text">${b.gainDb > 0 ? '+' : ''}${b.gainDb.toFixed(1)}\u00A0dB</span>
                    <button class="btn-hud-nudge btn-gain-up">+</button>
                </div>
            </div>

            <div class="hud-control-group">
                <span class="hud-control-label">Q (WIDTH)</span>
                <div class="hud-value-nudge">
                    <button class="btn-hud-nudge btn-q-down">-</button>
                    <span class="hud-val-text">${b.q.toFixed(2)}</span>
                    <button class="btn-hud-nudge btn-q-up">+</button>
                </div>
            </div>

            <div class="hud-actions-divider"></div>

            <button class="btn-hud-action btn-bypass-band ${b.enabled ? '' : 'bypassed'}" title="Toggle Band Bypass">
                ${b.enabled ? '⚡ ON' : '✕ OFF'}
            </button>

            <button class="btn-hud-close" title="Close Inspector">✕</button>
        `;

        // Wire HUD Event Listeners
        this.hudElement.querySelectorAll('.btn-hud-shape').forEach(btn => {
            btn.addEventListener('click', () => {
                const shape = btn.getAttribute('data-shape');
                b.type = shape;
                this.emitBandChange(bandIndex);
                this.updateHudContent(bandIndex);
                this.draw();
            });
        });

        const nudge = (prop, delta, min, max, step = 1) => {
            b[prop] = Math.max(min, Math.min(max, Math.round((b[prop] + delta) * 10) / 10));
            this.emitBandChange(bandIndex);
            this.updateHudContent(bandIndex);
            this.positionHud(bandIndex);
            this.draw();
        };

        this.hudElement.querySelector('.btn-freq-down').addEventListener('click', () => nudge('freq', -Math.max(10, b.freq * 0.08), 20, 20000));
        this.hudElement.querySelector('.btn-freq-up').addEventListener('click', () => nudge('freq', Math.max(10, b.freq * 0.08), 20, 20000));
        this.hudElement.querySelector('.btn-gain-down').addEventListener('click', () => nudge('gainDb', -0.5, -18, 18));
        this.hudElement.querySelector('.btn-gain-up').addEventListener('click', () => nudge('gainDb', 0.5, -18, 18));
        this.hudElement.querySelector('.btn-q-down').addEventListener('click', () => nudge('q', -0.2, 0.2, 18.0));
        this.hudElement.querySelector('.btn-q-up').addEventListener('click', () => nudge('q', 0.2, 0.2, 18.0));

        this.hudElement.querySelector('.btn-bypass-band').addEventListener('click', () => {
            b.enabled = !b.enabled;
            this.emitBandChange(bandIndex);
            this.updateHudContent(bandIndex);
            this.draw();
        });

        this.hudElement.querySelector('.btn-hud-close').addEventListener('click', () => {
            this.hideHud();
            this.activeBandIndex = -1;
            this.draw();
        });
    }

    draw() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;

        if (!w || !h) return;

        ctx.clearRect(0, 0, w, h);

        // 1. Logarithmic Frequency Grid & Markings
        const majorFreqs = [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000];
        const minorFreqs = [30, 40, 60, 70, 80, 90, 150, 200, 300, 400, 700, 800, 900, 1500, 2000, 3000, 4000, 7000, 8000, 15000];

        // Minor lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const f of minorFreqs) {
            const x = this.freqToX(f);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        ctx.stroke();

        // Major lines & labels
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';

        for (const f of majorFreqs) {
            const x = this.freqToX(f);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h - 16);
            ctx.stroke();

            const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
            ctx.fillText(label, x, h - 4);
        }

        // 2. Horizontal Decibel Grid Lines
        const dbMarks = [18, 12, 6, 0, -6, -12, -18];
        ctx.textAlign = 'left';
        for (const db of dbMarks) {
            const y = this.dbToY(db);
            ctx.strokeStyle = (db === 0) ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = (db === 0) ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            if (db !== 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.fillText(`${db > 0 ? '+' : ''}${db} dB`, 8, y - 3);
            }
        }

        // Center 0 dB label
        const zeroY = this.dbToY(0);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText('0 dB', 8, zeroY - 3);

        // 3. Continuous Compound EQ Curve
        const points = 256;
        const curveCoords = [];

        for (let i = 0; i <= points; i++) {
            const x = (i / points) * w;
            const f = this.xToFreq(x);
            const db = this.evalCompoundResponse(f);
            const y = this.dbToY(db);
            curveCoords.push({ x, y });
        }

        // Gradient Area Fill under Curve
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(curveCoords[0].x, zeroY);
        for (const pt of curveCoords) {
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.lineTo(curveCoords[curveCoords.length - 1].x, zeroY);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
        grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.15)');
        grad.addColorStop(1, 'rgba(168, 85, 247, 0.05)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // Main Curve Stroke
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(curveCoords[0].x, curveCoords[0].y);
        for (let i = 1; i < curveCoords.length; i++) {
            ctx.lineTo(curveCoords[i].x, curveCoords[i].y);
        }
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();

        // 4. Interactive Pro EQ Draggable Band Nodes
        for (let i = 0; i < this.bands.length; i++) {
            const b = this.bands[i];
            const x = this.freqToX(b.freq);
            const y = this.dbToY(b.gainDb);

            const isHover = (i === this.hoverBandIndex);
            const isActive = (i === this.activeBandIndex);

            // Draw Q bandwidth ring
            if (isHover || isActive) {
                const octWidth = Math.max(16, Math.min(120, 48 / Math.max(0.4, b.q)));
                ctx.save();
                ctx.beginPath();
                ctx.ellipse(x, y, octWidth, 14, 0, 0, Math.PI * 2);
                ctx.strokeStyle = b.color;
                ctx.fillStyle = `${b.color}15`;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.stroke();
                ctx.fill();
                ctx.restore();

                // Crosshairs
                ctx.save();
                ctx.strokeStyle = `${b.color}50`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, 0); ctx.lineTo(x, h);
                ctx.moveTo(0, y); ctx.lineTo(w, y);
                ctx.stroke();
                ctx.restore();
            }

            // Outer Glowing Ring
            ctx.save();
            ctx.beginPath();
            const radius = (isActive || isHover) ? 14 : 11;
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = b.enabled ? b.color : '#475569';
            ctx.shadowColor = b.enabled ? b.color : 'transparent';
            ctx.shadowBlur = (isActive || isHover) ? 14 : 6;
            ctx.fill();

            // Inner dark puck with band number
            ctx.beginPath();
            ctx.arc(x, y, radius - 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#0b0f19';
            ctx.fill();

            // Band Number Label
            ctx.fillStyle = b.enabled ? '#ffffff' : '#94a3b8';
            ctx.font = 'bold 10px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${i + 1}`, x, y);
            ctx.restore();
        }
    }
}
