/**
 * Mestre Modular Rack Hardware Documentation & Algorithm Guide
 * Provides hardware heritage, DSP algorithm signal flow, and pro mastering guidance
 * for all 11 studio processor modules.
 */

export const MODULE_DOCUMENTATION = {
    parametric_eq: {
        title: 'Parametric Match EQ',
        serial: 'M-101 // MATCH EQ',
        badge: 'Spectral Shaping',
        heritage: 'Sontec MES-432C, GML 9500, FabFilter Pro-Q 3',
        description: '7-band precision mastering equalizer featuring continuous difference-curve matching between your target track and commercial reference spectra.',
        algorithm: [
            'Cascaded minimum-phase 2nd-order biquad IIR filters with zero latency and smooth parameter interpolation.',
            'Direct FFT spectrum difference projection: computes deviation between target audio and commercial reference, applying an inverted delta curve scaled by the Match Amount parameter.',
            'Gaussian spectral smoothing filter to eliminate narrow-band resonant peaks while preserving broad musical tonal balance.'
        ],
        controlsGuide: [
            { name: 'Match Amount (0 - 200%)', desc: 'Scales the calculated difference curve between target and reference spectra.' },
            { name: 'Smoothing (0 - 100%)', desc: 'Controls frequency domain smoothing width to avoid jagged phase coloration.' },
            { name: 'Per-Band Gain / Freq / Q', desc: 'Surgical manual control for Sub (40Hz), Low (120Hz), Low-Mid (350Hz), Mid (1kHz), High-Mid (3.5kHz), Presence (7kHz), and Air (13kHz).' }
        ],
        masteringTips: 'Keep broad mastering boosts and cuts under 2.5 dB with gentle Q (0.7 - 1.4). Use high-Q notches (Q > 3.0) only to surgically tame rogue room resonances.'
    },

    dynamic_deharsh: {
        title: 'Dynamic Resonance De-Harsh',
        serial: 'M-102 // DYNAMIC DE-HARSH',
        badge: 'Harshness Suppressor',
        heritage: 'Weiss DS1-MK3, Oeksound Soothe2, Empirical Labs Derreser',
        description: 'Smart frequency-dependent dynamic notch suppressor designed to eliminate digital brittleness, splashy cymbal glare, and harsh vocal sibilance.',
        algorithm: [
            'Dedicated sidechain bandpass filter isolates problem frequencies between 2.5 kHz and 12 kHz.',
            'Dynamic envelope detector triggers instantaneous narrow-band attenuation only when harmonic energy exceeds the threshold.',
            'Transparent minimum-phase notch filter attenuates problem glare during loud transients and recovers automatically, leaving ambient air intact.'
        ],
        controlsGuide: [
            { name: 'Target Freq (2.5k - 12k)', desc: 'Centers the dynamic detection and attenuation notch around the harsh resonance.' },
            { name: 'Threshold (-36 to 0 dB)', desc: 'Sets the level above which high-frequency reduction begins.' },
            { name: 'Max Reduction (0 to 12 dB)', desc: 'Caps the maximum dynamic cut depth applied during intense peaks.' },
            { name: 'Filter Q (0.7 to 4.0)', desc: 'Selects between broad de-glare (low Q) and surgical sibilance notch (high Q).' }
        ],
        masteringTips: 'Sweep Target Freq to locate digital harshness (usually 5.0 - 7.5 kHz on modern masters). Aim for 1.5 to 3.0 dB of reduction on loud peaks.'
    },

    multiband_compressor: {
        title: '4-Band Multi-Channel Compressor',
        serial: 'M-204 // QUAD-BAND DYNAMICS',
        badge: 'Multi-Rate Dynamics',
        heritage: 'TC Electronic System 6000 (MD4), Tube-Tech SMC 2BM, FabFilter Pro-MB',
        description: 'Precision 4-band mastering dynamics processor with Linkwitz-Riley 4th-order crossovers, Mid/Side matrixing, and per-band solo auditioning.',
        algorithm: [
            '4-way Linkwitz-Riley crossover network (24 dB/octave) ensuring perfect phase alignment and flat magnitude response when uncompressed.',
            'Four independent soft-knee feed-forward compressors with variable attack/release envelopes tailored to their frequency domain.',
            'Full Mid/Side stereo decoding matrix allowing independent center punch and wide stereo room control.'
        ],
        controlsGuide: [
            { name: 'Crossovers (Hz)', desc: 'Adjusts split frequencies for Sub (<150Hz), Low-Mid (150-1.2k), High-Mid (1.2k-6k), and High Air (>6k).' },
            { name: 'Channel Mode', desc: 'Switches between standard Stereo and Mid/Side processing modes.' },
            { name: 'Threshold & Makeup', desc: 'Sets dynamic onset and makeup gain per frequency band.' },
            { name: 'Band Solo & Bypass', desc: 'Isolates individual frequency bands for surgical diagnostic auditioning.' }
        ],
        masteringTips: 'Use fast attack (15-25 ms) on the sub band to clamp rogue 808 transients. Apply gentle 1-2 dB compression to high-mids to sit vocals into the mix.'
    },

    master_compressor: {
        title: 'VCA Bus Compressor',
        serial: 'M-301 // VCA BUS COMPRESSOR',
        badge: 'Dynamic Glue',
        heritage: 'Solid State Logic (SSL) G-Master Bus, API 2500, Neve 33609',
        description: 'Classic analog VCA bus compressor delivering musical glue, cohesion, and transient impact to the stereo master.',
        algorithm: [
            'True RMS power-law level detector providing program-dependent responsiveness matching human loudness perception.',
            'Variable soft-knee curve transitioning smoothly into logarithmic compression without transient shatter.',
            'Parallel wet/dry blend matrix enabling New York style parallel compression directly inside the master channel.'
        ],
        controlsGuide: [
            { name: 'Threshold (-30 to 0 dB)', desc: 'Controls dynamic actuation onset level.' },
            { name: 'Ratio (1.2:1 to 10:1)', desc: 'Compression slope; 1.5:1 and 2:1 are mastering standards.' },
            { name: 'Attack (1 to 100 ms)', desc: 'Longer attack (>30ms) lets kick and snare transients punch through before compression.' },
            { name: 'Release (50 to 1200 ms)', desc: 'Shapes tempo-synced dynamic breathing and release contour.' }
        ],
        masteringTips: 'For classic mastering glue, set Ratio to 2:1, Attack to 30ms, and adjust Threshold until the gain reduction needle bounces between 1.0 and 2.0 dB on beat hits.'
    },

    opto_compressor: {
        title: 'Opto-Cell Warmth Leveler',
        serial: 'M-302 // OPTO-CELL LEVELER',
        badge: 'Vintage Leveler',
        heritage: 'Teletronix LA-2A, Tube-Tech CL 1B, Avalon VT-737sp',
        description: 'Smooth vintage optical leveler emulating the non-linear multi-stage release characteristics of classic cadmium sulfide photocells.',
        algorithm: [
            'Simulated electro-luminescent optical cell with non-linear multi-stage release: fast initial release (50% recovery in ~60ms) followed by an extended logarithmic tail.',
            'Soft, continuous knee that automatically increases ratio as the signal pushes deeper into gain reduction.',
            'Zero-transient-distortion leveling curve ideal for acoustic, vocal, and dynamic jazz recordings.'
        ],
        controlsGuide: [
            { name: 'Peak Reduction (0 - 100)', desc: 'Simultaneously drives input gain into the optical detector cell.' },
            { name: 'Emphasis (0 - 100)', desc: 'High-frequency sidechain filter making the compressor less sensitive to heavy sub-bass.' },
            { name: 'Speed Mode', desc: 'Toggles between classic Slow optical decay and Fast modern recovery.' }
        ],
        masteringTips: 'Ideal for taming dynamic vocal peaks and acoustic guitars transparently. Keep peak reduction under 2.0 dB for silky, effortless dynamic control.'
    },

    transient_shaper: {
        title: 'Dynamic Transient Shaper',
        serial: 'M-205 // MASTER TRANSIENT SHAPER',
        badge: 'Transient Sculptor',
        heritage: 'SPL Transient Designer 4, Elysia nveloper, Softube Transient Shaper',
        description: 'Level-independent differential dynamics processor for contouring transient punch and acoustic sustain tails.',
        algorithm: [
            'Dual envelope followers: compares an instantaneous peak envelope (5ms) against a continuous RMS energy envelope (50ms).',
            'Differential transient detector calculating instantaneous ratio of attack transients to sustained decay.',
            'Independent positive and negative gain matrices for Attack punch (+/- 6 dB) and Sustain room tail (+/- 6 dB).'
        ],
        controlsGuide: [
            { name: 'Attack (-6.0 to +6.0 dB)', desc: 'Boosts or attenuates the onset transient spike of drums, percussion, and plucks.' },
            { name: 'Sustain (-6.0 to +6.0 dB)', desc: 'Expands or clamps room ambience, reverb decay, and body.' },
            { name: 'Detection Speed (ms)', desc: 'Calibrates envelope follower integration window.' },
            { name: 'Output Gain & Mix', desc: 'Compensates overall level and allows parallel transient shaping.' }
        ],
        masteringTips: 'If previous mix compression flattened your drum hits, a +0.8 to +1.5 dB attack lift restores punch without increasing perceived peak volume.'
    },

    tube_saturator: {
        title: 'Harmonic Tube Saturator',
        serial: 'M-401 // HARMONIC TUBE SATURATOR',
        badge: 'Analog Warmth',
        heritage: 'Thermionic Culture The Vulture, Manley Massive Passive, Pendulum PL-2',
        description: 'Mastering-grade vacuum tube triode/pentode saturation adding rich 2nd and 3rd harmonic overtones and analog density.',
        algorithm: [
            'Continuous smooth polynomial transfer function emulating vacuum tube triode grid conduction without harsh square-wave clipping.',
            '4x oversampling anti-aliasing engine suppressing nyquist foldback intermodulation distortion.',
            'Asymmetrical 2nd-order harmonic generator producing warm musical octave harmonics.'
        ],
        controlsGuide: [
            { name: 'Drive (0 - 30 dB)', desc: 'Controls depth of analog tube saturation and gentle peak compression.' },
            { name: 'Warmth (0 - 100%)', desc: 'Biases the curve towards even-order 2nd harmonic richness.' },
            { name: 'Output Gain (dB)', desc: 'Post-saturation trim gain compensation.' },
            { name: 'Mix (0 - 100%)', desc: 'Parallel dry/wet harmonic blend.' }
        ],
        masteringTips: 'In mastering, harmonic saturation is about perceived depth rather than audible fuzz. Use Drive 3 - 6 dB with Warmth 20 - 30% for analog cohesion.'
    },

    analog_tape: {
        title: 'Analog Master Tape Machine',
        serial: 'M-402 // ANALOG MASTER TAPE',
        badge: 'Magnetic Tape Deck',
        heritage: 'Studer A800 1/2", Ampex ATR-102, MCI JH-110, Lundahl Transformers',
        description: 'High-end 1/2" 2-track master tape deck emulation with magnetic particle hysteresis, transformer iron core, head bump, and wow/flutter.',
        algorithm: [
            'Magnetic domain flux hysteresis modeling tape compression and soft magnetic saturation.',
            'Playback head resonance peaking filter modeling the classic 55 Hz low-end head bump.',
            'Tape speed switching: 30 IPS (ultra-linear, high fidelity), 15 IPS (classic rock punch, low-mid weight), and 7.5 IPS (vintage warmth, rolled-off top).',
            'Dual-LFO capstan wow (0.7 Hz) and scrape flutter (3.2 Hz) driving fractional stereo delay modulation.'
        ],
        controlsGuide: [
            { name: 'Tape Speed (30 / 15 / 7.5 IPS)', desc: 'Selects playback tape formulation and high-frequency shelf profile.' },
            { name: 'Tape Drive (0 - 18 dB)', desc: 'Drives audio into magnetic tape saturation.' },
            { name: 'Head Bump (0 - 4 dB)', desc: 'Enhances 55 Hz low-end chest punch.' },
            { name: 'Core Transformer (0 - 100%)', desc: 'Injects low-frequency transformer hysteresis and weight.' },
            { name: 'Flutter & Wow (0 - 100%)', desc: 'Micro-timing and pitch analog transport fluctuations.' }
        ],
        masteringTips: 'Select 15 IPS with 1.0 - 2.5 dB Drive and 0.3 - 0.5 dB Head Bump for subtle, expensive tape glue and analog coherence without harsh clipping or mud.'
    },

    studio_reverb: {
        title: 'Studio Acoustic Space & Reverb',
        serial: 'M-502 // STUDIO ACOUSTIC REVERB',
        badge: 'Convolution Space',
        heritage: 'Lexicon 480L, Bricasti M7, Abbey Road Studio Two Chamber',
        description: 'Studio convolution reverberation processor designed for subtle spatial glue, 3D room dimension, and master bus depth.',
        algorithm: [
            'Zero-latency, zero-feedback convolution engine utilizing analytically generated high-resolution stereo impulse responses.',
            'Schroeder early reflection clusters providing immediate spatial localization cues without phase smearing.',
            'Exponential diffuse decay tail with frequency-dependent HF absorption damping.',
            'Pre-delay buffer separating dry transients from acoustic bloom, plus 140 Hz high-pass pre-filtering to protect bass clarity.'
        ],
        controlsGuide: [
            { name: 'Room Size (10 - 100%)', desc: 'Scales early reflection spacing and virtual room volume.' },
            { name: 'Decay Time (0.3 - 4.0 s)', desc: 'Controls RT60 reverberation decay length.' },
            { name: 'Pre-Delay (0 - 100 ms)', desc: 'Separates dry drum transients before reverb onset.' },
            { name: 'HF Damping (1.5k - 16k)', desc: 'Absorbs high frequencies over time, simulating acoustic wall materials.' },
            { name: 'Stereo Width & Mix', desc: 'Controls wet spatial spread and subtle mastering blend.' }
        ],
        masteringTips: 'Mastering reverb should be felt when bypassed rather than heard during playback. Keep Mix subtle (6 - 12%) with 20 - 35 ms Pre-Delay.'
    },

    stereo_imager: {
        title: 'Stereo Matrix & Mono Bass Focus',
        serial: 'M-501 // STEREO MATRIX & BASS',
        badge: 'Spatial Field',
        heritage: 'Brainworx bx_digital V3, Dangerous Music BAX EQ, Neumann Elliptic Equalizer',
        description: 'Mid/Side spatial field processor with elliptic bass mono-centering filter to ensure mono compatibility and vinyl club standard bass.',
        algorithm: [
            'High-precision Sum and Difference matrix: Mid = (L+R)/sqrt(2), Side = (L-R)/sqrt(2).',
            'Elliptic low-frequency crossover summing all content below chosen cutoff into absolute mono.',
            'Independent stereo width multiplier expanding or focusing the spatial image without altering center channel energy.'
        ],
        controlsGuide: [
            { name: 'Stereo Width (0 - 200%)', desc: '100% is untouched original; >100% widens high/mid ambience; 0% is mono.' },
            { name: 'Mono Bass Cutoff (40 - 250 Hz)', desc: 'Frequencies below this cutoff are centered into pure mono.' }
        ],
        masteringTips: 'Setting Mono Bass to 80 - 100 Hz focuses kick drums and sub bass into the center channel, preventing club subwoofer phase cancellation and vinyl needle jump.'
    },

    lookahead_limiter: {
        title: 'True-Peak Brickwall Limiter',
        serial: 'M-601 // TRUE-PEAK BRICKWALL',
        badge: 'True-Peak Brickwall',
        heritage: 'Weiss DS1-MK3, TC Electronic Brickwall, FabFilter Pro-L 2',
        description: 'Pristine mastering lookahead brickwall limiter with 4x inter-sample peak (ISP) oversampling and optional soft-knee saturation.',
        algorithm: [
            'True lookahead ring buffer allowing instantaneous attack time with zero transient clipping or edge harshness.',
            '4x oversampling True-Peak detector preventing D/A converter reconstruction inter-sample overshoots.',
            'Selectable soft-knee saturation curve that transparently absorbs intense micro-peaks before the brickwall ceiling.'
        ],
        controlsGuide: [
            { name: 'Ceiling (-6.0 to 0.0 dBTP)', desc: 'Sets absolute true-peak ceiling (-1.0 dBTP for Spotify/Apple, -0.2 dBTP for CD).' },
            { name: 'Drive / Threshold (dB)', desc: 'Drives audio level into the limiter to maximize perceived loudness.' },
            { name: 'Release (10 - 500 ms)', desc: 'Adaptive release shaping to prevent pumping on heavy bass hits.' },
            { name: 'Soft-Clip Saturation', desc: 'Engages soft analog saturation on rogue peaks before hard limiting.' }
        ],
        masteringTips: 'For modern streaming distribution, set Ceiling to -1.0 dBTP. Drive the limiter until gain reduction peaks around 1.5 - 2.5 dB on the loudest sections.'
    }
};
