/**
 * Modular Mastering Rack View
 * Renders interactive rackmount processing modules, visual chain flow,
 * module reordering, addition/removal, parameter knobs & faders.
 */

export class ModularRackView {
    constructor(containerElement, rackEngine, callbacks = {}) {
        this.container = containerElement;
        this.rack = rackEngine;
        this.callbacks = {
            onChainModified: () => {},
            onParamChanged: () => {},
            ...callbacks
        };

        this.grUpdateAnimationFrame = null;
        this.render();
        this.startTelemetryLoop();
    }

    setRackEngine(rackEngine) {
        this.rack = rackEngine;
        this.render();
    }

    render() {
        if (!this.container || !this.rack) return;
        this.container.innerHTML = '';

        // 1. Rack Header & Signal Chain Navigation
        const header = document.createElement('div');
        header.className = 'rack-section-header';
        header.innerHTML = `
            <div class="rack-header-left">
                <div class="rack-title-row">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <h3>Modular Mastering Chain & Processor Rack</h3>
                </div>
                <p class="rack-subtitle">Fine-tune individual processors, add/remove modules, reorder the signal chain, or apply automated reference matching.</p>
            </div>
            <div class="rack-header-actions">
                <div class="add-module-wrapper">
                    <button class="btn btn-primary btn-add-module" id="btn-add-module-dropdown">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        + Add Processor
                    </button>
                    <div class="add-module-menu" id="add-module-menu">
                        <div class="menu-item" data-type="parametric_eq">
                            <span class="menu-icon">🎚</span>
                            <div>
                                <div class="menu-title">Parametric Match EQ</div>
                                <div class="menu-desc">7-band precision spectral shaping</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="multiband_compressor">
                            <span class="menu-icon">🎛</span>
                            <div>
                                <div class="menu-title">4-Band Multi-Channel Compressor</div>
                                <div class="menu-desc">Split-band dynamics with M/S matrix & solo</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="master_compressor">
                            <span class="menu-icon">⚡</span>
                            <div>
                                <div class="menu-title">VCA Master Compressor</div>
                                <div class="menu-desc">Dynamic punch & glue compression</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="opto_compressor">
                            <span class="menu-icon">🎛</span>
                            <div>
                                <div class="menu-title">Opto Warmth Compressor</div>
                                <div class="menu-desc">Smooth vintage leveling & peak control</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="tube_saturator">
                            <span class="menu-icon">🔥</span>
                            <div>
                                <div class="menu-title">Analog Tube Warmth</div>
                                <div class="menu-desc">Harmonic excitement & tape saturation</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="stereo_imager">
                            <span class="menu-icon">🌐</span>
                            <div>
                                <div class="menu-title">Stereo Imager & Widener</div>
                                <div class="menu-desc">M/S stereo widening & mono bass focus</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="lookahead_limiter">
                            <span class="menu-icon">🛡</span>
                            <div>
                                <div class="menu-title">True-Peak Brickwall Limiter</div>
                                <div class="menu-desc">Zero-overshoot ceiling & loudness maximize</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.container.appendChild(header);

        // 2. Interactive Signal Flow Patchway Highway
        const highway = document.createElement('div');
        highway.className = 'signal-patch-highway';
        
        let highwayHtml = `
            <div class="patch-io-port patch-in">
                <span class="io-dot in-dot"></span>
                <span class="io-text">TARGET IN</span>
            </div>
        `;

        this.rack.modules.forEach((mod, idx) => {
            highwayHtml += `
                <div class="patch-conduit-cable">
                    <div class="cable-wire"></div>
                    <div class="cable-pulse"></div>
                </div>
                <div class="patch-node-plug ${mod.bypassed ? 'plug-bypassed' : 'plug-active'}" draggable="true" data-index="${idx}" title="Drag node to reorder • Click LED to bypass">
                    <div class="plug-pin"></div>
                    <div class="plug-body">
                        <span class="plug-led ${mod.bypassed ? 'dot-off' : 'dot-on'}"></span>
                        <span class="plug-icon">${this.getModuleIcon(mod.type)}</span>
                        <div class="plug-text">
                            <span class="plug-index">#0${idx + 1}</span>
                            <span class="plug-name">${mod.title}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        highwayHtml += `
            <div class="patch-conduit-cable">
                <div class="cable-wire"></div>
                <div class="cable-pulse"></div>
            </div>
            <div class="patch-io-port patch-out">
                <span class="io-dot out-dot"></span>
                <span class="io-text">MASTER OUT</span>
            </div>
        `;

        highway.innerHTML = highwayHtml;

        // Wire drag and drop on patch highway nodes
        highway.querySelectorAll('.patch-node-plug').forEach(node => {
            const idx = parseInt(node.getAttribute('data-index'), 10);
            
            // Bypass toggle on plug LED
            const led = node.querySelector('.plug-led');
            if (led) {
                led.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const mod = this.rack.modules[idx];
                    if (mod) {
                        this.rack.setModuleBypass(mod.id, !mod.bypassed);
                        this.render();
                        this.callbacks.onChainModified();
                    }
                });
            }

            node.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', String(idx));
                e.dataTransfer.effectAllowed = 'move';
                node.classList.add('is-dragging');
            });

            node.addEventListener('dragend', () => {
                node.classList.remove('is-dragging');
                highway.querySelectorAll('.patch-node-plug').forEach(n => n.classList.remove('drag-over-target'));
            });

            node.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                node.classList.add('drag-over-target');
            });

            node.addEventListener('dragleave', () => {
                node.classList.remove('drag-over-target');
            });

            node.addEventListener('drop', (e) => {
                e.preventDefault();
                node.classList.remove('drag-over-target');
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIndex = idx;
                if (!isNaN(fromIndex) && fromIndex !== toIndex) {
                    this.rack.reorderModule(fromIndex, toIndex);
                    this.render();
                    this.callbacks.onChainModified();
                }
            });
        });

        this.container.appendChild(highway);

        // 3. Modules Container Grid
        const modulesContainer = document.createElement('div');
        modulesContainer.className = 'rack-modules-list';

        this.rack.modules.forEach((mod, idx) => {
            const card = this.renderModuleCard(mod, idx, this.rack.modules.length);
            modulesContainer.appendChild(card);
        });

        this.container.appendChild(modulesContainer);
        this.attachHeaderListeners();
    }

    getModuleCode(type) {
        switch (type) {
            case 'parametric_eq': return 'M-101 // MATCH EQ';
            case 'multiband_compressor': return 'M-204 // QUAD-BAND DYNAMICS';
            case 'master_compressor': return 'M-301 // VCA BUS COMPRESSOR';
            case 'opto_compressor': return 'M-302 // OPTO-CELL LEVELER';
            case 'tube_saturator': return 'M-401 // HARMONIC TUBE SATURATOR';
            case 'stereo_imager': return 'M-501 // STEREO MATRIX & BASS';
            case 'lookahead_limiter': return 'M-601 // TRUE-PEAK BRICKWALL';
            default: return 'M-000 // DSP MODULE';
        }
    }

    getModuleIcon(type) {
        switch (type) {
            case 'parametric_eq': return '🎚';
            case 'multiband_compressor': return '🎛';
            case 'master_compressor': return '⚡';
            case 'opto_compressor': return '💡';
            case 'tube_saturator': return '🔥';
            case 'stereo_imager': return '🌐';
            case 'lookahead_limiter': return '🛡';
            default: return '⚙';
        }
    }

    attachHeaderListeners() {
        const btnAdd = this.container.querySelector('#btn-add-module-dropdown');
        const menu = this.container.querySelector('#add-module-menu');

        if (btnAdd && menu) {
            btnAdd.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('open');
            });

            document.addEventListener('click', () => {
                menu.classList.remove('open');
            });

            menu.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const type = item.getAttribute('data-type');
                    this.rack.addModule(type);
                    this.render();
                    this.callbacks.onChainModified();
                });
            });
        }
    }

    renderModuleCard(mod, index, totalCount) {
        const card = document.createElement('div');
        card.className = `rack-module-card ${mod.bypassed ? 'is-bypassed' : ''} type-${mod.type}`;
        card.id = `rack-card-${mod.id}`;
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-index', String(index));

        // Rack Ear Left with hex screws
        const earLeft = document.createElement('div');
        earLeft.className = 'rack-ear rack-ear-left';
        earLeft.innerHTML = `
            <div class="rack-bolt"></div>
            <div class="rack-bolt"></div>
        `;
        card.appendChild(earLeft);

        // Rack Card Chassis Inner
        const chassis = document.createElement('div');
        chassis.className = 'rack-card-chassis';

        // Module Header
        const cardHeader = document.createElement('div');
        cardHeader.className = 'module-card-header';
        cardHeader.innerHTML = `
            <div class="module-header-left">
                <!-- Tactile Knurled Drag Handle -->
                <div class="rack-drag-grip" title="Drag to reorder processor in mastering chain">
                    <span class="grip-line"></span>
                    <span class="grip-line"></span>
                    <span class="grip-line"></span>
                </div>

                <!-- Industrial Broadcast Rocker Switch -->
                <button class="btn-module-power ${mod.bypassed ? '' : 'power-on'}" title="${mod.bypassed ? 'Engage Module' : 'Bypass Module'}">
                    <span class="power-led ${mod.bypassed ? 'led-off' : 'led-on'}"></span>
                    <span class="power-label">${mod.bypassed ? 'BYPASS' : 'ACTIVE'}</span>
                </button>

                <div class="module-index-badge">#0${index + 1}</div>
                
                <div class="module-title-box">
                    <h4 class="module-title">${mod.title}</h4>
                    <span class="module-serial">${this.getModuleCode(mod.type)}</span>
                </div>
            </div>
            <div class="module-header-right">
                <button class="btn-rack-nav btn-move-left" ${index === 0 ? 'disabled' : ''} title="Move Earlier in Chain">◀</button>
                <button class="btn-rack-nav btn-move-right" ${index === totalCount - 1 ? 'disabled' : ''} title="Move Later in Chain">▶</button>
                <button class="btn-rack-nav btn-delete-module" title="Remove Processor from Chain">✕</button>
            </div>
        `;

        // Power toggle
        const btnPower = cardHeader.querySelector('.btn-module-power');
        btnPower.addEventListener('click', () => {
            const nextBypass = !mod.bypassed;
            this.rack.setModuleBypass(mod.id, nextBypass);
            this.render();
            this.callbacks.onChainModified();
        });

        // Move Left / Up
        const btnLeft = cardHeader.querySelector('.btn-move-left');
        btnLeft.addEventListener('click', () => {
            this.rack.moveModule(mod.id, 'left');
            this.render();
            this.callbacks.onChainModified();
        });

        // Move Right / Down
        const btnRight = cardHeader.querySelector('.btn-move-right');
        btnRight.addEventListener('click', () => {
            this.rack.moveModule(mod.id, 'right');
            this.render();
            this.callbacks.onChainModified();
        });

        // Delete
        const btnDel = cardHeader.querySelector('.btn-delete-module');
        btnDel.addEventListener('click', () => {
            if (confirm(`Remove ${mod.title} from mastering chain?`)) {
                this.rack.removeModule(mod.id);
                this.render();
                this.callbacks.onChainModified();
            }
        });

        chassis.appendChild(cardHeader);

        // Drag and drop event listeners on rack card
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', String(index));
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('is-dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('is-dragging');
            this.container.querySelectorAll('.rack-module-card').forEach(c => c.classList.remove('drag-over-target'));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.classList.add('drag-over-target');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over-target');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over-target');
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIndex = index;
            if (!isNaN(fromIndex) && fromIndex !== toIndex) {
                this.rack.reorderModule(fromIndex, toIndex);
                this.render();
                this.callbacks.onChainModified();
            }
        });

        // Module Body / Controls
        const cardBody = document.createElement('div');
        cardBody.className = 'module-card-body';

        switch (mod.type) {
            case 'parametric_eq':
                this.renderParametricEqControls(cardBody, mod);
                break;
            case 'multiband_compressor':
                this.renderMultibandCompressorControls(cardBody, mod);
                break;
            case 'master_compressor':
                this.renderMasterCompressorControls(cardBody, mod);
                break;
            case 'opto_compressor':
                this.renderOptoCompressorControls(cardBody, mod);
                break;
            case 'tube_saturator':
                this.renderTubeSaturatorControls(cardBody, mod);
                break;
            case 'stereo_imager':
                this.renderStereoImagerControls(cardBody, mod);
                break;
            case 'lookahead_limiter':
                this.renderLimiterControls(cardBody, mod);
                break;
        }

        chassis.appendChild(cardBody);
        card.appendChild(chassis);

        // Rack Ear Right with hex screws
        const earRight = document.createElement('div');
        earRight.className = 'rack-ear rack-ear-right';
        earRight.innerHTML = `
            <div class="rack-bolt"></div>
            <div class="rack-bolt"></div>
        `;
        card.appendChild(earRight);

        return card;
    }

    renderParametricEqControls(container, mod) {
        const topRow = document.createElement('div');
        topRow.className = 'mod-controls-row eq-meta-row';
        topRow.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Match Amount</span>
                    <span class="unit-val" id="val-${mod.id}-match">${Math.round(mod.params.matchAmount * 100)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="150" value="${Math.round(mod.params.matchAmount * 100)}" id="sl-${mod.id}-match">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Curve Smoothing</span>
                    <span class="unit-val" id="val-${mod.id}-smooth">${Math.round(mod.params.smoothing * 100)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" value="${Math.round(mod.params.smoothing * 100)}" id="sl-${mod.id}-smooth">
            </div>
        `;

        topRow.querySelector(`#sl-${mod.id}-match`).addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            topRow.querySelector(`#val-${mod.id}-match`).textContent = `${val}%`;
            mod.setParam('matchAmount', val / 100);
            this.callbacks.onParamChanged(mod.id, 'matchAmount', val / 100);
        });

        container.appendChild(topRow);

        // Render 7 Interactive Frequency Bands
        const bandsGrid = document.createElement('div');
        bandsGrid.className = 'eq-bands-grid';

        const bandLabels = ['Sub (40Hz)', 'Low (120Hz)', 'Low-Mid (350Hz)', 'Mid (1kHz)', 'High-Mid (3.2kHz)', 'Presence (6.5kHz)', 'Air (12kHz)'];

        mod.params.bands.forEach((b, idx) => {
            const bandCol = document.createElement('div');
            bandCol.className = 'eq-band-col';
            bandCol.innerHTML = `
                <div class="band-tag">${bandLabels[idx] || `${b.freq}Hz`}</div>
                <div class="band-gain-badge" id="badge-${mod.id}-b${idx}">${b.gain > 0 ? '+' : ''}${b.gain.toFixed(1)}\u00A0dB</div>
                <input type="range" class="styled-slider vertical-slider" min="-12" max="12" step="0.5" value="${b.gain}" id="sl-${mod.id}-b${idx}">
                <button class="band-bypass-btn ${b.enabled ? 'active' : ''}" id="btn-${mod.id}-b${idx}">${b.enabled ? 'ON' : 'OFF'}</button>
            `;

            const sl = bandCol.querySelector(`#sl-${mod.id}-b${idx}`);
            const badge = bandCol.querySelector(`#badge-${mod.id}-b${idx}`);
            sl.addEventListener('input', (e) => {
                const g = parseFloat(e.target.value);
                badge.textContent = `${g > 0 ? '+' : ''}${g.toFixed(1)}\u00A0dB`;
                mod.setParam('bandGain', { bandIndex: idx, gain: g });
                this.callbacks.onParamChanged(mod.id, 'bandGain', { bandIndex: idx, gain: g });
            });

            const btn = bandCol.querySelector(`#btn-${mod.id}-b${idx}`);
            btn.addEventListener('click', () => {
                b.enabled = !b.enabled;
                btn.classList.toggle('active', b.enabled);
                btn.textContent = b.enabled ? 'ON' : 'OFF';
                mod.setParam('bandToggle', { bandIndex: idx, enabled: b.enabled });
                this.callbacks.onParamChanged(mod.id, 'bandToggle', { bandIndex: idx, enabled: b.enabled });
            });

            bandsGrid.appendChild(bandCol);
        });

        container.appendChild(bandsGrid);
    }

    renderMasterCompressorControls(container, mod) {
        const grid = document.createElement('div');
        grid.className = 'mod-controls-row comp-controls-grid';
        grid.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Threshold</span>
                    <span class="unit-val" id="val-${mod.id}-thresh">${mod.params.threshold.toFixed(1)}\u00A0dB</span>
                </div>
                <input type="range" class="styled-slider" min="-40" max="0" step="0.5" value="${mod.params.threshold}" id="sl-${mod.id}-thresh">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Ratio</span>
                    <span class="unit-val" id="val-${mod.id}-ratio">${mod.params.ratio.toFixed(1)}:1</span>
                </div>
                <input type="range" class="styled-slider" min="1" max="15" step="0.1" value="${mod.params.ratio}" id="sl-${mod.id}-ratio">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Attack</span>
                    <span class="unit-val" id="val-${mod.id}-att">${mod.params.attack.toFixed(0)} ms</span>
                </div>
                <input type="range" class="styled-slider" min="1" max="100" step="1" value="${mod.params.attack}" id="sl-${mod.id}-att">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Release</span>
                    <span class="unit-val" id="val-${mod.id}-rel">${mod.params.release.toFixed(0)} ms</span>
                </div>
                <input type="range" class="styled-slider" min="10" max="800" step="5" value="${mod.params.release}" id="sl-${mod.id}-rel">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Makeup</span>
                    <span class="unit-val" id="val-${mod.id}-makeup">+${mod.params.makeup.toFixed(1)}\u00A0dB</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="12" step="0.5" value="${mod.params.makeup}" id="sl-${mod.id}-makeup">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Mix / Parallel</span>
                    <span class="unit-val" id="val-${mod.id}-mix">${mod.params.mix.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" step="1" value="${mod.params.mix}" id="sl-${mod.id}-mix">
            </div>
        `;

        // Telemetry meter bar
        const grRow = document.createElement('div');
        grRow.className = 'comp-telemetry-row';
        grRow.innerHTML = `
            <span class="gr-label">GAIN REDUCTION:</span>
            <div class="gr-meter-track">
                <div class="gr-meter-fill" id="meter-fill-${mod.id}"></div>
            </div>
            <span class="gr-value" id="meter-val-${mod.id}">0.0\u00A0dB</span>
        `;
        container.appendChild(grid);
        container.appendChild(grRow);

        // Bind sliders
        const bindSlider = (id, param, format) => {
            const sl = grid.querySelector(`#sl-${mod.id}-${id}`);
            const valEl = grid.querySelector(`#val-${mod.id}-${id}`);
            sl.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                valEl.textContent = format(v);
                mod.setParam(param, v);
                this.callbacks.onParamChanged(mod.id, param, v);
            });
        };

        bindSlider('thresh', 'threshold', v => `${v.toFixed(1)}\u00A0dB`);
        bindSlider('ratio', 'ratio', v => `${v.toFixed(1)}:1`);
        bindSlider('att', 'attack', v => `${v.toFixed(0)} ms`);
        bindSlider('rel', 'release', v => `${v.toFixed(0)} ms`);
        bindSlider('makeup', 'makeup', v => `+${v.toFixed(1)}\u00A0dB`);
        bindSlider('mix', 'mix', v => `${v.toFixed(0)}%`);
    }

    renderOptoCompressorControls(container, mod) {
        const grid = document.createElement('div');
        grid.className = 'mod-controls-row';
        grid.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Peak Reduction</span>
                    <span class="unit-val" id="val-${mod.id}-pr">${mod.params.peakReduction.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" step="1" value="${mod.params.peakReduction}" id="sl-${mod.id}-pr">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Output Gain</span>
                    <span class="unit-val" id="val-${mod.id}-makeup">+${mod.params.makeup.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="15" step="0.5" value="${mod.params.makeup}" id="sl-${mod.id}-makeup">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Dry/Wet Mix</span>
                    <span class="unit-val" id="val-${mod.id}-mix">${mod.params.mix.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" step="1" value="${mod.params.mix}" id="sl-${mod.id}-mix">
            </div>
        `;
        container.appendChild(grid);

        const bindSlider = (id, param, format) => {
            const sl = grid.querySelector(`#sl-${mod.id}-${id}`);
            const valEl = grid.querySelector(`#val-${mod.id}-${id}`);
            sl.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                valEl.textContent = format(v);
                mod.setParam(param, v);
                this.callbacks.onParamChanged(mod.id, param, v);
            });
        };

        bindSlider('pr', 'peakReduction', v => `${v.toFixed(0)}%`);
        bindSlider('makeup', 'makeup', v => `+${v.toFixed(1)} dB`);
        bindSlider('mix', 'mix', v => `${v.toFixed(0)}%`);
    }

    renderTubeSaturatorControls(container, mod) {
        const grid = document.createElement('div');
        grid.className = 'mod-controls-row';
        grid.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Drive (Warmth)</span>
                    <span class="unit-val" id="val-${mod.id}-drive">+${mod.params.drive.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="40" step="0.5" value="${mod.params.drive}" id="sl-${mod.id}-drive">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Harmonics Color</span>
                    <span class="unit-val" id="val-${mod.id}-warmth">${mod.params.warmth.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" step="1" value="${mod.params.warmth}" id="sl-${mod.id}-warmth">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Output Trim</span>
                    <span class="unit-val" id="val-${mod.id}-out">${mod.params.outputGain.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="-12" max="6" step="0.5" value="${mod.params.outputGain}" id="sl-${mod.id}-out">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Mix</span>
                    <span class="unit-val" id="val-${mod.id}-mix">${mod.params.mix.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" step="1" value="${mod.params.mix}" id="sl-${mod.id}-mix">
            </div>
        `;
        container.appendChild(grid);

        const bindSlider = (id, param, format) => {
            const sl = grid.querySelector(`#sl-${mod.id}-${id}`);
            const valEl = grid.querySelector(`#val-${mod.id}-${id}`);
            sl.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                valEl.textContent = format(v);
                mod.setParam(param, v);
                this.callbacks.onParamChanged(mod.id, param, v);
            });
        };

        bindSlider('drive', 'drive', v => `+${v.toFixed(1)} dB`);
        bindSlider('warmth', 'warmth', v => `${v.toFixed(0)}%`);
        bindSlider('out', 'outputGain', v => `${v.toFixed(1)} dB`);
        bindSlider('mix', 'mix', v => `${v.toFixed(0)}%`);
    }

    renderStereoImagerControls(container, mod) {
        const grid = document.createElement('div');
        grid.className = 'mod-controls-row';
        grid.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Stereo Width</span>
                    <span class="unit-val" id="val-${mod.id}-width">${mod.params.width.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="200" step="1" value="${mod.params.width}" id="sl-${mod.id}-width">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Mono Bass Cutoff</span>
                    <span class="unit-val" id="val-${mod.id}-bass">${mod.params.monoBassFreq.toFixed(0)} Hz</span>
                </div>
                <input type="range" class="styled-slider" min="40" max="200" step="2" value="${mod.params.monoBassFreq}" id="sl-${mod.id}-bass">
            </div>
        `;
        container.appendChild(grid);

        const bindSlider = (id, param, format) => {
            const sl = grid.querySelector(`#sl-${mod.id}-${id}`);
            const valEl = grid.querySelector(`#val-${mod.id}-${id}`);
            sl.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                valEl.textContent = format(v);
                mod.setParam(param, v);
                this.callbacks.onParamChanged(mod.id, param, v);
            });
        };

        bindSlider('width', 'width', v => `${v.toFixed(0)}%`);
        bindSlider('bass', 'monoBassFreq', v => `${v.toFixed(0)} Hz`);
    }

    renderLimiterControls(container, mod) {
        const grid = document.createElement('div');
        grid.className = 'mod-controls-row';
        grid.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Ceiling</span>
                    <span class="unit-val" id="val-${mod.id}-ceil">${mod.params.ceiling.toFixed(1)}\u00A0dB</span>
                </div>
                <input type="range" class="styled-slider" min="-3.0" max="0.0" step="0.1" value="${mod.params.ceiling}" id="sl-${mod.id}-ceil">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Input Drive</span>
                    <span class="unit-val" id="val-${mod.id}-drive">+${mod.params.drive.toFixed(1)}\u00A0dB</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="10" step="0.5" value="${mod.params.drive}" id="sl-${mod.id}-drive">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Release</span>
                    <span class="unit-val" id="val-${mod.id}-rel">${mod.params.release.toFixed(0)} ms</span>
                </div>
                <input type="range" class="styled-slider" min="10" max="400" step="5" value="${mod.params.release}" id="sl-${mod.id}-rel">
            </div>
        `;

        const grRow = document.createElement('div');
        grRow.className = 'comp-telemetry-row';
        grRow.innerHTML = `
            <span class="gr-label">LIMITER REDUCTION:</span>
            <div class="gr-meter-track">
                <div class="gr-meter-fill" id="meter-fill-${mod.id}" style="background: var(--color-danger, #ef4444);"></div>
            </div>
            <span class="gr-value" id="meter-val-${mod.id}">0.0\u00A0dB</span>
        `;

        container.appendChild(grid);
        container.appendChild(grRow);

        const bindSlider = (id, param, format) => {
            const sl = grid.querySelector(`#sl-${mod.id}-${id}`);
            const valEl = grid.querySelector(`#val-${mod.id}-${id}`);
            sl.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                valEl.textContent = format(v);
                mod.setParam(param, v);
                this.callbacks.onParamChanged(mod.id, param, v);
            });
        };

        bindSlider('ceil', 'ceiling', v => `${v.toFixed(1)}\u00A0dB`);
        bindSlider('drive', 'drive', v => `+${v.toFixed(1)}\u00A0dB`);
        bindSlider('rel', 'release', v => `${v.toFixed(0)} ms`);
    }

    renderMultibandCompressorControls(container, mod) {
        // Mode selector & Mix bar
        const topRow = document.createElement('div');
        topRow.className = 'multiband-meta-row';
        topRow.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Processing Mode</span>
                </div>
                <div class="channel-mode-toggle">
                    <button class="btn-channel-mode ${mod.params.channelMode === 'stereo' ? 'active' : ''}" id="btn-${mod.id}-mode-stereo">Stereo (L/R)</button>
                    <button class="btn-channel-mode ${mod.params.channelMode === 'mid_side' ? 'active' : ''}" id="btn-${mod.id}-mode-ms">Mid / Side (M/S)</button>
                </div>
            </div>
            <div class="control-unit" style="min-width: 160px;">
                <div class="unit-label-row">
                    <span class="unit-name">Parallel Mix</span>
                    <span class="unit-val" id="val-${mod.id}-mix">${mod.params.mix}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" value="${mod.params.mix}" id="sl-${mod.id}-mix">
            </div>
        `;

        const btnStereo = topRow.querySelector(`#btn-${mod.id}-mode-stereo`);
        const btnMs = topRow.querySelector(`#btn-${mod.id}-mode-ms`);
        btnStereo.addEventListener('click', () => {
            mod.setParam('channelMode', 'stereo');
            btnStereo.classList.add('active');
            btnMs.classList.remove('active');
            this.callbacks.onParamChanged(mod.id, 'channelMode', 'stereo');
        });
        btnMs.addEventListener('click', () => {
            mod.setParam('channelMode', 'mid_side');
            btnMs.classList.add('active');
            btnStereo.classList.remove('active');
            this.callbacks.onParamChanged(mod.id, 'channelMode', 'mid_side');
        });

        const slMix = topRow.querySelector(`#sl-${mod.id}-mix`);
        const valMix = topRow.querySelector(`#val-${mod.id}-mix`);
        slMix.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10);
            valMix.textContent = `${v}%`;
            mod.setParam('mix', v);
            this.callbacks.onParamChanged(mod.id, 'mix', v);
        });

        container.appendChild(topRow);

        // 4 Bands Channel Strips Grid
        const bandsGrid = document.createElement('div');
        bandsGrid.className = 'multiband-strips-grid';

        const bandThemeColors = ['#0284c7', '#d97706', '#10b981', '#a855f7'];

        mod.params.bands.forEach((b, idx) => {
            const strip = document.createElement('div');
            strip.className = `multiband-strip ${b.bypassed ? 'band-bypassed' : ''} ${b.solo ? 'band-soloed' : ''}`;
            strip.style.setProperty('--band-color', bandThemeColors[idx]);

            strip.innerHTML = `
                <div class="strip-header">
                    <div class="strip-title-row">
                        <span class="strip-name">${b.name}</span>
                        <span class="strip-range">${b.range}</span>
                    </div>
                    <div class="strip-actions">
                        <button class="btn-band-action btn-solo ${b.solo ? 'active' : ''}" id="btn-${mod.id}-s${idx}" title="Solo Band">S</button>
                        <button class="btn-band-action btn-bypass ${b.bypassed ? 'active' : ''}" id="btn-${mod.id}-b${idx}" title="Bypass Band">B</button>
                    </div>
                </div>

                <!-- Per-band GR Meter -->
                <div class="strip-meter-row">
                    <span class="strip-meter-label">GR</span>
                    <div class="strip-meter-track">
                        <div class="strip-meter-fill" id="meter-fill-${mod.id}-b${idx}"></div>
                    </div>
                    <span class="strip-meter-val" id="meter-val-${mod.id}-b${idx}">0.0\u00A0dB</span>
                </div>

                <!-- Band Controls -->
                <div class="strip-controls">
                    <div class="strip-unit">
                        <div class="unit-label-row">
                            <span class="unit-name">Threshold</span>
                            <span class="unit-val" id="val-${mod.id}-th${idx}">${b.threshold.toFixed(1)}\u00A0dB</span>
                        </div>
                        <input type="range" class="styled-slider" min="-40" max="0" step="0.5" value="${b.threshold}" id="sl-${mod.id}-th${idx}">
                    </div>

                    <div class="strip-unit">
                        <div class="unit-label-row">
                            <span class="unit-name">Ratio</span>
                            <span class="unit-val" id="val-${mod.id}-rt${idx}">${b.ratio.toFixed(1)}:1</span>
                        </div>
                        <input type="range" class="styled-slider" min="1.0" max="10.0" step="0.2" value="${b.ratio}" id="sl-${mod.id}-rt${idx}">
                    </div>

                    <div class="strip-unit-pair">
                        <div class="strip-unit">
                            <div class="unit-label-row">
                                <span class="unit-name">Attack</span>
                                <span class="unit-val" id="val-${mod.id}-at${idx}">${b.attack}ms</span>
                            </div>
                            <input type="range" class="styled-slider" min="0.1" max="80" step="0.5" value="${b.attack}" id="sl-${mod.id}-at${idx}">
                        </div>
                        <div class="strip-unit">
                            <div class="unit-label-row">
                                <span class="unit-name">Release</span>
                                <span class="unit-val" id="val-${mod.id}-rl${idx}">${b.release}ms</span>
                            </div>
                            <input type="range" class="styled-slider" min="10" max="600" step="5" value="${b.release}" id="sl-${mod.id}-rl${idx}">
                        </div>
                    </div>

                    <div class="strip-unit">
                        <div class="unit-label-row">
                            <span class="unit-name">Makeup Gain</span>
                            <span class="unit-val" id="val-${mod.id}-mu${idx}">${b.makeup > 0 ? '+' : ''}${b.makeup.toFixed(1)}\u00A0dB</span>
                        </div>
                        <input type="range" class="styled-slider" min="-6" max="12" step="0.5" value="${b.makeup}" id="sl-${mod.id}-mu${idx}">
                    </div>
                </div>
            `;

            // Wire listeners
            const btnS = strip.querySelector(`#btn-${mod.id}-s${idx}`);
            btnS.addEventListener('click', () => {
                b.solo = !b.solo;
                btnS.classList.toggle('active', b.solo);
                strip.classList.toggle('band-soloed', b.solo);
                mod.setParam('bandSolo', { bandIndex: idx, solo: b.solo });
                this.callbacks.onParamChanged(mod.id, 'bandSolo', { bandIndex: idx, solo: b.solo });
            });

            const btnB = strip.querySelector(`#btn-${mod.id}-b${idx}`);
            btnB.addEventListener('click', () => {
                b.bypassed = !b.bypassed;
                btnB.classList.toggle('active', b.bypassed);
                strip.classList.toggle('band-bypassed', b.bypassed);
                mod.setParam('bandBypass', { bandIndex: idx, bypassed: b.bypassed });
                this.callbacks.onParamChanged(mod.id, 'bandBypass', { bandIndex: idx, bypassed: b.bypassed });
            });

            const bindBandSlider = (ctrlId, param, format) => {
                const sl = strip.querySelector(`#sl-${mod.id}-${ctrlId}${idx}`);
                const valEl = strip.querySelector(`#val-${mod.id}-${ctrlId}${idx}`);
                sl.addEventListener('input', (e) => {
                    const v = parseFloat(e.target.value);
                    valEl.textContent = format(v);
                    const propKey = param.replace('band', '').toLowerCase();
                    mod.setParam(param, { bandIndex: idx, [propKey]: v });
                    this.callbacks.onParamChanged(mod.id, param, { bandIndex: idx, value: v });
                });
            };

            bindBandSlider('th', 'bandThreshold', v => `${v.toFixed(1)}\u00A0dB`);
            bindBandSlider('rt', 'bandRatio', v => `${v.toFixed(1)}:1`);
            bindBandSlider('at', 'bandAttack', v => `${v.toFixed(0)} ms`);
            bindBandSlider('rl', 'bandRelease', v => `${v.toFixed(0)} ms`);
            bindBandSlider('mu', 'bandMakeup', v => `${v > 0 ? '+' : ''}${v.toFixed(1)}\u00A0dB`);

            bandsGrid.appendChild(strip);
        });

        container.appendChild(bandsGrid);
    }

    startTelemetryLoop() {
        if (this.grUpdateAnimationFrame) cancelAnimationFrame(this.grUpdateAnimationFrame);

        const updateMeters = () => {
            if (this.rack && Array.isArray(this.rack.modules)) {
                for (const mod of this.rack.modules) {
                    if (mod.getReduction) {
                        const fill = this.container.querySelector(`#meter-fill-${mod.id}`);
                        const val = this.container.querySelector(`#meter-val-${mod.id}`);
                        if (fill && val) {
                            const gr = Math.abs(mod.getReduction());
                            const pct = Math.min(100, (gr / 18.0) * 100);
                            fill.style.width = `${pct}%`;
                            val.textContent = `${gr > 0.05 ? '-' : ''}${gr.toFixed(1)}\u00A0dB`;
                        }
                    }

                    // Multi-band individual channel meters
                    if (mod.getBandReductions) {
                        const bandReds = mod.getBandReductions();
                        for (let bIdx = 0; bIdx < bandReds.length; bIdx++) {
                            const fill = this.container.querySelector(`#meter-fill-${mod.id}-b${bIdx}`);
                            const val = this.container.querySelector(`#meter-val-${mod.id}-b${bIdx}`);
                            if (fill && val) {
                                const gr = Math.abs(bandReds[bIdx]);
                                const pct = Math.min(100, (gr / 18.0) * 100);
                                fill.style.width = `${pct}%`;
                                val.textContent = `${gr > 0.05 ? '-' : ''}${gr.toFixed(1)}\u00A0dB`;
                            }
                        }
                    }
                }
            }
            this.grUpdateAnimationFrame = requestAnimationFrame(updateMeters);
        };

        this.grUpdateAnimationFrame = requestAnimationFrame(updateMeters);
    }
}
