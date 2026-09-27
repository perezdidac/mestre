/**
 * Mestre UI Theme System
 * 10 Curated Professional Audio Workstation Themes (5 Dark & 5 Light Modes)
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
    // 5 LIGHT MODES
    // -------------------------------------------------------------------------
    {
        id: 'light_studio',
        name: 'Bright Anodized Studio',
        mode: 'light',
        subtitle: 'Precision Silver Solid State Console',
        badge: 'Studio 6px',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        fontMono: 'JetBrains Mono',
        radiusCard: '6px',
        radiusControl: '4px',
        heritage: 'Weiss, Grace Design, Benchmark Media Systems',
        description: 'Crisp anodized aluminum console with deep slate primary accents, cerulean precision meters, amber reference indicators, and subtle recessed bevels.',
        swatches: {
            bg: '#f1f5f9',
            card: '#ffffff',
            target: '#0284c7',
            ref: '#d97706',
            match: '#059669',
            accent: '#7c3aed'
        }
    },
    {
        id: 'light_polar',
        name: 'Polar Glacial Minimalist',
        mode: 'light',
        subtitle: 'Nordic Clean Acoustic Laboratory',
        badge: 'Glacial 12px',
        fontHeading: 'Plus Jakarta Sans',
        fontBody: 'Plus Jakarta Sans',
        fontMono: 'JetBrains Mono',
        radiusCard: '12px',
        radiusControl: '6px',
        heritage: 'Bang & Olufsen, Scandinavian Architectural Hi-Fi',
        description: 'Ultra-clean pure white and glacial mist aesthetics with vivid sapphire blue, citrus flame reference, and smooth 12px ergonomic card curves.',
        swatches: {
            bg: '#f8fafc',
            card: '#ffffff',
            target: '#0284c7',
            ref: '#ea580c',
            match: '#10b981',
            accent: '#6366f1'
        }
    },
    {
        id: 'light_champagne',
        name: 'Champagne Gold & Cream',
        mode: 'light',
        subtitle: 'Japanese Audiophile Master Heritage',
        badge: 'Gold 10px',
        fontHeading: 'DM Sans',
        fontBody: 'DM Sans',
        fontMono: 'JetBrains Mono',
        radiusCard: '10px',
        radiusControl: '5px',
        heritage: 'Accuphase, Luxman, Marantz Golden Reference',
        description: 'Warm champagne gold and ivory silk velvet chassis, deep amber meters, brushed copper screws, and elegant vintage typography.',
        swatches: {
            bg: '#f7f3ec',
            card: '#fffdfa',
            target: '#b45309',
            ref: '#c2410c',
            match: '#047857',
            accent: '#9333ea'
        }
    },
    {
        id: 'light_clay',
        name: 'Desert Clay & Terracotta',
        mode: 'light',
        subtitle: 'Architectural Tactile Warmth',
        badge: 'Tactile 4px',
        fontHeading: 'Space Grotesk',
        fontBody: 'Space Grotesk',
        fontMono: 'JetBrains Mono',
        radiusCard: '4px',
        radiusControl: '3px',
        heritage: 'Bauhaus Industrial Design, Modern Ceramic Architecture',
        description: 'Warm sandy travertine and terracotta earth tones, crisp geometric 4px corners, punchy burnt orange, and forest match accents.',
        swatches: {
            bg: '#f3f2ef',
            card: '#ffffff',
            target: '#ea580c',
            ref: '#d97706',
            match: '#15803d',
            accent: '#0284c7'
        }
    },
    {
        id: 'light_lavender',
        name: 'Lilac Quartz & Boutique Rose',
        mode: 'light',
        subtitle: 'Parisian Haute Horlogerie & Sound',
        badge: 'Boutique 16px',
        fontHeading: 'Outfit',
        fontBody: 'Outfit',
        fontMono: 'JetBrains Mono',
        radiusCard: '16px',
        radiusControl: '8px',
        heritage: 'French Acoustic Salons, Boutique Studio Furniture',
        description: 'Airy lilac mist and soft quartz rose with royal purple indicators, generous 16px pebble curvatures, and high-fashion luxury feel.',
        swatches: {
            bg: '#f6f3fc',
            card: '#ffffff',
            target: '#7c3aed',
            ref: '#e11d48',
            match: '#059669',
            accent: '#c026d3'
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
