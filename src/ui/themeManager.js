/**
 * Mestre UI Theme System
 * 10 Curated Professional Audio Workstation Themes (5 Dark & 5 Night Modes)
 * Complete with distinct palettes, typography (Google Fonts), corner radiuses, and tactile styling.
 */

export const THEMES = [
    // -------------------------------------------------------------------------
    // 5 DARK THEMES
    // -------------------------------------------------------------------------
    {
        id: 'dark_studio',
        name: 'Studio Gunmetal',
        mode: 'dark',
        subtitle: 'Precision Pro German Mastering Console',
        badge: 'Classic 6px',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        fontMono: 'JetBrains Mono',
        radiusCard: '6px',
        radiusControl: '4px',
        heritage: 'Weiss, Sonnox, Neumann Mastering Consoles',
        description: 'Deep balanced charcoal with brushed gunmetal steel, electric precision cyan, warm studio amber, and analog green.',
        swatches: {
            bg: '#0a0d14',
            card: '#131926',
            target: '#00e5ff',
            ref: '#f59e0b',
            match: '#10b981',
            accent: '#a855f7'
        }
    },
    {
        id: 'dark_obsidian',
        name: 'Obsidian Slate',
        mode: 'dark',
        subtitle: 'Nordic Minimalist Audio Architecture',
        badge: 'Nordic 10px',
        fontHeading: 'Plus Jakarta Sans',
        fontBody: 'Plus Jakarta Sans',
        fontMono: 'JetBrains Mono',
        radiusCard: '10px',
        radiusControl: '6px',
        heritage: 'Elektron, Teenage Engineering, Scandinavian Design',
        description: 'Cool blue-graphite slate with arctic ice sky blue, titanium white, and soft geometric curvatures for low visual fatigue.',
        swatches: {
            bg: '#0b0f17',
            card: '#151d2c',
            target: '#38bdf8',
            ref: '#fb923c',
            match: '#34d399',
            accent: '#818cf8'
        }
    },
    {
        id: 'dark_espresso',
        name: 'Vintage Bronze & Espresso',
        mode: 'dark',
        subtitle: 'Aged Tube & Discrete Console Suite',
        badge: 'Bronze 12px',
        fontHeading: 'DM Sans',
        fontBody: 'DM Sans',
        fontMono: 'JetBrains Mono',
        radiusCard: '12px',
        radiusControl: '6px',
        heritage: 'Manley Massive Passive, Fairchild 670, Neve 1073',
        description: 'Dark roasted espresso and aged walnut walnut chassis, burnished brass accents, amber copper meters, and velvet cream text.',
        swatches: {
            bg: '#120e0c',
            card: '#221a16',
            target: '#f59e0b',
            ref: '#ea580c',
            match: '#10b981',
            accent: '#d97706'
        }
    },
    {
        id: 'dark_carbon',
        name: 'Carbon Matrix & Cyber Lime',
        mode: 'dark',
        subtitle: 'Motorsport Telemetry & Aerospace Audio',
        badge: 'Sharp 3px',
        fontHeading: 'Space Grotesk',
        fontBody: 'Space Grotesk',
        fontMono: 'JetBrains Mono',
        radiusCard: '3px',
        radiusControl: '2px',
        heritage: 'McLaren Telemetry, Moog One, High-End Synthesis',
        description: 'Technical carbon weave chassis with razor-sharp 3px chamfered corners, electric acid lime lasers, and hazard yellow indicators.',
        swatches: {
            bg: '#0e1114',
            card: '#181d24',
            target: '#a3e635',
            ref: '#facc15',
            match: '#4ade80',
            accent: '#22d3ee'
        }
    },
    {
        id: 'dark_amethyst',
        name: 'Royal Amethyst & Violet',
        mode: 'dark',
        subtitle: 'Boutique French Luxury Audio Lab',
        badge: 'Luxury 14px',
        fontHeading: 'Outfit',
        fontBody: 'Outfit',
        fontMono: 'JetBrains Mono',
        radiusCard: '14px',
        radiusControl: '8px',
        heritage: 'Arturia, Devialet, Custom Parisian Mastering Labs',
        description: 'Imperial midnight violet and royal plum velvet aura, high-curvature 14px organic cards, and radiant neon amethyst glow.',
        swatches: {
            bg: '#0f0a1a',
            card: '#1c1330',
            target: '#c084fc',
            ref: '#f43f5e',
            match: '#a855f7',
            accent: '#e879f9'
        }
    },

    // -------------------------------------------------------------------------
    // 5 NIGHT MODES
    // -------------------------------------------------------------------------
    {
        id: 'night_oled',
        name: 'OLED Pure Pitch Stealth',
        mode: 'night',
        subtitle: 'Zero Light Bleed Surgical Precision',
        badge: 'Stealth 2px',
        fontHeading: 'Space Grotesk',
        fontBody: 'JetBrains Mono',
        fontMono: 'JetBrains Mono',
        radiusCard: '2px',
        radiusControl: '2px',
        heritage: 'Aviation HUDs, OLED Darkrooms, Tactical Monospace',
        description: 'True 100% black (#000000) background for zero light bleed in dark control rooms. Surgical 2px borders and high-contrast meters.',
        swatches: {
            bg: '#000000',
            card: '#0a0a0a',
            target: '#00f0ff',
            ref: '#ffaa00',
            match: '#00ffaa',
            accent: '#b866ff'
        }
    },
    {
        id: 'night_cyberpunk',
        name: 'Cyberpunk Neo-Tokyo',
        mode: 'night',
        subtitle: 'High-Voltage Synthetic Nocturne',
        badge: 'Neon 8px',
        fontHeading: 'Syne',
        fontBody: 'Syne',
        fontMono: 'JetBrains Mono',
        radiusCard: '8px',
        radiusControl: '4px',
        heritage: 'Akira, Blade Runner, Shinjuku Midnight Rain',
        description: 'Deep midnight indigo with intense hyper-cyan lasers, hot magenta beams, and cyberpunk typography that comes alive in the dark.',
        swatches: {
            bg: '#04020a',
            card: '#100822',
            target: '#00ffff',
            ref: '#ff007f',
            match: '#00ff88',
            accent: '#ffe600'
        }
    },
    {
        id: 'night_abyss',
        name: 'Mariana Abyss Nocturne',
        mode: 'night',
        subtitle: 'Deep Trench Bioluminescent Azure',
        badge: 'Aqua 12px',
        fontHeading: 'Outfit',
        fontBody: 'Outfit',
        fontMono: 'JetBrains Mono',
        radiusCard: '12px',
        radiusControl: '6px',
        heritage: 'Deep Sea Exploration, Bioluminescent Marine Science',
        description: 'Deepest oceanic abyssal navy with bioluminescent aqua and marine emerald illumination. Calming, focused nocturnal depth.',
        swatches: {
            bg: '#02050e',
            card: '#091228',
            target: '#00e5ff',
            ref: '#38bdf8',
            match: '#00f5a0',
            accent: '#60a5fa'
        }
    },
    {
        id: 'night_crimson',
        name: 'Crimson Darkroom / Red Shift',
        mode: 'night',
        subtitle: 'Tactical Circadian Preservation',
        badge: 'Ruby 4px',
        fontHeading: 'Space Grotesk',
        fontBody: 'Inter',
        fontMono: 'JetBrains Mono',
        radiusCard: '4px',
        radiusControl: '2px',
        heritage: 'Submarine Night Ops, Astrophotography Darkroom',
        description: 'Zero blue light emissions. Deep ember charcoal with ruby red and tactical infrared illumination to protect night-vision melatonin.',
        swatches: {
            bg: '#080203',
            card: '#18070a',
            target: '#ff1e40',
            ref: '#ff6b00',
            match: '#ff4d6d',
            accent: '#ff0055'
        }
    },
    {
        id: 'night_aurora',
        name: 'Aurora Borealis Nocturne',
        mode: 'night',
        subtitle: 'Arctic Midnight Polar Lights',
        badge: 'Emerald 16px',
        fontHeading: 'Plus Jakarta Sans',
        fontBody: 'Plus Jakarta Sans',
        fontMono: 'JetBrains Mono',
        radiusCard: '16px',
        radiusControl: '8px',
        heritage: 'Tromsø & Reykjavik Northern Lights Observatories',
        description: 'Deep polar black with undulating northern lights spectral emerald, glacial mint, celestial violet glow, and organic 16px smooth curves.',
        swatches: {
            bg: '#020b08',
            card: '#081e17',
            target: '#00ff9d',
            ref: '#38bdf8',
            match: '#34d399',
            accent: '#c084fc'
        }
    }
];

const THEME_STORAGE_KEY = 'mestre_ui_theme_id';

export class ThemeManager {
    static getThemes() {
        return THEMES;
    }

    static getTheme(themeId) {
        return THEMES.find(t => t.id === themeId) || THEMES[0];
    }

    static getCurrentThemeId() {
        return localStorage.getItem(THEME_STORAGE_KEY) || 'dark_studio';
    }

    static applyTheme(themeId) {
        const theme = this.getTheme(themeId);
        document.documentElement.setAttribute('data-theme', theme.id);
        localStorage.setItem(THEME_STORAGE_KEY, theme.id);

        // Synchronize any dropdown selectors
        const themeSelect = document.getElementById('select-ui-theme');
        if (themeSelect && themeSelect.value !== theme.id) {
            themeSelect.value = theme.id;
        }

        // Dispatch global event for visualizers and canvas renderers
        window.dispatchEvent(new CustomEvent('mestre-theme-change', {
            detail: { theme }
        }));

        return theme;
    }

    static init() {
        const savedTheme = this.getCurrentThemeId();
        this.applyTheme(savedTheme);
    }
}
