/**
 * Professional Studio Mastering Presets Engine
 * Provides curated industry-standard genre & target mastering profiles,
 * plus custom user preset saving, export, and import.
 */

export const MASTERING_PRESETS = [
    {
        id: 'streaming_standard',
        name: 'Streaming Standard (-14 LUFS)',
        category: 'Distribution',
        description: 'Optimized for Spotify, Apple Music, and YouTube. Transparent bus glue, -1.0 dBTP ceiling to prevent lossy encoding distortion.',
        settings: {
            parametric_eq: {
                matchAmount: 1.0,
                smoothing: 0.5,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 35, gain: -0.5, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 110, gain: 0.5, q: 1.2, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 320, gain: -0.8, q: 1.5, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1200, gain: 0.0, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3400, gain: 0.6, q: 1.6, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 7500, gain: 0.8, q: 1.3, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 13000, gain: 1.2, q: 0.71, enabled: true }
                ]
            },
            multiband_compressor: {
                crossoverLow: 120,
                crossoverMid: 1200,
                crossoverHigh: 6000,
                channelMode: 'stereo',
                bands: [
                    { threshold: -18, ratio: 2.2, attack: 35, release: 120, makeup: 0.5, bypass: false },
                    { threshold: -16, ratio: 1.8, attack: 25, release: 90, makeup: 0.2, bypass: false },
                    { threshold: -15, ratio: 1.8, attack: 18, release: 80, makeup: 0.3, bypass: false },
                    { threshold: -17, ratio: 2.0, attack: 12, release: 60, makeup: 0.5, bypass: false }
                ]
            },
            master_compressor: {
                threshold: -16.0,
                ratio: 2.0,
                attack: 30.0,
                release: 160.0,
                knee: 6.0,
                makeup: 1.0,
                mix: 80.0
            },
            tube_saturator: {
                drive: 10.0,
                warmth: 35.0,
                mix: 40.0,
                outputGain: 0.0
            },
            stereo_imager: {
                width: 112.0,
                monoBassFreq: 90.0
            },
            lookahead_limiter: {
                ceiling: -1.0,
                release: 90.0,
                softClip: true,
                drive: 2.5
            }
        }
    },
    {
        id: 'edm_club_punch',
        name: 'Club & EDM Maximum Impact',
        category: 'Electronic / Dance',
        description: 'Aggressive modern club loudness (-8.0 LUFS target), rock-solid mono sub punch, energetic highs, and transient preservation.',
        settings: {
            parametric_eq: {
                matchAmount: 1.2,
                smoothing: 0.4,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 45, gain: 2.0, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 100, gain: 1.2, q: 1.4, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 280, gain: -1.5, q: 1.8, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1000, gain: -0.5, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3000, gain: 1.2, q: 1.4, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 6500, gain: 1.5, q: 1.4, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 12000, gain: 2.5, q: 0.71, enabled: true }
                ]
            },
            multiband_compressor: {
                crossoverLow: 130,
                crossoverMid: 1400,
                crossoverHigh: 7000,
                channelMode: 'stereo',
                bands: [
                    { threshold: -20, ratio: 3.5, attack: 20, release: 80, makeup: 1.5, bypass: false },
                    { threshold: -16, ratio: 2.2, attack: 15, release: 70, makeup: 0.5, bypass: false },
                    { threshold: -15, ratio: 2.2, attack: 12, release: 60, makeup: 0.8, bypass: false },
                    { threshold: -18, ratio: 2.8, attack: 8, release: 45, makeup: 1.2, bypass: false }
                ]
            },
            master_compressor: {
                threshold: -18.0,
                ratio: 3.0,
                attack: 15.0,
                release: 100.0,
                knee: 4.0,
                makeup: 2.0,
                mix: 90.0
            },
            tube_saturator: {
                drive: 25.0,
                warmth: 45.0,
                mix: 55.0,
                outputGain: 0.0
            },
            stereo_imager: {
                width: 125.0,
                monoBassFreq: 120.0
            },
            lookahead_limiter: {
                ceiling: -0.3,
                release: 60.0,
                softClip: true,
                drive: 5.5
            }
        }
    },
    {
        id: 'hiphop_trap_warmth',
        name: 'Modern Hip-Hop & 808 Trap',
        category: 'Urban / Hip-Hop',
        description: 'Controlled massive 808 sub, crisp hi-hat sizzle, clear vocal pocket, and analog punch.',
        settings: {
            parametric_eq: {
                matchAmount: 1.0,
                smoothing: 0.5,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 50, gain: 2.5, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 120, gain: -0.5, q: 1.4, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 350, gain: -1.2, q: 1.6, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1100, gain: 0.0, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 2800, gain: 0.8, q: 1.5, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 5500, gain: 1.2, q: 1.4, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 11000, gain: 2.0, q: 0.71, enabled: true }
                ]
            },
            multiband_compressor: {
                crossoverLow: 110,
                crossoverMid: 1100,
                crossoverHigh: 5500,
                channelMode: 'stereo',
                bands: [
                    { threshold: -19, ratio: 3.0, attack: 28, release: 110, makeup: 1.2, bypass: false },
                    { threshold: -15, ratio: 2.0, attack: 20, release: 85, makeup: 0.4, bypass: false },
                    { threshold: -14, ratio: 1.8, attack: 14, release: 70, makeup: 0.6, bypass: false },
                    { threshold: -16, ratio: 2.2, attack: 10, release: 50, makeup: 0.8, bypass: false }
                ]
            },
            master_compressor: {
                threshold: -16.0,
                ratio: 2.5,
                attack: 25.0,
                release: 130.0,
                knee: 5.0,
                makeup: 1.2,
                mix: 85.0
            },
            tube_saturator: {
                drive: 20.0,
                warmth: 60.0,
                mix: 50.0,
                outputGain: 0.0
            },
            stereo_imager: {
                width: 118.0,
                monoBassFreq: 110.0
            },
            lookahead_limiter: {
                ceiling: -0.5,
                release: 75.0,
                softClip: true,
                drive: 4.0
            }
        }
    },
    {
        id: 'vintage_analog_vinyl',
        name: 'Warm Vintage Vinyl & Tape',
        category: 'Vintage / Analog',
        description: 'Harmonic richness, rounded transients, warm low-end weight, and gentle analog roll-off (ideal for vinyl pressing prep).',
        settings: {
            parametric_eq: {
                matchAmount: 0.9,
                smoothing: 0.6,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 30, gain: -2.0, q: 0.71, enabled: true }, // Vinyl HPF cut
                    { id: 'low', type: 'peaking', freq: 100, gain: 1.5, q: 1.2, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 380, gain: 0.8, q: 1.3, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1200, gain: -0.5, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3200, gain: 0.5, q: 1.2, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 6500, gain: -0.6, q: 1.2, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 14000, gain: -1.5, q: 0.71, enabled: true } // Tape smoothing
                ]
            },
            multiband_compressor: {
                crossoverLow: 120,
                crossoverMid: 1200,
                crossoverHigh: 6000,
                channelMode: 'stereo',
                bands: [
                    { threshold: -16, ratio: 1.8, attack: 45, release: 160, makeup: 0.4, bypass: false },
                    { threshold: -14, ratio: 1.5, attack: 35, release: 120, makeup: 0.2, bypass: false },
                    { threshold: -14, ratio: 1.5, attack: 25, release: 100, makeup: 0.2, bypass: false },
                    { threshold: -15, ratio: 1.6, attack: 18, release: 80, makeup: 0.3, bypass: false }
                ]
            },
            master_compressor: {
                threshold: -14.0,
                ratio: 1.8,
                attack: 40.0,
                release: 220.0,
                knee: 8.0,
                makeup: 0.8,
                mix: 90.0
            },
            tube_saturator: {
                drive: 32.0,
                warmth: 75.0,
                mix: 65.0,
                outputGain: -0.5
            },
            stereo_imager: {
                width: 105.0,
                monoBassFreq: 140.0 // Strict vinyl mono sub
            },
            lookahead_limiter: {
                ceiling: -0.8,
                release: 120.0,
                softClip: true,
                drive: 1.8
            }
        }
    },
    {
        id: 'acoustic_vocal_clarity',
        name: 'Acoustic & Vocal Intimacy',
        category: 'Acoustic / Jazz',
        description: 'Maximum dynamic transparency, natural vocal breath, wide open soundstage, and zero squashing.',
        settings: {
            parametric_eq: {
                matchAmount: 0.8,
                smoothing: 0.6,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 40, gain: -1.0, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 140, gain: 0.0, q: 1.4, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 300, gain: -0.8, q: 1.6, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1500, gain: 0.5, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 3800, gain: 1.2, q: 1.5, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 8000, gain: 1.0, q: 1.2, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 13500, gain: 1.5, q: 0.71, enabled: true }
                ]
            },
            multiband_compressor: {
                crossoverLow: 100,
                crossoverMid: 1000,
                crossoverHigh: 5000,
                channelMode: 'stereo',
                bands: [
                    { threshold: -14, ratio: 1.5, attack: 40, release: 150, makeup: 0.2, bypass: false },
                    { threshold: -12, ratio: 1.4, attack: 30, release: 110, makeup: 0.1, bypass: false },
                    { threshold: -13, ratio: 1.4, attack: 22, release: 90, makeup: 0.2, bypass: false },
                    { threshold: -14, ratio: 1.5, attack: 15, release: 70, makeup: 0.3, bypass: false }
                ]
            },
            master_compressor: {
                threshold: -12.0,
                ratio: 1.5,
                attack: 50.0,
                release: 250.0,
                knee: 10.0,
                makeup: 0.5,
                mix: 70.0
            },
            tube_saturator: {
                drive: 6.0,
                warmth: 20.0,
                mix: 25.0,
                outputGain: 0.0
            },
            stereo_imager: {
                width: 120.0,
                monoBassFreq: 80.0
            },
            lookahead_limiter: {
                ceiling: -1.0,
                release: 110.0,
                softClip: false,
                drive: 1.2
            }
        }
    },
    {
        id: 'heavy_rock_punch',
        name: 'Rock & Metal Wall-of-Sound',
        category: 'Rock / Metal',
        description: 'Driving mid-frequency guitar cut, aggressive snare crack, tight kick transient glue, and maximum loudness density.',
        settings: {
            parametric_eq: {
                matchAmount: 1.1,
                smoothing: 0.45,
                bands: [
                    { id: 'sub', type: 'lowshelf', freq: 40, gain: 1.0, q: 0.71, enabled: true },
                    { id: 'low', type: 'peaking', freq: 110, gain: 1.5, q: 1.4, enabled: true },
                    { id: 'low_mid', type: 'peaking', freq: 400, gain: -1.8, q: 1.8, enabled: true },
                    { id: 'mid', type: 'peaking', freq: 1200, gain: 0.6, q: 1.4, enabled: true },
                    { id: 'high_mid', type: 'peaking', freq: 2600, gain: 1.8, q: 1.5, enabled: true },
                    { id: 'presence', type: 'peaking', freq: 5000, gain: 1.2, q: 1.4, enabled: true },
                    { id: 'air', type: 'highshelf', freq: 11000, gain: 1.8, q: 0.71, enabled: true }
                ]
            },
            multiband_compressor: {
                crossoverLow: 130,
                crossoverMid: 1200,
                crossoverHigh: 5500,
                channelMode: 'stereo',
                bands: [
                    { threshold: -20, ratio: 3.0, attack: 22, release: 90, makeup: 1.2, bypass: false },
                    { threshold: -17, ratio: 2.2, attack: 18, release: 75, makeup: 0.6, bypass: false },
                    { threshold: -16, ratio: 2.2, attack: 14, release: 65, makeup: 0.8, bypass: false },
                    { threshold: -18, ratio: 2.5, attack: 10, release: 50, makeup: 1.0, bypass: false }
                ]
            },
            master_compressor: {
                threshold: -18.0,
                ratio: 2.8,
                attack: 18.0,
                release: 110.0,
                knee: 4.0,
                makeup: 1.8,
                mix: 90.0
            },
            tube_saturator: {
                drive: 28.0,
                warmth: 50.0,
                mix: 60.0,
                outputGain: 0.0
            },
            stereo_imager: {
                width: 115.0,
                monoBassFreq: 100.0
            },
            lookahead_limiter: {
                ceiling: -0.4,
                release: 70.0,
                softClip: true,
                drive: 4.8
            }
        }
    }
];

const STORAGE_KEY = 'aura_master_custom_presets_v1';

export class PresetManager {
    static getPresets() {
        return MASTERING_PRESETS;
    }

    static getCustomPresets() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (_) {
            return [];
        }
    }

    static saveCustomPreset(name, rack) {
        if (!name || !rack) return null;
        const currentSettings = {};

        for (const mod of rack.modules) {
            currentSettings[mod.type] = JSON.parse(JSON.stringify(mod.params));
        }

        const custom = {
            id: `custom_${Date.now()}`,
            name: name.trim(),
            category: 'User Custom',
            description: 'User saved custom mastering chain profile.',
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

        for (const [modType, params] of Object.entries(preset.settings)) {
            const targetMod = rack.modules.find(m => m.type === modType);
            if (targetMod) {
                rack.setModuleParams(targetMod.id, params);
            }
        }
        return true;
    }

    static exportPresetsAsJson() {
        const custom = this.getCustomPresets();
        const exportObj = {
            app: 'AURA Master',
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
