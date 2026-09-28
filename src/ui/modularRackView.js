/**
 * Modular Mastering Rack View
 * Renders interactive rackmount processing modules, visual chain flow,
 * module reordering, addition/removal, parameter knobs & faders.
 */

import { MODULE_DOCUMENTATION } from './moduleDocumentation.js';

export class ModularRackView {
    constructor(containerElement, rackEngine, callbacks = {}) {
        this.container = containerElement;
        this.rack = rackEngine;
        this.callbacks = {
            onChainModified: () => {},
            onParamChanged: () => {},
            onCommitChange: () => {},
            onUndo: () => {},
            onRedo: () => {},
            ...callbacks
        };
        this.lastHistoryState = { canUndo: false, canRedo: false, undoDesc: '', redoDesc: '' };

        // Universal change listener: captures parameter slider release and commits snapshot
        this.container.addEventListener('change', (e) => {
            const input = e.target.closest('input, select');
            if (input) {
                const modCard = input.closest('.rack-module-card');
                const modTitle = modCard ? (modCard.querySelector('.module-title')?.textContent || 'Processor') : 'Rack';
                const labelRow = input.closest('.control-unit')?.querySelector('.unit-name')?.textContent;
                const name = labelRow || input.getAttribute('data-name') || input.id || 'Parameter';
                this.callbacks.onCommitChange?.(`${modTitle}: ${name}`);
            }
        });

        this.grUpdateAnimationFrame = null;
        this.render();
        this.startTelemetryLoop();
    }

    setRackEngine(rackEngine) {
        this.rack = rackEngine;
        this.render();
    }

    updateHistoryState(state) {
        if (!state) return;
        this.lastHistoryState = state;
        const btnUndo = this.container.querySelector('#btn-rack-undo');
        const btnRedo = this.container.querySelector('#btn-rack-redo');
        if (btnUndo) {
            btnUndo.disabled = !state.canUndo;
            btnUndo.title = state.canUndo ? `Undo: ${state.undoDesc || 'Action'} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
        }
        if (btnRedo) {
            btnRedo.disabled = !state.canRedo;
            btnRedo.title = state.canRedo ? `Redo: ${state.redoDesc || 'Action'} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
        }
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
                <div class="rack-history-group">
                    <button class="btn btn-secondary btn-rack-history" id="btn-rack-undo" ${this.lastHistoryState.canUndo ? '' : 'disabled'} title="${this.lastHistoryState.canUndo ? 'Undo: ' + (this.lastHistoryState.undoDesc || '') + ' (Ctrl+Z)' : 'Undo (Ctrl+Z)'}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                        </svg>
                        <span>UNDO</span>
                    </button>
                    <button class="btn btn-secondary btn-rack-history" id="btn-rack-redo" ${this.lastHistoryState.canRedo ? '' : 'disabled'} title="${this.lastHistoryState.canRedo ? 'Redo: ' + (this.lastHistoryState.redoDesc || '') + ' (Ctrl+Y)' : 'Redo (Ctrl+Y)'}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        <span>REDO</span>
                    </button>
                </div>
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
                            <span class="menu-icon">${this.getModuleIcon('parametric_eq')}</span>
                            <div>
                                <div class="menu-title">Parametric Match EQ</div>
                                <div class="menu-desc">7-band precision spectral shaping</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="multiband_compressor">
                            <span class="menu-icon">${this.getModuleIcon('multiband_compressor')}</span>
                            <div>
                                <div class="menu-title">4-Band Multi-Channel Compressor</div>
                                <div class="menu-desc">Split-band dynamics with M/S matrix & solo</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="master_compressor">
                            <span class="menu-icon">${this.getModuleIcon('master_compressor')}</span>
                            <div>
                                <div class="menu-title">VCA Master Compressor</div>
                                <div class="menu-desc">Dynamic punch & glue compression</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="opto_compressor">
                            <span class="menu-icon">${this.getModuleIcon('opto_compressor')}</span>
                            <div>
                                <div class="menu-title">Opto Warmth Compressor</div>
                                <div class="menu-desc">Smooth vintage leveling & peak control</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="tube_saturator">
                            <span class="menu-icon">${this.getModuleIcon('tube_saturator')}</span>
                            <div>
                                <div class="menu-title">Analog Tube Warmth</div>
                                <div class="menu-desc">Harmonic excitement & tube saturation</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="analog_tape">
                            <span class="menu-icon">${this.getModuleIcon('analog_tape')}</span>
                            <div>
                                <div class="menu-title">Analog Master Tape Machine</div>
                                <div class="menu-desc">Studer/Ampex magnetic saturation & transformer warmth</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="transient_shaper">
                            <span class="menu-icon">${this.getModuleIcon('transient_shaper')}</span>
                            <div>
                                <div class="menu-title">Dynamic Transient Shaper</div>
                                <div class="menu-desc">Attack punch sculpt & sustain contouring</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="dynamic_deharsh">
                            <span class="menu-icon">${this.getModuleIcon('dynamic_deharsh')}</span>
                            <div>
                                <div class="menu-title">Dynamic Resonance De-Harsh</div>
                                <div class="menu-desc">Smart digital harshness & sibilance suppressor</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="studio_reverb">
                            <span class="menu-icon">${this.getModuleIcon('studio_reverb')}</span>
                            <div>
                                <div class="menu-title">Studio Acoustic Reverb</div>
                                <div class="menu-desc">Subtle spatial glue, room dimension & depth</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="stereo_imager">
                            <span class="menu-icon">${this.getModuleIcon('stereo_imager')}</span>
                            <div>
                                <div class="menu-title">Stereo Imager & Widener</div>
                                <div class="menu-desc">M/S stereo widening & mono bass focus</div>
                            </div>
                        </div>
                        <div class="menu-item" data-type="lookahead_limiter">
                            <span class="menu-icon">${this.getModuleIcon('lookahead_limiter')}</span>
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
                        const nextBypass = !mod.bypassed;
                        this.rack.setModuleBypass(mod.id, nextBypass);
                        this.render();
                        this.callbacks.onChainModified();
                        this.callbacks.onCommitChange?.(`${nextBypass ? 'Bypass' : 'Engage'} ${mod.title}`);
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
                    this.callbacks.onCommitChange?.('Reorder Signal Chain');
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
            case 'dynamic_deharsh': return 'M-102 // DYNAMIC DE-HARSH';
            case 'multiband_compressor': return 'M-204 // QUAD-BAND DYNAMICS';
            case 'master_compressor': return 'M-301 // VCA BUS COMPRESSOR';
            case 'opto_compressor': return 'M-302 // OPTO-CELL LEVELER';
            case 'transient_shaper': return 'M-205 // MASTER TRANSIENT SHAPER';
            case 'tube_saturator': return 'M-401 // HARMONIC TUBE SATURATOR';
            case 'analog_tape': return 'M-402 // ANALOG MASTER TAPE';
            case 'studio_reverb': return 'M-502 // STUDIO ACOUSTIC REVERB';
            case 'stereo_imager': return 'M-501 // STEREO MATRIX & BASS';
            case 'lookahead_limiter': return 'M-601 // TRUE-PEAK BRICKWALL';
            default: return 'M-000 // DSP MODULE';
        }
    }

    getModuleIcon(type) {
        switch (type) {
            case 'parametric_eq':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12h3l3-9 6 18 3-9h3"/></svg>`;
            case 'dynamic_deharsh':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 14c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><line x1="12" y1="2" x2="12" y2="7"/><path d="M10 5l2 2 2-2"/></svg>`;
            case 'multiband_compressor':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`;
            case 'master_compressor':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
            case 'opto_compressor':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>`;
            case 'transient_shaper':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 14h4l3-10 4 16 3-6h6"/></svg>`;
            case 'tube_saturator':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
            case 'analog_tape':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M7 16h10M7 8h10"/></svg>`;
            case 'studio_reverb':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 10a3 3 0 0 1 6 0v11"/></svg>`;
            case 'stereo_imager':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
            case 'lookahead_limiter':
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
            default:
                return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
        }
    }

    attachHeaderListeners() {
        const btnUndo = this.container.querySelector('#btn-rack-undo');
        const btnRedo = this.container.querySelector('#btn-rack-redo');
        if (btnUndo) btnUndo.addEventListener('click', () => this.callbacks.onUndo?.());
        if (btnRedo) btnRedo.addEventListener('click', () => this.callbacks.onRedo?.());

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
                    this.callbacks.onCommitChange?.(`Add ${type.replace(/_/g, ' ')}`);
                });
            });
        }
    }

    renderModuleCard(mod, index, totalCount) {
        const card = document.createElement('div');
        card.className = `rack-module-card ${mod.bypassed ? 'is-bypassed' : ''} type-${mod.type}`;
        card.id = `rack-card-${mod.id}`;
        // DO NOT make entire card draggable by default to prevent slider dragging from moving the card!
        card.setAttribute('draggable', 'false');
        card.setAttribute('data-index', String(index));

        // Rack Ear Left with hex screws
        const earLeft = document.createElement('div');
        earLeft.className = 'rack-ear rack-ear-left';
        earLeft.title = 'Drag ear to reorder processor in rack';
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
                <button class="btn-rack-nav btn-module-help" title="Unit Documentation & DSP Algorithm Help">?</button>
                <button class="btn-rack-nav btn-move-left" ${index === 0 ? 'disabled' : ''} title="Move Earlier in Chain">◀</button>
                <button class="btn-rack-nav btn-move-right" ${index === totalCount - 1 ? 'disabled' : ''} title="Move Later in Chain">▶</button>
                <button class="btn-rack-nav btn-delete-module" title="Remove Processor from Chain">✕</button>
            </div>
        `;

        // Unit Help Dialog toggle
        const btnHelp = cardHeader.querySelector('.btn-module-help');
        if (btnHelp) {
            btnHelp.addEventListener('click', () => {
                this.showModuleHelp(mod.type);
            });
        }

        // Power toggle
        const btnPower = cardHeader.querySelector('.btn-module-power');
        btnPower.addEventListener('click', () => {
            const nextBypass = !mod.bypassed;
            this.rack.setModuleBypass(mod.id, nextBypass);
            this.render();
            this.callbacks.onChainModified();
            this.callbacks.onCommitChange?.(`${nextBypass ? 'Bypass' : 'Engage'} ${mod.title}`);
        });

        // Move Left / Up
        const btnLeft = cardHeader.querySelector('.btn-move-left');
        btnLeft.addEventListener('click', () => {
            this.rack.moveModule(mod.id, 'left');
            this.render();
            this.callbacks.onChainModified();
            this.callbacks.onCommitChange?.(`Move ${mod.title} Earlier`);
        });

        // Move Right / Down
        const btnRight = cardHeader.querySelector('.btn-move-right');
        btnRight.addEventListener('click', () => {
            this.rack.moveModule(mod.id, 'right');
            this.render();
            this.callbacks.onChainModified();
            this.callbacks.onCommitChange?.(`Move ${mod.title} Later`);
        });

        // Delete
        const btnDel = cardHeader.querySelector('.btn-delete-module');
        btnDel.addEventListener('click', () => {
            if (confirm(`Remove ${mod.title} from mastering chain?`)) {
                this.rack.removeModule(mod.id);
                this.render();
                this.callbacks.onChainModified();
                this.callbacks.onCommitChange?.(`Remove ${mod.title}`);
            }
        });

        chassis.appendChild(cardHeader);

        // Explicit Drag-Handle Activation (Ears & Grip only)
        const grip = cardHeader.querySelector('.rack-drag-grip');
        const enableDrag = (e) => {
            if (e && e.button !== 0) return; // Left click only
            card.setAttribute('draggable', 'true');
            const onRelease = () => {
                card.setAttribute('draggable', 'false');
                window.removeEventListener('mouseup', onRelease);
            };
            window.addEventListener('mouseup', onRelease);
        };
        const disableDrag = () => {
            card.setAttribute('draggable', 'false');
        };

        earLeft.addEventListener('mousedown', enableDrag);
        if (grip) grip.addEventListener('mousedown', enableDrag);

        // Drag and drop event listeners on rack card
        card.addEventListener('dragstart', (e) => {
            const isHandle = e.target.closest('.rack-drag-grip, .rack-ear');
            const isInteractive = e.target.closest('input, button, select, .module-card-body, .styled-slider, .vertical-slider');

            // Strictly disallow dragstart from any control, slider, or button!
            if (!isHandle || isInteractive) {
                e.preventDefault();
                e.stopPropagation();
                disableDrag();
                return;
            }

            e.dataTransfer.setData('text/plain', String(index));
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('is-dragging');
        });

        card.addEventListener('dragend', () => {
            disableDrag();
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
            disableDrag();
            card.classList.remove('drag-over-target');
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIndex = index;
            if (!isNaN(fromIndex) && fromIndex !== toIndex) {
                this.rack.reorderModule(fromIndex, toIndex);
                this.render();
                this.callbacks.onChainModified();
                this.callbacks.onCommitChange?.(`Reorder ${mod.title}`);
            }
        });

        // Module Body / Controls
        const cardBody = document.createElement('div');
        cardBody.className = 'module-card-body';

        // Defend against any drag propagation from sliders and controls inside body
        cardBody.addEventListener('mousedown', (e) => {
            disableDrag();
            e.stopPropagation();
        });
        cardBody.addEventListener('dragstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            disableDrag();
        });

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
            case 'analog_tape':
                this.renderAnalogTapeControls(cardBody, mod);
                break;
            case 'transient_shaper':
                this.renderTransientShaperControls(cardBody, mod);
                break;
            case 'dynamic_deharsh':
                this.renderDynamicDeharshControls(cardBody, mod);
                break;
            case 'studio_reverb':
                this.renderStudioReverbControls(cardBody, mod);
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
        earRight.title = 'Drag ear to reorder processor in rack';
        earRight.innerHTML = `
            <div class="rack-bolt"></div>
            <div class="rack-bolt"></div>
        `;
        earRight.addEventListener('mousedown', enableDrag);
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

        const bandLabels = [
            'Sub (32Hz)',
            'Bass (80Hz)',
            'Body (250Hz)',
            'Mid (650Hz)',
            'Vocal (1.8k)',
            'Presence (4.5k)',
            'Sheen (9k)',
            'Air (14k)'
        ];

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

    renderAnalogTapeControls(container, mod) {
        const rowSpeed = document.createElement('div');
        rowSpeed.className = 'multiband-meta-row';
        rowSpeed.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Tape Speed & Formulation</span>
                </div>
                <div class="channel-mode-toggle">
                    <button class="btn-channel-mode ${mod.params.speed === '30_ips' ? 'active' : ''}" id="btn-${mod.id}-speed-30">30 IPS (Hi-Fi Silk)</button>
                    <button class="btn-channel-mode ${mod.params.speed === '15_ips' ? 'active' : ''}" id="btn-${mod.id}-speed-15">15 IPS (Studio Standard)</button>
                    <button class="btn-channel-mode ${mod.params.speed === '7.5_ips' ? 'active' : ''}" id="btn-${mod.id}-speed-75">7.5 IPS (Warm Vintage)</button>
                </div>
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Input Tape Drive</span>
                    <span class="unit-val" id="val-${mod.id}-drive">+${mod.params.drive.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="18" step="0.5" value="${mod.params.drive}" id="sl-${mod.id}-drive">
            </div>
        `;
        container.appendChild(rowSpeed);

        const btn30 = rowSpeed.querySelector(`#btn-${mod.id}-speed-30`);
        const btn15 = rowSpeed.querySelector(`#btn-${mod.id}-speed-15`);
        const btn75 = rowSpeed.querySelector(`#btn-${mod.id}-speed-75`);

        const setSpeedBtn = (speed) => {
            [btn30, btn15, btn75].forEach(b => b.classList.remove('active'));
            if (speed === '30_ips') btn30.classList.add('active');
            else if (speed === '7.5_ips') btn75.classList.add('active');
            else btn15.classList.add('active');
            mod.setParam('speed', speed);
            this.callbacks.onParamChanged(mod.id, 'speed', speed);
            this.callbacks.onCommitChange?.(`Tape Speed: ${speed.replace('_', ' ').toUpperCase()}`);
        };

        btn30.addEventListener('click', () => setSpeedBtn('30_ips'));
        btn15.addEventListener('click', () => setSpeedBtn('15_ips'));
        btn75.addEventListener('click', () => setSpeedBtn('7.5_ips'));

        const grid = document.createElement('div');
        grid.className = 'mod-controls-row';
        grid.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Head Bump (55Hz)</span>
                    <span class="unit-val" id="val-${mod.id}-head">+${mod.params.headBump.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="4" step="0.1" value="${mod.params.headBump}" id="sl-${mod.id}-head">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Iron Transformer</span>
                    <span class="unit-val" id="val-${mod.id}-xfmr">${mod.params.transformer.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" step="1" value="${mod.params.transformer}" id="sl-${mod.id}-xfmr">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Wow & Flutter</span>
                    <span class="unit-val" id="val-${mod.id}-flutter">${mod.params.flutter.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" step="1" value="${mod.params.flutter}" id="sl-${mod.id}-flutter">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Tape Bias</span>
                    <span class="unit-val" id="val-${mod.id}-bias">${mod.params.bias >= 0 ? '+' : ''}${mod.params.bias.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="-3" max="3" step="0.2" value="${mod.params.bias}" id="sl-${mod.id}-bias">
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

        const bindSlider = (id, param, format, targetContainer = grid) => {
            const sl = targetContainer.querySelector(`#sl-${mod.id}-${id}`);
            const valEl = targetContainer.querySelector(`#val-${mod.id}-${id}`);
            if (sl && valEl) {
                sl.addEventListener('input', (e) => {
                    const v = parseFloat(e.target.value);
                    valEl.textContent = format(v);
                    mod.setParam(param, v);
                    this.callbacks.onParamChanged(mod.id, param, v);
                });
            }
        };

        bindSlider('drive', 'drive', v => `+${v.toFixed(1)} dB`, rowSpeed);
        bindSlider('head', 'headBump', v => `+${v.toFixed(1)} dB`);
        bindSlider('xfmr', 'transformer', v => `${v.toFixed(0)}%`);
        bindSlider('flutter', 'flutter', v => `${v.toFixed(0)}%`);
        bindSlider('bias', 'bias', v => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`);
        bindSlider('mix', 'mix', v => `${v.toFixed(0)}%`);
    }

    renderStudioReverbControls(container, mod) {
        const grid1 = document.createElement('div');
        grid1.className = 'mod-controls-row';
        grid1.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Room Size</span>
                    <span class="unit-val" id="val-${mod.id}-size">${mod.params.size.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="10" max="100" step="1" value="${mod.params.size}" id="sl-${mod.id}-size">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Decay Time (RT60)</span>
                    <span class="unit-val" id="val-${mod.id}-decay">${mod.params.decay.toFixed(1)} s</span>
                </div>
                <input type="range" class="styled-slider" min="0.4" max="4.5" step="0.1" value="${mod.params.decay}" id="sl-${mod.id}-decay">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Pre-Delay</span>
                    <span class="unit-val" id="val-${mod.id}-predelay">${mod.params.predelay.toFixed(0)} ms</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="80" step="1" value="${mod.params.predelay}" id="sl-${mod.id}-predelay">
            </div>
        `;

        const grid2 = document.createElement('div');
        grid2.className = 'mod-controls-row';
        grid2.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">HF Damping (High Cut)</span>
                    <span class="unit-val" id="val-${mod.id}-damping">${(mod.params.damping / 1000).toFixed(1)} kHz</span>
                </div>
                <input type="range" class="styled-slider" min="2000" max="16000" step="200" value="${mod.params.damping}" id="sl-${mod.id}-damping">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Stereo Spread</span>
                    <span class="unit-val" id="val-${mod.id}-width">${mod.params.width.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="200" step="5" value="${mod.params.width}" id="sl-${mod.id}-width">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Wet Mix (Glue)</span>
                    <span class="unit-val" id="val-${mod.id}-mix">${mod.params.mix.toFixed(1)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="40" step="0.5" value="${mod.params.mix}" id="sl-${mod.id}-mix">
            </div>
        `;

        container.appendChild(grid1);
        container.appendChild(grid2);

        const bindSlider = (id, param, format, rowEl) => {
            const sl = rowEl.querySelector(`#sl-${mod.id}-${id}`);
            const valEl = rowEl.querySelector(`#val-${mod.id}-${id}`);
            if (sl && valEl) {
                sl.addEventListener('input', (e) => {
                    const v = parseFloat(e.target.value);
                    valEl.textContent = format(v);
                    mod.setParam(param, v);
                    this.callbacks.onParamChanged(mod.id, param, v);
                });
            }
        };

        bindSlider('size', 'size', v => `${v.toFixed(0)}%`, grid1);
        bindSlider('decay', 'decay', v => `${v.toFixed(1)} s`, grid1);
        bindSlider('predelay', 'predelay', v => `${v.toFixed(0)} ms`, grid1);
        bindSlider('damping', 'damping', v => `${(v / 1000).toFixed(1)} kHz`, grid2);
        bindSlider('width', 'width', v => `${v.toFixed(0)}%`, grid2);
        bindSlider('mix', 'mix', v => `${v.toFixed(1)}%`, grid2);
    }

    renderTransientShaperControls(container, mod) {
        const grid = document.createElement('div');
        grid.className = 'mod-controls-row';
        grid.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Attack Punch</span>
                    <span class="unit-val" id="val-${mod.id}-att">${mod.params.attack >= 0 ? '+' : ''}${mod.params.attack.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="-6" max="6" step="0.2" value="${mod.params.attack}" id="sl-${mod.id}-att">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Sustain Body</span>
                    <span class="unit-val" id="val-${mod.id}-sus">${mod.params.sustain >= 0 ? '+' : ''}${mod.params.sustain.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="-6" max="6" step="0.2" value="${mod.params.sustain}" id="sl-${mod.id}-sus">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Response Window</span>
                    <span class="unit-val" id="val-${mod.id}-speed">${mod.params.speed.toFixed(0)} ms</span>
                </div>
                <input type="range" class="styled-slider" min="10" max="100" step="2" value="${mod.params.speed}" id="sl-${mod.id}-speed">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Output Trim</span>
                    <span class="unit-val" id="val-${mod.id}-out">${mod.params.outputGain >= 0 ? '+' : ''}${mod.params.outputGain.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="-6" max="6" step="0.2" value="${mod.params.outputGain}" id="sl-${mod.id}-out">
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
            if (sl && valEl) {
                sl.addEventListener('input', (e) => {
                    const v = parseFloat(e.target.value);
                    valEl.textContent = format(v);
                    mod.setParam(param, v);
                    this.callbacks.onParamChanged(mod.id, param, v);
                });
            }
        };

        bindSlider('att', 'attack', v => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`);
        bindSlider('sus', 'sustain', v => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`);
        bindSlider('speed', 'speed', v => `${v.toFixed(0)} ms`);
        bindSlider('out', 'outputGain', v => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`);
        bindSlider('mix', 'mix', v => `${v.toFixed(0)}%`);
    }

    renderDynamicDeharshControls(container, mod) {
        const grid = document.createElement('div');
        grid.className = 'mod-controls-row';
        grid.innerHTML = `
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Target Frequency</span>
                    <span class="unit-val" id="val-${mod.id}-freq">${(mod.params.targetFreq / 1000).toFixed(2)} kHz</span>
                </div>
                <input type="range" class="styled-slider" min="2000" max="10000" step="50" value="${mod.params.targetFreq}" id="sl-${mod.id}-freq">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Sensitivity / Threshold</span>
                    <span class="unit-val" id="val-${mod.id}-thresh">${mod.params.threshold.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="-36" max="-6" step="0.5" value="${mod.params.threshold}" id="sl-${mod.id}-thresh">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Max De-Harsh Depth</span>
                    <span class="unit-val" id="val-${mod.id}-red">-${mod.params.reduction.toFixed(1)} dB</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="12" step="0.5" value="${mod.params.reduction}" id="sl-${mod.id}-red">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Q Bandwidth</span>
                    <span class="unit-val" id="val-${mod.id}-q">Q ${mod.params.q.toFixed(2)}</span>
                </div>
                <input type="range" class="styled-slider" min="0.7" max="4.0" step="0.1" value="${mod.params.q}" id="sl-${mod.id}-q">
            </div>
            <div class="control-unit">
                <div class="unit-label-row">
                    <span class="unit-name">Mix</span>
                    <span class="unit-val" id="val-${mod.id}-mix">${mod.params.mix.toFixed(0)}%</span>
                </div>
                <input type="range" class="styled-slider" min="0" max="100" step="1" value="${mod.params.mix}" id="sl-${mod.id}-mix">
            </div>
        `;

        const grRow = document.createElement('div');
        grRow.className = 'comp-telemetry-row';
        grRow.innerHTML = `
            <span class="gr-label">DE-HARSH SUPPRESSION:</span>
            <div class="gr-meter-track">
                <div class="gr-meter-fill" id="meter-fill-${mod.id}" style="background: var(--color-target, #00f0ff);"></div>
            </div>
            <span class="gr-value" id="meter-val-${mod.id}">0.0\u00A0dB</span>
        `;

        container.appendChild(grid);
        container.appendChild(grRow);

        const bindSlider = (id, param, format) => {
            const sl = grid.querySelector(`#sl-${mod.id}-${id}`);
            const valEl = grid.querySelector(`#val-${mod.id}-${id}`);
            if (sl && valEl) {
                sl.addEventListener('input', (e) => {
                    const v = parseFloat(e.target.value);
                    valEl.textContent = format(v);
                    mod.setParam(param, v);
                    this.callbacks.onParamChanged(mod.id, param, v);
                });
            }
        };

        bindSlider('freq', 'targetFreq', v => `${(v / 1000).toFixed(2)} kHz`);
        bindSlider('thresh', 'threshold', v => `${v.toFixed(1)} dB`);
        bindSlider('red', 'reduction', v => `-${v.toFixed(1)} dB`);
        bindSlider('q', 'q', v => `Q ${v.toFixed(2)}`);
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

    showModuleHelp(type) {
        const doc = MODULE_DOCUMENTATION[type];
        if (!doc) return;

        const modal = document.getElementById('module-help-modal');
        if (!modal) return;

        const iconEl = document.getElementById('help-modal-icon');
        const titleEl = document.getElementById('help-modal-title');
        const serialEl = document.getElementById('help-modal-serial');
        const bodyEl = document.getElementById('help-modal-body');

        if (iconEl) iconEl.innerHTML = this.getModuleIcon(type);
        if (titleEl) titleEl.textContent = doc.title;
        if (serialEl) serialEl.textContent = `${doc.serial} • ${doc.badge}`;

        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="help-section help-hero">
                    <p class="help-desc">${doc.description}</p>
                </div>

                <div class="help-section help-heritage">
                    <div class="help-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                        <span>Hardware Heritage & Analog Benchmark</span>
                    </div>
                    <div class="help-heritage-text">${doc.heritage}</div>
                </div>

                <div class="help-section help-algorithm">
                    <div class="help-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
                        <span>DSP Algorithm & Signal Path Architecture</span>
                    </div>
                    <ul class="help-bullet-list">
                        ${doc.algorithm.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>

                <div class="help-section help-controls">
                    <div class="help-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        <span>Parameter Calibration Reference</span>
                    </div>
                    <div class="help-controls-table">
                        ${doc.controlsGuide.map(c => `
                            <div class="help-ctrl-row">
                                <span class="help-ctrl-name">${c.name}</span>
                                <span class="help-ctrl-desc">${c.desc}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="help-section help-tips">
                    <div class="help-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        <span>Pro Mastering Recommendation</span>
                    </div>
                    <div class="help-tip-box">${doc.masteringTips}</div>
                </div>
            `;
        }

        modal.classList.add('visible');
    }
}
