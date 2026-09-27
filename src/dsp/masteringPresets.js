/**
 * Mastering Sound Style Presets
 * Curated, genre-specific mastering chain profiles designed with real-world mastering discipline.
 * Each preset purposefully engages ONLY 2 to 4 relevant processor units with gentle, musical
 * parameter calibrations, keeping unused units bypassed to preserve dynamic punch and clarity.
 */

export const MASTERING_PRESETS = [
    {
        id: 'initial_clean_bypass',
        name: 'Initial Clean (All Bypassed / Flat)',
        category: 'Utility & Flat',
        description: 'Reference starting state. All modular rack processors bypassed for clean, uncolored signal evaluation.',
        targetLufs: -14.0,
        settings: {
            parametric_eq: { bypassed: true, matchAmount: 1.0, smoothing: 0.5, bands: [
                { id: 'sub', type: 'lowshelf', freq: 40, gain: 0.0, q: 0.71, enabled: true },
                { id: 'low', type: 'peaking', freq: 120, gain: 0.0, q: 1.4, enabled: true },
                { id: 'low_mid', type: 'peaking', freq: 350, gain: 0.0, q: 1.4, enabled: true },
                { id: 'mid', type: 'peaking', freq: 1000, gain: 0.0, q: 1.4, enabled: true },
                { id: 'high_mid', type: 'peaking', freq: 3200, gain: 0.0, q: 1.4, enabled: true },
                { id: 'presence', type: 'peaking', freq: 6500, gain: 0.0, q: 1.4, enabled: true },
                { id: 'air', type: 'highshelf', freq: 12000, gain: 0.0, q: 0.71, enabled: true }
            ]},
            multiband_compressor: { bypassed: true },
            master_compressor: { bypassed: true },
            opto_compressor: { bypassed: true },
            tube_saturator: { bypassed: true },
            analog_tape: { bypassed: true },
            transient_shaper: { bypassed: true },
            dynamic_deharsh: { bypassed: true },
            studio_reverb: { bypassed: true },
            stereo_imager: { bypassed: true },
            lookahead_limiter: { bypassed: true, ceiling: -1.0, release: 80.0, softClip: false, drive: 0.0 }
        }
    },

    {
        id: 'streaming_standard',
        name: '1. Streaming Standard (-14.0 LUFS)',
        category: 'Distribution',
        description: 'Optimized for Spotify, Apple Music, and YouTube. Engages 3 units: Parametric EQ (subtle air and low-end contour), VCA Master Compressor (1.3:1 gentle bus glue), and Peak Limiter (-1.0 dBTP ceiling preventing lossy codec clipping).',
        targetLufs: -14.0,
        settings: {
            parametric_eq: {
                bypassed: false,
                matchAmount: 0.7,
                smoothing: 0.6,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 35, gain: -0.3, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 110, gain: 0.3, q: 1.2, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 320, gain: -0.4, q: 1.5, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1200, gain: 0.0, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3400, gain: 0.3, q: 1.6, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 7500, gain: 0.4, q: 1.3, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 13000, gain: 0.6, q: 0.71, enabled: true }
                ]
            },
            master_compressor: {
                bypassed: false,
                threshold: -14.0,
                ratio: 1.3,
                attack: 35.0,
                release: 120.0,
                knee: 6.0,
                makeup: 0.3,
                mix: 75.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -1.0,
                release: 90.0,
                softClip: false,
                drive: 0.8
            }
        }
    },

    {
        id: 'edm_club_punch',
        name: '2. Club & Festival EDM Impact (-9.0 LUFS)',
        category: 'Electronic & Dance',
        description: 'High-energy club loudness with punch and clarity. Engages 3 units: Parametric EQ (tight sub shelf & air), Transient Shaper (controlled kick snap), and True-Peak Limiter with soft-clipping.',
        targetLufs: -9.0,
        settings: {
            parametric_eq: {
                bypassed: false,
                matchAmount: 0.8,
                smoothing: 0.5,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 45, gain: 0.6, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 100, gain: 0.4, q: 1.4, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 280, gain: -0.5, q: 1.6, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1000, gain: 0.0, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3000, gain: 0.4, q: 1.4, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 6500, gain: 0.5, q: 1.4, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 12000, gain: 0.7, q: 0.71, enabled: true }
                ]
            },
            transient_shaper: {
                bypassed: false,
                attack: 0.4,
                sustain: -0.2,
                speed: 28.0,
                outputGain: 0.0,
                mix: 60.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -0.3,
                release: 75.0,
                softClip: true,
                drive: 1.6
            }
        }
    },

    {
        id: 'hiphop_trap_heat',
        name: '3. Modern 808 Trap & Hip-Hop (-9.5 LUFS)',
        category: 'Hip-Hop & Trap',
        description: 'Tight 808 sub control and vocal clarity. Engages 3 units: Parametric EQ (mud notch at 320 Hz, vocal air), Multiband Compressor (tightening sub band only, others flat), and Peak Limiter.',
        targetLufs: -9.5,
        settings: {
            parametric_eq: {
                bypassed: false,
                matchAmount: 0.8,
                smoothing: 0.5,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 40, gain: 0.6, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 90, gain: 0.3, q: 1.3, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 320, gain: -0.6, q: 1.6, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1100, gain: 0.0, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3200, gain: 0.4, q: 1.4, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 7000, gain: 0.5, q: 1.3, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 13500, gain: 0.7, q: 0.71, enabled: true }
                ]
            },
            multiband_compressor: {
                bypassed: false,
                crossoverLow: 120,
                crossoverMid: 1200,
                crossoverHigh: 6500,
                channelMode: 'stereo',
                bands: [
                    { threshold: -15, ratio: 1.6, attack: 30, release: 80, makeup: 0.2, bypass: false },
                    { threshold: -14, ratio: 1.0, attack: 20, release: 70, makeup: 0.0, bypass: true },
                    { threshold: -14, ratio: 1.0, attack: 15, release: 60, makeup: 0.0, bypass: true },
                    { threshold: -15, ratio: 1.0, attack: 10, release: 50, makeup: 0.0, bypass: true }
                ]
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -0.5,
                release: 80.0,
                softClip: true,
                drive: 1.6
            }
        }
    },

    {
        id: 'vintage_70s_tape',
        name: '4. Vintage 70s Analog Tape & Tube (-12.0 LUFS)',
        category: 'Vintage Analog',
        description: 'Authentic 15 IPS master tape warmth without phase flanging or pitch flutter. Engages 2 units: Analog Master Tape Machine (1.5 dB saturation, 55 Hz head-bump) and clean Peak Limiter.',
        targetLufs: -12.0,
        settings: {
            analog_tape: {
                bypassed: false,
                speed: '15_ips',
                drive: 1.5,
                headBump: 0.4,
                flutter: 0.0,
                transformer: 12.0,
                bias: 0.0,
                mix: 100.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -0.6,
                release: 100.0,
                softClip: true,
                drive: 1.0
            }
        }
    },

    {
        id: 'lofi_nostalgia',
        name: '5. 90s Lo-Fi Boom Bap & Vinyl Grit (-13.0 LUFS)',
        category: 'Lo-Fi & Vintage',
        description: 'Warm vintage beat tone. Engages 3 units: Parametric EQ (smooth vintage high-frequency roll-off), Analog Tube Warmth (gentle 2nd harmonic richness), and Peak Limiter.',
        targetLufs: -13.0,
        settings: {
            parametric_eq: {
                bypassed: false,
                matchAmount: 0.7,
                smoothing: 0.6,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 40, gain: -0.5, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 110, gain: 0.5, q: 1.3, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 350, gain: 0.3, q: 1.4, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1000, gain: 0.3, q: 1.3, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 2800, gain: 0.0, q: 1.3, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 6000, gain: -0.4, q: 1.2, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 11000, gain: -0.9, q: 0.71, enabled: true }
                ]
            },
            tube_saturator: {
                bypassed: false,
                drive: 1.8,
                warmth: 15.0,
                mix: 20.0,
                outputGain: 0.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -0.8,
                release: 110.0,
                softClip: true,
                drive: 1.0
            }
        }
    },

    {
        id: 'synthwave_neon',
        name: '6. Synthwave & Cyberpunk 80s Neon (-10.0 LUFS)',
        category: 'Electronic & Synth',
        description: '80s retro synth space with grounded low end. Engages 3 units: Stereo Imager (112% width, mono bass under 95Hz), Parametric EQ (shimmering presence), and Peak Limiter.',
        targetLufs: -10.0,
        settings: {
            parametric_eq: {
                bypassed: false,
                matchAmount: 0.8,
                smoothing: 0.55,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 45, gain: 0.4, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 120, gain: 0.3, q: 1.3, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 380, gain: -0.4, q: 1.6, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1100, gain: 0.0, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3500, gain: 0.4, q: 1.5, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 7000, gain: 0.6, q: 1.3, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 12500, gain: 0.8, q: 0.71, enabled: true }
                ]
            },
            stereo_imager: {
                bypassed: false,
                width: 112.0,
                monoBassFreq: 95.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -0.4,
                release: 80.0,
                softClip: true,
                drive: 1.5
            }
        }
    },

    {
        id: 'acoustic_vocal',
        name: '7. Acoustic & Intimate Vocal Air (-15.0 LUFS)',
        category: 'Acoustic & Folk',
        description: 'Pure organic acoustic dynamics without harshness. Engages 3 units: Dynamic De-Harsh (gentle vocal glare control), Opto Compressor (smooth LA-2A leveling), and clean Peak Limiter (-1.0 dBTP ceiling).',
        targetLufs: -15.0,
        settings: {
            dynamic_deharsh: {
                bypassed: false,
                targetFreq: 6200.0,
                threshold: -16.0,
                reduction: 1.2,
                q: 1.6,
                mix: 80.0
            },
            opto_compressor: {
                bypassed: false,
                reduction: 25.0,
                emphasis: 40.0,
                speed: 'slow',
                mix: 65.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -1.0,
                release: 120.0,
                softClip: false,
                drive: 0.5
            }
        }
    },

    {
        id: 'rock_metal_wall',
        name: '8. Rock & Metal Wall-of-Sound (-9.5 LUFS)',
        category: 'Rock & Metal',
        description: 'Punchy rock glue and guitar bite. Engages 3 units: VCA Master Compressor (1.5:1 punchy bus glue), Parametric EQ (snare presence and guitar bite), and Peak Limiter with soft-clipping.',
        targetLufs: -9.5,
        settings: {
            parametric_eq: {
                bypassed: false,
                matchAmount: 0.8,
                smoothing: 0.5,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 40, gain: 0.4, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 110, gain: 0.5, q: 1.4, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 400, gain: -0.6, q: 1.8, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1200, gain: 0.3, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 2600, gain: 0.6, q: 1.5, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 5000, gain: 0.4, q: 1.4, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 11000, gain: 0.6, q: 0.71, enabled: true }
                ]
            },
            master_compressor: {
                bypassed: false,
                threshold: -14.0,
                ratio: 1.5,
                attack: 28.0,
                release: 110.0,
                knee: 6.0,
                makeup: 0.4,
                mix: 75.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -0.4,
                release: 75.0,
                softClip: true,
                drive: 1.8
            }
        }
    },

    {
        id: 'ambient_cinematic',
        name: '9. Deep Ambient & Cinematic Space (-16.0 LUFS)',
        category: 'Cinematic & Ambient',
        description: 'Widescreen acoustic field and subtle hall depth. Engages 3 units: Stereo Imager (115% width, mono bass under 80Hz), Studio Reverb (3.5% subtle dimensional air), and clean Peak Limiter.',
        targetLufs: -16.0,
        settings: {
            studio_reverb: {
                bypassed: false,
                size: 50.0,
                decay: 1.4,
                predelay: 25.0,
                damping: 5500.0,
                width: 115.0,
                mix: 3.5
            },
            stereo_imager: {
                bypassed: false,
                width: 115.0,
                monoBassFreq: 80.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -1.0,
                release: 130.0,
                softClip: false,
                drive: 0.5
            }
        }
    },

    {
        id: 'motown_soul',
        name: '10. Motown & R&B Soul Warmth (-12.0 LUFS)',
        category: 'Soul & R&B',
        description: 'Classic console warmth and silky optical leveling. Engages 3 units: Parametric EQ (warm lows and vocal presence), Opto Compressor (smooth optical control), and Peak Limiter.',
        targetLufs: -12.0,
        settings: {
            parametric_eq: {
                bypassed: false,
                matchAmount: 0.7,
                smoothing: 0.6,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 40, gain: 0.0, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 130, gain: 0.5, q: 1.3, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 400, gain: 0.3, q: 1.4, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1100, gain: 0.5, q: 1.3, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 2800, gain: 0.4, q: 1.4, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 6000, gain: 0.0, q: 1.2, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 12500, gain: -0.5, q: 0.71, enabled: true }
                ]
            },
            opto_compressor: {
                bypassed: false,
                reduction: 30.0,
                emphasis: 40.0,
                speed: 'slow',
                mix: 70.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -0.6,
                release: 100.0,
                softClip: true,
                drive: 1.2
            }
        }
    },

    {
        id: 'studer_a800_master',
        name: '11. Studer A800 1/2-Inch Master Tape (-12.0 LUFS)',
        category: 'Vintage Analog',
        description: 'Studer A800 1/2" 2-track master tape deck. Engages 3 units: Analog Master Tape Machine (15 IPS, 0.4 dB head bump, transformer iron glue), gentle Parametric EQ (smooth air), and Peak Limiter.',
        targetLufs: -12.0,
        settings: {
            analog_tape: {
                bypassed: false,
                speed: '15_ips',
                drive: 1.5,
                headBump: 0.4,
                flutter: 0.0,
                transformer: 15.0,
                bias: 0.0,
                mix: 100.0
            },
            parametric_eq: {
                bypassed: false,
                matchAmount: 0.7,
                smoothing: 0.6,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 40, gain: 0.0, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 110, gain: 0.3, q: 1.3, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 350, gain: -0.3, q: 1.4, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1000, gain: 0.0, q: 1.2, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3200, gain: 0.3, q: 1.3, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 6500, gain: 0.2, q: 1.2, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 14000, gain: 0.5, q: 0.71, enabled: true }
                ]
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -0.6,
                release: 95.0,
                softClip: true,
                drive: 1.2
            }
        }
    },

    {
        id: 'abbey_chamber_air',
        name: '12. Abbey Acoustic Chamber & Vocal Air (-15.0 LUFS)',
        category: 'Acoustic & Classical',
        description: 'Delicate chamber space & anti-glare for acoustic tracks. Engages 3 units: Dynamic De-Harsh (taming upper-mid glare), Studio Reverb (4.0% subtle chamber depth), and clean Peak Limiter (-1.0 dBTP ceiling).',
        targetLufs: -15.0,
        settings: {
            dynamic_deharsh: {
                bypassed: false,
                targetFreq: 5600.0,
                threshold: -17.0,
                reduction: 1.2,
                q: 1.5,
                mix: 85.0
            },
            studio_reverb: {
                bypassed: false,
                size: 50.0,
                decay: 1.4,
                predelay: 25.0,
                damping: 6000.0,
                width: 110.0,
                mix: 4.0
            },
            lookahead_limiter: {
                bypassed: false,
                ceiling: -1.0,
                release: 110.0,
                softClip: false,
                drive: 0.6
            }
        }
    }
];

const STORAGE_KEY = 'mestre_custom_presets_v1';
const LEGACY_STORAGE_KEY = 'aura_master_custom_presets_v1';

export class PresetManager {
    static getPresets() {
        return MASTERING_PRESETS;
    }

    static getCustomPresets() {
        try {
            const data = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (_) {
            return [];
        }
    }

    static saveCustomPreset(name, rack) {
        if (!name || !rack) return null;
        const currentSettings = {};

        for (const mod of rack.modules) {
            currentSettings[mod.type] = {
                bypassed: !!mod.bypassed,
                ...JSON.parse(JSON.stringify(mod.params))
            };
        }

        const custom = {
            id: `custom_${Date.now()}`,
            name: name.trim(),
            category: 'User Custom',
            description: 'User saved custom mastering chain profile.',
            targetLufs: -14.0,
            settings: currentSettings,
            timestamp: new Date().toISOString()
        };

        const list = this.getCustomPresets();
        list.push(custom);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (err) {
            console.warn('[PresetManager] Could not save preset to localStorage:', err);
        }
        return custom;
    }

    static deleteCustomPreset(id) {
        let list = this.getCustomPresets();
        list = list.filter(p => p.id !== id);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (_) {}
    }

    static applyPreset(preset, rack) {
        if (!preset || !preset.settings || !rack) return false;

        const isCleanFlat = preset.id === 'initial_clean_bypass';

        // 1. Configure and engage ONLY the modules specified by this preset
        for (const mod of rack.modules) {
            const params = preset.settings[mod.type];
            if (params && !isCleanFlat) {
                const shouldBypass = params.bypassed !== undefined ? !!params.bypassed : false;
                rack.setModuleBypass(mod.id, shouldBypass);
                rack.setModuleParams(mod.id, params);
            } else {
                // Module is NOT part of this preset's sound design -> BYPASS IT!
                rack.setModuleBypass(mod.id, true);
            }
        }

        // 2. For creative presets, auto-add any active modules specified in preset if not currently in rack
        if (!isCleanFlat) {
            for (const [modType, params] of Object.entries(preset.settings)) {
                if (params && params.bypassed === false) {
                    const exists = rack.modules.some(m => m.type === modType);
                    if (!exists) {
                        const limIdx = rack.modules.findIndex(m => m.type === 'lookahead_limiter');
                        const insertIdx = limIdx !== -1 ? limIdx : null;
                        const newMod = rack.addModule(modType, insertIdx, params);
                        if (newMod) {
                            rack.setModuleBypass(newMod.id, false);
                            rack.setModuleParams(newMod.id, params);
                        }
                    }
                }
            }
        }
        return true;
    }

    static exportSinglePreset(preset) {
        const payload = {
            format: 'mestre-preset',
            version: '2.5',
            exportedAt: new Date().toISOString(),
            preset
        };
        const str = JSON.stringify(payload, null, 2);
        const blob = new Blob([str], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const sanitized = preset.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `${sanitized}.mestre-preset`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    static importPresetFile(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            const p = data.preset || data;
            if (p && p.name && p.settings) {
                const custom = {
                    id: p.id || `imported_${Date.now()}`,
                    name: p.name.includes('(Imported)') ? p.name : `${p.name} (Imported)`,
                    category: p.category || 'Imported Presets',
                    description: p.description || 'Imported Mestre custom preset.',
                    targetLufs: p.targetLufs || -14.0,
                    settings: p.settings,
                    timestamp: new Date().toISOString()
                };

                const list = this.getCustomPresets();
                list.push(custom);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                return custom;
            }
        } catch (err) {
            console.error('[PresetManager] Error importing preset file:', err);
        }
        return null;
    }

    static exportPresetsAsJson() {
        const custom = this.getCustomPresets();
        const exportObj = {
            app: 'Mestre',
            version: '2.5',
            exportedAt: new Date().toISOString(),
            customPresets: custom
        };
        return JSON.stringify(exportObj, null, 2);
    }

    static importPresetsFromJson(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data && Array.isArray(data.customPresets)) {
                const existing = this.getCustomPresets();
                const existingIds = new Set(existing.map(e => e.id));
                for (const item of data.customPresets) {
                    if (item && item.id && item.name && item.settings) {
                        if (!existingIds.has(item.id)) {
                            existing.push(item);
                            existingIds.add(item.id);
                        }
                    }
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
                return true;
            }
        } catch (err) {
            console.error('[PresetManager] Failed to import presets:', err);
        }
        return false;
    }
}
