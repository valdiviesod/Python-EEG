/**
 * Pulse 3D — Three.js Botanical Pulse Sculpture
 *
 * Creates a 3D pulse from EEG band analysis:
 *   • 5 petal layers (one per frequency band) growing in height by power
 *   • Organic stem with leaves
 *   • Pistil center with tiny spheres
 *   • Vibrant materials with subsurface scattering feel
 *   • Gentle particle pollen effects
 *   • Unique in-place animation profile per capture (EEG + seed, like colors)
 *   • 16 motion styles (deep_tide, spiral_bloom, quantum_fizz, etc.) — unique engines per capture
 *   • Printable solid continuous mesh with stable circular base
 *   • Auto-rotation + orbit controls
 *
 * Requires Three.js (r128+) loaded globally as THREE
 */

function _pulseHashInt(seed, salt = 0) {
    const str = `${seed}:${salt}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function _pulseHashFloat(seed, salt, min, max) {
    return lerp(min, max, (_pulseHashInt(seed, salt) % 10000) / 10000);
}

// ── Distinct motion personalities — each pulse picks one via EEG + seed ──
const PULSE_MOTION_STYLES = {
    deep_tide: {
        sparkCount: 0, auraCount: 5, pollenCount: 35, pollenMode: 'slow_orbit',
        autoRotate: 0.1, autoRotateDir: -1,
        breathAmpMul: 2.4, breathSpeedMul: 0.38, swayAmpMul: 1.9, petalFlutterMul: 0.18,
        vertexBreathMul: 3.0, layerSpinMul: 0.15, emissiveRangeMul: 0.5, centerPulseMul: 1.6,
        ringPulseMul: 0.35, shimmerMul: 0.2, leafMul: 0.5, tonePulseMul: 0.4,
    },
    spiral_bloom: {
        sparkCount: 2, auraCount: 4, pollenCount: 70, pollenMode: 'spiral',
        autoRotate: 0.75, autoRotateDir: 1,
        breathAmpMul: 0.7, breathSpeedMul: 0.85, swayAmpMul: 0.6, petalFlutterMul: 1.1,
        vertexBreathMul: 0.8, layerSpinMul: 4.2, emissiveRangeMul: 0.9, centerPulseMul: 0.8,
        ringPulseMul: 1.8, shimmerMul: 0.7, leafMul: 1.4, tonePulseMul: 0.6,
    },
    heartbeat: {
        sparkCount: 4, auraCount: 3, pollenCount: 55, pollenMode: 'pulse',
        autoRotate: 0.45, autoRotateDir: 1,
        breathAmpMul: 1.5, breathSpeedMul: 1.6, swayAmpMul: 0.45, petalFlutterMul: 0.75,
        vertexBreathMul: 1.2, layerSpinMul: 0.5, emissiveRangeMul: 1.1, centerPulseMul: 2.2,
        ringPulseMul: 1.4, shimmerMul: 0.9, leafMul: 0.8, tonePulseMul: 0.9,
    },
    staccato: {
        sparkCount: 10, auraCount: 2, pollenCount: 45, pollenMode: 'snap',
        autoRotate: 1.2, autoRotateDir: 1,
        breathAmpMul: 0.55, breathSpeedMul: 2.2, swayAmpMul: 0.35, petalFlutterMul: 1.8,
        vertexBreathMul: 0.45, layerSpinMul: 0.9, emissiveRangeMul: 1.8, centerPulseMul: 1.5,
        ringPulseMul: 2.5, shimmerMul: 1.6, leafMul: 1.2, tonePulseMul: 1.4,
    },
    quantum_fizz: {
        sparkCount: 22, auraCount: 1, pollenCount: 120, pollenMode: 'chaos',
        autoRotate: 1.6, autoRotateDir: -1,
        breathAmpMul: 0.4, breathSpeedMul: 2.8, swayAmpMul: 0.25, petalFlutterMul: 2.4,
        vertexBreathMul: 1.6, layerSpinMul: 1.2, emissiveRangeMul: 2.2, centerPulseMul: 1.8,
        ringPulseMul: 3.0, shimmerMul: 2.8, leafMul: 1.8, tonePulseMul: 2.0,
    },
    wind_sweep: {
        sparkCount: 3, auraCount: 3, pollenCount: 80, pollenMode: 'wind',
        autoRotate: 0.35, autoRotateDir: 1,
        breathAmpMul: 0.9, breathSpeedMul: 0.7, swayAmpMul: 2.4, petalFlutterMul: 1.5,
        vertexBreathMul: 1.0, layerSpinMul: 0.35, emissiveRangeMul: 0.85, centerPulseMul: 0.7,
        ringPulseMul: 0.9, shimmerMul: 0.8, leafMul: 2.2, tonePulseMul: 0.5,
    },
    counter_spin: {
        sparkCount: 6, auraCount: 4, pollenCount: 60, pollenMode: 'counter',
        autoRotate: 0.9, autoRotateDir: -1,
        breathAmpMul: 0.65, breathSpeedMul: 1.1, swayAmpMul: 0.5, petalFlutterMul: 1.0,
        vertexBreathMul: 0.7, layerSpinMul: 3.0, emissiveRangeMul: 1.0, centerPulseMul: 1.0,
        ringPulseMul: 2.0, shimmerMul: 1.0, leafMul: 1.0, tonePulseMul: 0.8,
    },
    bloom_pulse: {
        sparkCount: 5, auraCount: 3, pollenCount: 50, pollenMode: 'pulse',
        autoRotate: 0.55, autoRotateDir: 1,
        breathAmpMul: 1.8, breathSpeedMul: 0.95, swayAmpMul: 0.55, petalFlutterMul: 2.0,
        vertexBreathMul: 0.35, layerSpinMul: 0.25, emissiveRangeMul: 1.3, centerPulseMul: 1.3,
        ringPulseMul: 1.0, shimmerMul: 1.2, leafMul: 0.9, tonePulseMul: 0.7,
    },
    meditative: {
        sparkCount: 0, auraCount: 2, pollenCount: 25, pollenMode: 'slow_orbit',
        autoRotate: 0.08, autoRotateDir: 1,
        breathAmpMul: 0.35, breathSpeedMul: 0.3, swayAmpMul: 0.2, petalFlutterMul: 0.08,
        vertexBreathMul: 0.15, layerSpinMul: 0.08, emissiveRangeMul: 1.6, centerPulseMul: 0.5,
        ringPulseMul: 0.25, shimmerMul: 0.15, leafMul: 0.3, tonePulseMul: 1.2,
    },
    neon_storm: {
        sparkCount: 16, auraCount: 2, pollenCount: 100, pollenMode: 'chaos',
        autoRotate: 1.35, autoRotateDir: -1,
        breathAmpMul: 0.5, breathSpeedMul: 1.8, swayAmpMul: 0.4, petalFlutterMul: 0.6,
        vertexBreathMul: 0.25, layerSpinMul: 0.4, emissiveRangeMul: 2.5, centerPulseMul: 0.9,
        ringPulseMul: 1.6, shimmerMul: 0.5, leafMul: 0.5, tonePulseMul: 2.2,
    },
    ripple_ring: {
        sparkCount: 4, auraCount: 5, pollenCount: 65, pollenMode: 'ripple',
        autoRotate: 0.4, autoRotateDir: 1,
        breathAmpMul: 1.0, breathSpeedMul: 0.75, swayAmpMul: 1.0, petalFlutterMul: 1.3,
        vertexBreathMul: 1.4, layerSpinMul: 0.6, emissiveRangeMul: 1.0, centerPulseMul: 1.1,
        ringPulseMul: 2.8, shimmerMul: 1.0, leafMul: 1.1, tonePulseMul: 0.65,
    },
    volcanic_core: {
        sparkCount: 8, auraCount: 1, pollenCount: 30, pollenMode: 'slow_orbit',
        autoRotate: 0.25, autoRotateDir: 1,
        breathAmpMul: 0.3, breathSpeedMul: 0.55, swayAmpMul: 0.3, petalFlutterMul: 0.15,
        vertexBreathMul: 0.2, layerSpinMul: 0.1, emissiveRangeMul: 1.4, centerPulseMul: 3.5,
        ringPulseMul: 0.6, shimmerMul: 0.3, leafMul: 0.25, tonePulseMul: 1.0,
    },
    helix_bloom: {
        sparkCount: 9, auraCount: 4, pollenCount: 90, pollenMode: 'helix', ribbonCount: 5, ribbonMode: 'helix',
        autoRotate: 0.85, autoRotateDir: 1,
        breathAmpMul: 1.1, breathSpeedMul: 0.9, swayAmpMul: 0.7, petalFlutterMul: 1.6,
        vertexBreathMul: 1.15, layerSpinMul: 2.4, emissiveRangeMul: 1.25, centerPulseMul: 1.1,
        ringPulseMul: 1.7, shimmerMul: 1.4, leafMul: 1.25, tonePulseMul: 0.9,
    },
    crystal_lattice: {
        sparkCount: 14, auraCount: 2, pollenCount: 75, pollenMode: 'snap', ribbonCount: 6, ribbonMode: 'crystal',
        autoRotate: 1.05, autoRotateDir: -1,
        breathAmpMul: 0.45, breathSpeedMul: 1.35, swayAmpMul: 0.32, petalFlutterMul: 0.95,
        vertexBreathMul: 0.65, layerSpinMul: 1.4, emissiveRangeMul: 1.9, centerPulseMul: 1.4,
        ringPulseMul: 2.2, shimmerMul: 1.9, leafMul: 0.8, tonePulseMul: 1.45,
    },
    orbital_crown: {
        sparkCount: 18, auraCount: 5, pollenCount: 105, pollenMode: 'counter', ribbonCount: 7, ribbonMode: 'crown',
        autoRotate: 1.25, autoRotateDir: 1,
        breathAmpMul: 0.8, breathSpeedMul: 1.15, swayAmpMul: 0.5, petalFlutterMul: 1.25,
        vertexBreathMul: 0.9, layerSpinMul: 3.3, emissiveRangeMul: 1.5, centerPulseMul: 1.25,
        ringPulseMul: 2.6, shimmerMul: 1.5, leafMul: 1.05, tonePulseMul: 1.15,
    },
    iris_unfold: {
        sparkCount: 6, auraCount: 3, pollenCount: 65, pollenMode: 'petal_drift', ribbonCount: 4, ribbonMode: 'petal',
        autoRotate: 0.6, autoRotateDir: -1,
        breathAmpMul: 1.45, breathSpeedMul: 0.75, swayAmpMul: 0.65, petalFlutterMul: 2.35,
        vertexBreathMul: 1.45, layerSpinMul: 1.1, emissiveRangeMul: 1.15, centerPulseMul: 1.5,
        ringPulseMul: 1.35, shimmerMul: 1.25, leafMul: 1.0, tonePulseMul: 0.85,
    },
};

const STYLE_BY_DOMINANT = {
    delta: ['deep_tide', 'meditative', 'ripple_ring', 'volcanic_core', 'iris_unfold'],
    theta: ['spiral_bloom', 'wind_sweep', 'ripple_ring', 'meditative', 'helix_bloom'],
    alpha: ['heartbeat', 'bloom_pulse', 'meditative', 'wind_sweep', 'iris_unfold'],
    beta: ['staccato', 'counter_spin', 'neon_storm', 'volcanic_core', 'crystal_lattice'],
    gamma: ['quantum_fizz', 'neon_storm', 'staccato', 'spiral_bloom', 'orbital_crown'],
};

class Pulse3D {
    constructor(container, analyzer, report = null) {
        this.container = container;
        this.analyzer = analyzer;
        this.params = analyzer.pulseParams;
        this.bands = analyzer.normalizedBands;
        this.profile = analyzer.profile;
        this.visualPalette = report?.visualPalette || EEGBandAnalyzer.blendVisualPalette(
            this.bands,
            analyzer.metadata?.capture_timestamp || analyzer.metadata?.profile_name || ''
        );

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationId = null;
        this.clock = null;
        this.flowerGroup = null;
        this.particles = null;
        this.printSpec = [];
        this._destroyed = false;
        this._resizeHandler = () => this._onResize();
        this.animRegistry = {
            petals: [], leaves: [], centers: [], ring: null, stem: null, cap: null,
            lights: [], pollen: null, auras: [], sparkOrbs: [], pulseRibbons: [], ground: null,
            rimLight: null, bgBase: null, bgAccent: null,
        };
        this.animProfile = this._computeAnimationProfile();
    }

    _computeAnimationProfile() {
        const seed = String(
            this.analyzer.metadata?.capture_timestamp
            || this.analyzer.metadata?.profile_name
            || this.visualPalette?.dominant
            || 'pulse'
        );
        const dominant = this.visualPalette?.dominant || 'alpha';
        const getPct = (key) => {
            const band = this.bands.find(b => b.key === key);
            return (band?.percentage || 0) / 100;
        };
        const d = getPct('delta');
        const th = getPct('theta');
        const a = getPct('alpha');
        const b = getPct('beta');
        const g = getPct('gamma');

        const speedJitter = _pulseHashFloat(seed, 1, 0.55, 1.65);
        const phaseBase = _pulseHashFloat(seed, 2, 0, Math.PI * 2);

        const pool = STYLE_BY_DOMINANT[dominant] || STYLE_BY_DOMINANT.alpha;
        const allStyles = Object.keys(PULSE_MOTION_STYLES);
        const wildPick = _pulseHashFloat(seed, 500, 0, 1) > 0.58;
        const motionStyle = wildPick
            ? allStyles[_pulseHashInt(seed, 501) % allStyles.length]
            : pool[_pulseHashInt(seed, 502) % pool.length];
        const style = PULSE_MOTION_STYLES[motionStyle] || PULSE_MOTION_STYLES.heartbeat;

        const ARCHETYPES = {
            delta: {
                breathSpeed: 0.32, breathAmp: 0.09, swayAmp: 0.065, petalFlutter: 0.055,
                emissiveSpeed: 0.55, emissiveRange: 0.55, flutterSpeed: 0.42, centerPulse: 0.48,
                ringPulse: 0.28, autoRotate: 0.32, layerSpin: 0.028, vertexBreath: 0.07,
                auraStrength: 1.15, sparkMul: 0.35,
            },
            theta: {
                breathSpeed: 0.52, breathAmp: 0.075, swayAmp: 0.072, petalFlutter: 0.068,
                emissiveSpeed: 0.85, emissiveRange: 0.62, flutterSpeed: 0.68, centerPulse: 0.72,
                ringPulse: 0.42, autoRotate: 0.52, layerSpin: 0.042, vertexBreath: 0.055,
                auraStrength: 1.0, sparkMul: 0.55,
            },
            alpha: {
                breathSpeed: 0.68, breathAmp: 0.08, swayAmp: 0.048, petalFlutter: 0.052,
                emissiveSpeed: 1.05, emissiveRange: 0.68, flutterSpeed: 0.82, centerPulse: 0.92,
                ringPulse: 0.52, autoRotate: 0.58, layerSpin: 0.034, vertexBreath: 0.048,
                auraStrength: 0.95, sparkMul: 0.7,
            },
            beta: {
                breathSpeed: 1.0, breathAmp: 0.065, swayAmp: 0.038, petalFlutter: 0.085,
                emissiveSpeed: 1.55, emissiveRange: 0.85, flutterSpeed: 1.35, centerPulse: 1.25,
                ringPulse: 0.82, autoRotate: 0.88, layerSpin: 0.022, vertexBreath: 0.04,
                auraStrength: 0.88, sparkMul: 1.15,
            },
            gamma: {
                breathSpeed: 1.28, breathAmp: 0.055, swayAmp: 0.032, petalFlutter: 0.105,
                emissiveSpeed: 2.1, emissiveRange: 1.0, flutterSpeed: 1.75, centerPulse: 1.55,
                ringPulse: 1.05, autoRotate: 1.05, layerSpin: 0.018, vertexBreath: 0.065,
                auraStrength: 1.25, sparkMul: 1.45,
            },
        };
        const arch = ARCHETYPES[dominant] || ARCHETYPES.alpha;

        const calmFactor = 1 + d * 0.4 + th * 0.25 - b * 0.2 - g * 0.15;
        const energyFactor = 1 + b * 0.45 + g * 0.6;
        const m = (v, mul) => v * (mul || 1);

        return {
            seed,
            dominant,
            motionStyle,
            phaseBase,
            speedJitter,
            calmFactor,
            energyFactor,
            autoRotateDir: style.autoRotateDir || 1,
            auraCount: style.auraCount,
            pollenMode: style.pollenMode,
            pollenCount: style.pollenCount,
            ribbonMode: style.ribbonMode || 'soft',
            ribbonCount: Math.round((style.ribbonCount || 2) * (0.75 + energyFactor * 0.22 + th * 0.18)),
            breathSpeed: m(arch.breathSpeed * speedJitter / calmFactor, style.breathSpeedMul),
            breathSpeed2: m(arch.breathSpeed * 1.7 * speedJitter / calmFactor, style.breathSpeedMul * 1.3),
            breathAmp: m(arch.breathAmp * (0.9 + d * 0.35), style.breathAmpMul),
            breathAmp2: m(arch.breathAmp * 0.45, style.breathAmpMul * 0.6),
            swaySpeedX: _pulseHashFloat(seed, 10, 0.12, 0.55) * speedJitter,
            swaySpeedZ: _pulseHashFloat(seed, 11, 0.1, 0.48) * speedJitter,
            swayAmpX: m(arch.swayAmp * _pulseHashFloat(seed, 12, 0.65, 1.55), style.swayAmpMul),
            swayAmpZ: m(arch.swayAmp * _pulseHashFloat(seed, 13, 0.55, 1.45) * 0.7, style.swayAmpMul),
            petalFlutterAmp: m(arch.petalFlutter * (0.85 + energyFactor * 0.35), style.petalFlutterMul),
            petalFlutterSpeed: arch.flutterSpeed * speedJitter * energyFactor * (style.petalFlutterMul > 1.5 ? 1.4 : 1),
            petalWaveSpeed: _pulseHashFloat(seed, 14, 0.35, 1.65) * speedJitter,
            layerSpinAmp: m(arch.layerSpin * (0.8 + th * 0.5), style.layerSpinMul),
            layerWaveSpeed: _pulseHashFloat(seed, 19, 0.28, 1.15) * speedJitter / calmFactor,
            vertexBreathAmp: m(arch.vertexBreath * (0.85 + d * 0.25 + g * 0.2), style.vertexBreathMul),
            vertexBreathSpeed: _pulseHashFloat(seed, 21, 0.45, 1.8) * speedJitter,
            emissiveSpeed: arch.emissiveSpeed * speedJitter * energyFactor * (style.emissiveRangeMul > 1.5 ? 1.35 : 1),
            emissiveRange: m(arch.emissiveRange * (0.75 + g * 0.65), style.emissiveRangeMul),
            centerPulseSpeed: m(arch.centerPulse * speedJitter, style.centerPulseMul > 2 ? 0.7 : 1),
            centerPulseAmp: m(0.12 + a * 0.08 + g * 0.06, style.centerPulseMul),
            centerTwistSpeed: _pulseHashFloat(seed, 15, 0.1, 0.75) * (motionStyle === 'quantum_fizz' ? 3.5 : 1),
            centerBobAmp: m(0.025 + th * 0.02, style.centerPulseMul),
            ringPulseSpeed: m(arch.ringPulse * speedJitter, style.ringPulseMul),
            ringScaleAmp: m(0.035 + th * 0.025, style.ringPulseMul * 0.5),
            leafFlutterSpeed: _pulseHashFloat(seed, 16, 0.4, 1.45) * speedJitter / calmFactor,
            leafFlutterAmp: m(0.14 + th * 0.1, style.leafMul),
            stemTwistSpeed: _pulseHashFloat(seed, 18, 0.06, 0.38) * speedJitter / calmFactor,
            stemTwistAmp: m(0.028 + d * 0.018, style.leafMul),
            stemBendAmp: m(0.018 + th * 0.012, style.swayAmpMul * 0.5),
            pollenOrbitSpeed: _pulseHashFloat(seed, 17, 0.25, 1.45) * speedJitter,
            pollenOrbitRadius: 0.05 + g * 0.06 + (style.pollenMode === 'chaos' ? 0.08 : 0),
            pollenOpacitySpeed: 1.2 + g * 1.2 + (style.pollenMode === 'chaos' ? 2.5 : 0),
            pollenSizePulse: m(0.018 + g * 0.012, style.shimmerMul),
            lightPulseSpeed: arch.emissiveSpeed * 0.75 * speedJitter * style.emissiveRangeMul,
            autoRotateSpeed: (style.autoRotate || arch.autoRotate) * speedJitter * (0.8 + b * 0.3),
            shimmerSpeed: motionStyle === 'quantum_fizz' ? 6.5 : (motionStyle === 'neon_storm' ? 5.2 : (motionStyle === 'staccato' ? 3.8 : 1.6)),
            shimmerAmp: m(0.022 + g * 0.028 + b * 0.018, style.shimmerMul),
            auraPulseSpeed: _pulseHashFloat(seed, 22, 0.3, 1.35) * speedJitter / calmFactor,
            auraStrength: arch.auraStrength * (style.auraCount >= 4 ? 1.15 : 0.85),
            sparkCount: Math.round(style.sparkCount * (0.7 + energyFactor * 0.45)),
            sparkOrbitSpeed: _pulseHashFloat(seed, 23, 0.4, 2.2) * speedJitter * energyFactor,
            sparkOrbitRadius: 0.28 + a * 0.22 + g * 0.18 + (motionStyle === 'quantum_fizz' ? 0.2 : 0),
            ribbonOrbitSpeed: _pulseHashFloat(seed, 24, 0.16, 0.9) * speedJitter * (0.8 + g * 0.45),
            ribbonTwistAmp: m(0.08 + th * 0.08 + g * 0.1, style.layerSpinMul * 0.24),
            ribbonPulseAmp: m(0.05 + a * 0.04 + g * 0.05, style.shimmerMul * 0.55),
            tonePulseAmp: m(0.08 + g * 0.14 + b * 0.08, style.tonePulseMul),
            bgPulseStrength: motionStyle === 'neon_storm' || motionStyle === 'quantum_fizz' ? 0.22 : (0.08 + th * 0.06),
            groundPulseAmp: m(0.025 + d * 0.015, style.breathAmpMul * 0.3),
            staticPetals: motionStyle === 'meditative' || motionStyle === 'volcanic_core',
            staticGroup: motionStyle === 'meditative',
        };
    }

    init() {
        this._destroyed = false;
        const w = this.container.clientWidth || 800;
        const h = this.container.clientHeight || 600;

        // Scene — subtle tint from this capture's band blend, not fixed lavender/peach
        this.scene = new THREE.Scene();
        const accentBg = new THREE.Color(this.visualPalette?.main || '#F5F0F8');
        this.animRegistry.bgBase = accentBg.clone().lerp(new THREE.Color('#F7F4FA'), 0.82);
        this.animRegistry.bgAccent = accentBg.clone();
        this.scene.background = this.animRegistry.bgBase.clone();

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        this.camera.position.set(0, 3.5, 6);
        this.camera.lookAt(0, 1.5, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        if ('outputEncoding' in this.renderer && THREE.sRGBEncoding) {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        }
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Controls
        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 3;
            this.controls.maxDistance = 15;
            this.controls.maxPolarAngle = Math.PI * 0.85;
            this.controls.target.set(0, 1.5, 0);
            this.controls.autoRotate = true;
            this.controls.autoRotateSpeed = this.animProfile.autoRotateSpeed * (this.animProfile.autoRotateDir || 1);
        }

        this.clock = new THREE.Clock();

        // Build the pulse
        this._buildScene();

        // Resize
        window.addEventListener('resize', this._resizeHandler);

        // Start animation
        this._animate();
    }

    _buildScene() {
        this._addLights();

        this.flowerGroup = new THREE.Group();
        this.scene.add(this.flowerGroup);

        this._addBase();
        this._addStem();
        this._addLeaves();
        this._addPetalLayers();
        this._addCenter();
        this._addEnergyAuras();
        this._addPulseRibbons();
        this._addSparkOrbs();
        this._addPollen();
        this._addGround();
    }

    // ── Lights ────────────────────────────────────────────────────────────
    _addLights() {
        const accent = new THREE.Color(this.visualPalette?.main || '#EC4899');
        const accentDeep = new THREE.Color(this.visualPalette?.deep || '#BE185D');

        const ambient = new THREE.AmbientLight(0xF8F6FA, 0.36);
        this.scene.add(ambient);

        const sunLight = new THREE.DirectionalLight(0xFFFCF8, 0.82);
        sunLight.position.set(4, 8, 4);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        this.scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0xEEF2FF, 0.18);
        fillLight.position.set(-3, -1, 2);
        this.scene.add(fillLight);

        // Each band lights its own color — no global peach wash
        const lightPositions = [[-2, 2, 2], [2, 1.5, -2], [0, 4, 0], [2.5, 2.5, 1], [-2.5, 2, -1]];
        const sortedBands = [...this.bands].sort((a, b) => b.percentage - a.percentage);
        sortedBands.slice(0, lightPositions.length).forEach((band, i) => {
            let weight = clamp(band.percentage / 32, 0.1, 1);
            if (band.key === 'beta') weight *= 0.40;
            else if (band.key === 'delta') weight *= 1.22;
            const light = new THREE.PointLight(new THREE.Color(band.color), 0.1 + weight * 0.22, 8);
            light.position.set(...lightPositions[i]);
            this.scene.add(light);
            this.animRegistry.lights.push({
                light,
                baseIntensity: light.intensity,
                phase: _pulseHashFloat(this.animProfile.seed, 20 + i, 0, Math.PI * 2),
            });
        });

        const topLight = new THREE.DirectionalLight(0xFAFAFA, 0.62);
        topLight.position.set(0, 12, 0);
        this.scene.add(topLight);

        const sky = accent.clone().lerp(new THREE.Color('#F4F0FA'), 0.78);
        const ground = accentDeep.clone().lerp(new THREE.Color('#3D4F3A'), 0.68);
        const hemi = new THREE.HemisphereLight(sky.getHex(), ground.getHex(), 0.38);
        this.scene.add(hemi);

        const rimLight = new THREE.DirectionalLight(accent.getHex(), 0.28);
        rimLight.position.set(-6, 5, -6);
        this.scene.add(rimLight);
        this.animRegistry.rimLight = rimLight;
    }

    _boostVibrance(baseColor, saturationBoost = 0.32, lightnessBoost = 0.03) {
        const hsl = { h: 0, s: 0, l: 0 };
        baseColor.getHSL(hsl);
        const boosted = new THREE.Color();
        boosted.setHSL(
            hsl.h,
            clamp(hsl.s + saturationBoost, 0, 1),
            clamp(hsl.l + lightnessBoost, 0, 1)
        );
        return boosted;
    }

    // ── Base Platform (for 3D printing stability) ─────────────────────────
    _addBase() {
        const accent = new THREE.Color(this.visualPalette?.deep || '#6B7280');
        const baseColor = accent.clone().lerp(new THREE.Color('#4B5563'), 0.55);
        const ringColor = accent.clone().lerp(new THREE.Color('#374151'), 0.35);

        const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.08, 64);
        const baseMat = new THREE.MeshStandardMaterial({
            color: baseColor,
            metalness: 0.05,
            roughness: 0.8,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = -0.04;
        base.receiveShadow = true;
        this.flowerGroup.add(base);

        // Decorative ring
        const ringGeo = new THREE.TorusGeometry(1.3, 0.02, 8, 64);
        const ringMat = new THREE.MeshStandardMaterial({
            color: ringColor,
            metalness: 0.1,
            roughness: 0.6,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0;
        this.flowerGroup.add(ring);
        this.animRegistry.ring = ring;
    }

    // ── Stem ──────────────────────────────────────────────────────────────
    _addStem() {
        const stemHeight = 2.5;
        const stemRadius = 0.06;
        const segments = 32;

        // Create a curved stem using a TubeGeometry from a CatmullRomCurve3
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.05, stemHeight * 0.3, 0.02),
            new THREE.Vector3(-0.03, stemHeight * 0.6, -0.02),
            new THREE.Vector3(0.02, stemHeight * 0.85, 0.01),
            new THREE.Vector3(0, stemHeight, 0),
        ];

        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, segments, stemRadius, 8, false);

        const stemMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#16A34A'),
            roughness: 0.7,
            metalness: 0.05,
        });

        const stem = new THREE.Mesh(tubeGeo, stemMat);
        stem.castShadow = true;
        this.flowerGroup.add(stem);
        this.animRegistry.stem = stem;

        // ── Stem cap: solid cylinder bridging TubeGeometry open end to petal disk ──
        const capGeo = new THREE.CylinderGeometry(0.065, stemRadius, 0.08, 24);
        const cap = new THREE.Mesh(capGeo, stemMat);
        cap.position.y = stemHeight - 0.04;
        this.flowerGroup.add(cap);
        this.animRegistry.cap = cap;

        // Store stem top for positioning petals
        this.stemTop = stemHeight;
    }

    // ── Leaves ────────────────────────────────────────────────────────────
    _addLeaves() {
        const stemH = this.stemTop || 2.5;

        // Left leaf
        this._createLeaf(
            new THREE.Vector3(-0.05, stemH * 0.35, 0.02),
            0.6, -Math.PI / 5, '#22C55E'
        );

        // Right leaf (higher, smaller)
        this._createLeaf(
            new THREE.Vector3(0.04, stemH * 0.55, -0.02),
            0.4, Math.PI / 4, '#86EFAC'
        );
    }

    _createLeaf(position, scale, rotZ, colorHex) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(0.3 * scale, 0.06 * scale, 0.6 * scale, 0.05 * scale, 0.8 * scale, 0);
        shape.bezierCurveTo(0.6 * scale, -0.05 * scale, 0.3 * scale, -0.06 * scale, 0, 0);

        const extrudeSettings = {
            depth: 0.01,
            bevelEnabled: true,
            bevelThickness: 0.005,
            bevelSize: 0.005,
            bevelSegments: 2,
            curveSegments: 12,
        };

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex),
            roughness: 0.6,
            metalness: 0.05,
            side: THREE.DoubleSide,
        });

        const leaf = new THREE.Mesh(geo, mat);
        leaf.position.copy(position);
        leaf.rotation.z = rotZ;
        leaf.rotation.x = -0.2;
        leaf.castShadow = true;
        leaf.userData.animBase = {
            rotZ: rotZ,
            rotX: -0.2,
            phase: _pulseHashFloat(this.animProfile.seed, Math.round(position.x * 1000 + position.y * 100), 0, Math.PI * 2),
        };
        this.flowerGroup.add(leaf);
        this.animRegistry.leaves.push(leaf);
    }

    // ── Petal Layers ──────────────────────────────────────────────────────
    _addPetalLayers() {
        const stemTop = this.stemTop || 2.5;
        const layers = this.params.layers;
        this.printSpec = [];

        // ── Rose-like layout: 5 concentric rings opening outward ──
        // Layer 0 = outermost (delta, few wide petals, tilted out)
        // Layer 4 = innermost (gamma, many small petals, nearly vertical)

        const numLayers = layers.length;

        for (let i = 0; i < numLayers; i++) {
            const layer = layers[i];
            const band = layer.band;
            const petalCount = layer.petalCount;
            const t = i / (numLayers - 1); // 0=outer, 1=inner

            // Band percentage drives color saturation + petal scale (weak delta stays small)
            const pctNorm = clamp(band.percentage / 28, 0, 1);
            const bandPresence = band.key === 'beta' ? 0.72 : (band.key === 'delta' ? 1.22 : 1);
            const powerScale = lerp(0.52, 1.12, pctNorm) * bandPresence;

            const color = new THREE.Color(band.color);
            const colorDeep = new THREE.Color(band.colorDeep);

            // ── Radial position: outer layers far from center, inner close ──
            // Inner ring goes to 0 so all layers touch the center (no floating)
            const ringRadius = lerp(0.50, 0.0, t);

            // ── Petal dimensions per layer ──
            // Outer: large & wide; Inner: small & narrow — scaled by band power
            const petalW = lerp(0.38, 0.14, t) * powerScale;
            const petalH = lerp(0.42, 0.18, t) * powerScale;
            const petalArch = Math.max(layer.petalHeight * 1.2, 0.15) * bandPresence; // 3D relief from band power

            // ── All layers share the same base Y so nothing floats ──
            // Outer layers sit AT stemTop; inner layers elevated just enough to overlap
            const yBase = stemTop + i * 0.04; // minimal stagger, all connected

            // ── Tilt: outer petals lean moderately out, inner nearly vertical ──
            // Capped to avoid petals going fully horizontal (which causes floating)
            const tiltAngle = lerp(0.75, 0.05, t);

            // ── Cup strength: outer petals open cup, inner tight cup ──
            const cupStrength = lerp(0.35, 0.7, t);

            for (let j = 0; j < petalCount; j++) {
                const angle = (j / petalCount) * Math.PI * 2 + layer.rotation;

                // No Y jitter — all bases must stay on the same plane for printing
                const petal = this._createRosePetal(
                    petalW, petalH, petalArch, cupStrength,
                    color, colorDeep, pctNorm, t
                );
                petal.geometry.computeBoundingBox();
                const petalSize = new THREE.Vector3();
                petal.geometry.boundingBox.getSize(petalSize);

                petal.name = `petal_${band.key}_${i + 1}_${j + 1}`;
                petal.userData = {
                    type: 'petal',
                    bandKey: band.key,
                    bandName: band.name,
                    bandColor: band.color,
                    bandColorDeep: band.colorDeep,
                    layerIndex: i + 1,
                    petalIndex: j + 1,
                    dimensionsModelUnits: {
                        x: petalSize.x,
                        y: petalSize.y,
                        z: petalSize.z,
                    },
                };

                this.printSpec.push({
                    bandKey: band.key,
                    bandName: band.name,
                    layerIndex: i + 1,
                    petalIndex: j + 1,
                    color: band.color,
                    colorDeep: band.colorDeep,
                    percentage: band.percentage,
                    dimensionsModelUnits: {
                        x: petalSize.x,
                        y: petalSize.y,
                        z: petalSize.z,
                    },
                });

                petal.position.set(
                    ringRadius * Math.cos(angle),
                    yBase,
                    ringRadius * Math.sin(angle)
                );

                petal.rotation.y = -angle + Math.PI / 2;
                petal.rotation.z = tiltAngle;

                petal.userData.animBase = {
                    rotY: petal.rotation.y,
                    rotZ: tiltAngle,
                    phase: _pulseHashFloat(this.animProfile.seed, i * 17 + j * 31, 0, Math.PI * 2),
                    layerT: t,
                    layerIndex: i,
                    petalIndex: j,
                    bandKey: band.key,
                    emissiveBase: petal.material.emissiveIntensity,
                    emissiveColor: petal.material.emissive.clone(),
                    colorBase: petal.material.color.clone(),
                };
                const posAttr = petal.geometry.attributes.position;
                petal.userData.animBase.vertexBase = Float32Array.from(posAttr.array);
                let maxY = 0.001;
                for (let vi = 1; vi < posAttr.count * 3; vi += 3) {
                    maxY = Math.max(maxY, petal.userData.animBase.vertexBase[vi]);
                }
                petal.userData.animBase.maxY = maxY;
                this.animRegistry.petals.push(petal);

                petal.castShadow = true;
                petal.receiveShadow = true;
                this.flowerGroup.add(petal);
            }
        }
    }

    /**
     * Creates a single rose-like cupped petal.
     * @param {number} pw       - petal width
     * @param {number} ph       - petal profile height (shape length)
     * @param {number} arch     - longitudinal arch amount (Z relief)
     * @param {number} cup      - transverse cup strength (0=flat, 1=deep cup)
     * @param {THREE.Color} color
     * @param {THREE.Color} colorDeep
     * @param {number} pctNorm  - 0–1 band percentage (drives saturation)
     * @param {number} layerT   - 0=outer, 1=inner
     */
    _createRosePetal(pw, ph, arch, cup, color, colorDeep, pctNorm, layerT) {
        const shape = new THREE.Shape();
        const w = pw * 0.5;
        const h = ph;
        const tipHalf = w * 0.45;
        const tipY = h * 0.95;

        // Wider, rounder petal silhouette
        shape.moveTo(0, 0);
        shape.bezierCurveTo( w * 1.5, h * 0.08,  w * 1.3, h * 0.55,  tipHalf, tipY);
        shape.bezierCurveTo( w * 0.18, h * 1.06, -w * 0.18, h * 1.06, -tipHalf, tipY);
        shape.bezierCurveTo(-w * 1.3, h * 0.55, -w * 1.5, h * 0.08,  0, 0);

        const thickness = Math.max(0.015, lerp(0.04, 0.025, layerT));
        const extrudeSettings = {
            depth: thickness,
            bevelEnabled: true,
            bevelThickness: thickness * 0.5,
            bevelSize: thickness * 0.35,
            bevelSegments: 3,
            curveSegments: 18,
        };

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // ── 3D deformation: cup shape + longitudinal arch + tip curl ──
        const safeH = Math.max(h, 0.001);
        const safeW = Math.max(w * 1.6, 0.001);
        const relief = Math.max(arch, 0.12);

        const positions = geo.attributes.position;
        for (let vi = 0; vi < positions.count; vi++) {
            const x = positions.getX(vi);
            const y = positions.getY(vi);
            let z = positions.getZ(vi);

            const tY = clamp(y / safeH, 0, 1);         // 0=base, 1=tip
            const tX = clamp(Math.abs(x) / safeW, 0, 1); // 0=center, 1=edge

            // 1) Longitudinal arch: petal curves away from stem
            const longArch = (tY * tY * 0.65 + tY * (1 - tY) * 0.35) * relief;

            // 2) Cup/spoon shape: EDGES rise UP, center stays low
            //    This creates the concave cupped look of a real rose petal
            const cupLift = tX * tX * cup * relief * 1.2;

            // 3) Tip curl: tip curves slightly inward (back toward center)
            const tipCurl = Math.pow(tY, 3.0) * relief * 0.25;

            // 4) Slight twist at edges for organic feel
            const edgeTwist = tX * tY * 0.03 * relief;

            z += longArch + cupLift + tipCurl + edgeTwist;
            positions.setZ(vi, z);
        }
        geo.computeVertexNormals();

        // ── Material: more saturated for higher-percentage bands ──
        const satBoost = lerp(0.22, 0.48, pctNorm);
        const softAccent = this._boostVibrance(color.clone().lerp(colorDeep, 0.28), satBoost, 0.02);
        const deepVibrant = this._boostVibrance(colorDeep.clone(), satBoost * 0.7, 0.0);
        const emissiveStrength = lerp(0.25, 0.50, pctNorm);

        const mat = new THREE.MeshStandardMaterial({
            color: softAccent,
            emissive: deepVibrant,
            emissiveIntensity: emissiveStrength,
            roughness: 0.36,
            metalness: 0.02,
            transparent: false,
            opacity: 1.0,
            side: THREE.DoubleSide,
            depthWrite: true,
            depthTest: true,
        });

        return new THREE.Mesh(geo, mat);
    }

    // ── Pulse Center (pistil) ────────────────────────────────────────────
    _addCenter() {
        const stemTop = this.stemTop || 2.5;
        const firstLayerRadius = 0.55;
        const centerR = firstLayerRadius;

        // ── Solid connector disk: bridges all petal layers to the stem ──
        // This ensures nothing floats — all petals are physically joined here
        const diskGeo = new THREE.CylinderGeometry(centerR * 1.05, centerR * 1.1, 0.12, 48);
        const diskMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#FDE68A'),
            roughness: 0.6,
            metalness: 0.05,
        });
        const disk = new THREE.Mesh(diskGeo, diskMat);
        disk.position.y = stemTop + 0.06;
        disk.castShadow = true;
        disk.receiveShadow = true;
        disk.userData.isDome = false;
        this.flowerGroup.add(disk);
        this.animRegistry.centers.push(disk);

        // Main spherical center dome on top of disk
        const centerGeo = new THREE.SphereGeometry(centerR * 0.68, 32, 32);
        const centerMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#FDE68A'),
            roughness: 0.5,
            metalness: 0.1,
            emissive: new THREE.Color('#EAB308'),
            emissiveIntensity: 0.15,
        });
        const center = new THREE.Mesh(centerGeo, centerMat);
        center.position.y = stemTop + 0.14;
        center.scale.y = 0.7;
        center.userData.isDome = true;
        center.userData.emissiveBase = centerMat.emissiveIntensity;
        this.flowerGroup.add(center);
        this.animRegistry.centers.push(center);

    }

    // ── Energy Auras (band-colored halos, in-place pulse) ────────────────
    _addEnergyAuras() {
        const stemTop = this.stemTop || 2.5;
        const sorted = [...this.bands].sort((a, b) => b.percentage - a.percentage);
        const auraLimit = this.animProfile.auraCount ?? 4;
        const sortedSlice = sorted.slice(0, auraLimit);
        const strength = this.animProfile.auraStrength;

        sortedSlice.forEach((band, idx) => {
            const radius = 0.55 + idx * 0.38 + (band.percentage / 100) * 0.25;
            const geo = new THREE.TorusGeometry(radius, 0.012 + idx * 0.004, 8, 72);
            const color = new THREE.Color(band.color);
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: (0.12 + (band.percentage / 100) * 0.18) * strength,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const aura = new THREE.Mesh(geo, mat);
            aura.rotation.x = Math.PI / 2 + _pulseHashFloat(this.animProfile.seed, 40 + idx, -0.25, 0.25);
            aura.position.y = stemTop + 0.08 + idx * 0.14;
            aura.userData.animBase = {
                baseOpacity: mat.opacity,
                phase: _pulseHashFloat(this.animProfile.seed, 44 + idx, 0, Math.PI * 2),
                spinDir: idx % 2 === 0 ? 1 : -1,
                baseScale: 1,
            };
            this.flowerGroup.add(aura);
            this.animRegistry.auras.push(aura);
        });

        const domeGeo = new THREE.SphereGeometry(0.72, 24, 16);
        const domeColor = new THREE.Color(this.visualPalette?.bright || this.visualPalette?.main || '#F9A8D4');
        const domeMat = new THREE.MeshBasicMaterial({
            color: domeColor,
            transparent: true,
            opacity: 0.06 * strength,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide,
        });
        const domeAura = new THREE.Mesh(domeGeo, domeMat);
        domeAura.position.y = stemTop + 0.18;
        domeAura.userData.animBase = {
            baseOpacity: domeMat.opacity,
            phase: this.animProfile.phaseBase,
            isDomeAura: true,
        };
        this.flowerGroup.add(domeAura);
        this.animRegistry.auras.push(domeAura);
    }

    // ── Pulse Ribbons (capture-specific 3D signature trails) ─────────────
    _addPulseRibbons() {
        const stemTop = this.stemTop || 2.5;
        const count = Math.max(0, this.animProfile.ribbonCount || 0);
        if (count <= 0) return;

        const sorted = [...this.bands].sort((a, b) => b.percentage - a.percentage);
        const mode = this.animProfile.ribbonMode || 'soft';
        const dominantPct = clamp((sorted[0]?.percentage || 0) / 100, 0.08, 0.8);

        for (let i = 0; i < count; i++) {
            const band = sorted[i % sorted.length] || this.bands[i % this.bands.length];
            if (!band) continue;

            const phase = _pulseHashFloat(this.animProfile.seed, 700 + i, 0, Math.PI * 2);
            const turns = mode === 'helix' ? 1.35 + (i % 3) * 0.25 : (mode === 'crown' ? 1.0 : 0.72 + (i % 2) * 0.18);
            const radius = 0.62 + i * 0.12 + (band.percentage / 100) * 0.38;
            const height = 0.38 + dominantPct * 0.55 + (mode === 'crystal' ? 0.18 : 0);
            const points = [];

            for (let s = 0; s <= 42; s++) {
                const t = s / 42;
                const angle = phase + t * Math.PI * 2 * turns;
                const wave = Math.sin(t * Math.PI * (mode === 'petal' ? 2.0 : 1.0));
                const crownLift = mode === 'crown' ? Math.sin(t * Math.PI * 2) * 0.18 : 0;
                const crystalStep = mode === 'crystal' ? Math.sign(Math.sin(t * Math.PI * 6 + phase)) * 0.07 : 0;
                const r = radius + wave * 0.1 + crystalStep;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * r,
                    stemTop + 0.05 + t * height + crownLift,
                    Math.sin(angle) * r
                ));
            }

            const curve = new THREE.CatmullRomCurve3(points);
            const tubeRadius = mode === 'crystal' ? 0.008 : 0.01 + dominantPct * 0.01;
            const geo = new THREE.TubeGeometry(curve, 64, tubeRadius, 6, false);
            const color = new THREE.Color(band.color).lerp(new THREE.Color(band.colorDeep), 0.2);
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.16 + dominantPct * 0.25,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            const ribbon = new THREE.Mesh(geo, mat);
            ribbon.userData.animBase = {
                phase,
                baseOpacity: mat.opacity,
                baseScale: 1,
                spinDir: i % 2 === 0 ? 1 : -1,
                radius,
                mode,
                lift: _pulseHashFloat(this.animProfile.seed, 760 + i, -0.06, 0.12),
            };
            this.flowerGroup.add(ribbon);
            this.animRegistry.pulseRibbons.push(ribbon);
        }
    }

    // ── Spark Orbs (EEG-energy motes orbiting center) ─────────────────────
    _addSparkOrbs() {
        const stemTop = this.stemTop || 2.5;
        const count = this.animProfile.sparkCount;
        if (count <= 0) return;

        const bandColors = this.bands.map(b => new THREE.Color(b.color));
        for (let i = 0; i < count; i++) {
            const size = 0.018 + _pulseHashFloat(this.animProfile.seed, 60 + i, 0, 0.022);
            const geo = new THREE.SphereGeometry(size, 8, 8);
            const c = bandColors[i % bandColors.length];
            const mat = new THREE.MeshStandardMaterial({
                color: c,
                emissive: c.clone(),
                emissiveIntensity: 0.85 + _pulseHashFloat(this.animProfile.seed, 80 + i, 0, 0.6),
                roughness: 0.25,
                metalness: 0.15,
                transparent: true,
                opacity: 0.75,
            });
            const orb = new THREE.Mesh(geo, mat);
            orb.userData.animBase = {
                angle: _pulseHashFloat(this.animProfile.seed, 90 + i, 0, Math.PI * 2),
                height: stemTop + _pulseHashFloat(this.animProfile.seed, 110 + i, -0.15, 0.55),
                radius: this.animProfile.sparkOrbitRadius * _pulseHashFloat(this.animProfile.seed, 130 + i, 0.55, 1.05),
                speedMul: _pulseHashFloat(this.animProfile.seed, 150 + i, 0.65, 1.45),
                phase: _pulseHashFloat(this.animProfile.seed, 170 + i, 0, Math.PI * 2),
                emissiveBase: mat.emissiveIntensity,
                tilt: _pulseHashFloat(this.animProfile.seed, 190 + i, -0.4, 0.4),
            };
            this.flowerGroup.add(orb);
            this.animRegistry.sparkOrbs.push(orb);
        }
    }

    // ── Pollen Particles ──────────────────────────────────────────────────
    _addPollen() {
        const count = this.animProfile.pollenCount ?? 80;
        if (count <= 0 || this.animProfile.pollenMode === 'none') return;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const phases = new Float32Array(count);
        const sizes = new Float32Array(count);
        const stemTop = this.stemTop || 2.5;

        const pollenColors = this.bands.map(b => new THREE.Color(b.color));
        if (!pollenColors.length) {
            pollenColors.push(
                new THREE.Color('#EAB308'),
                new THREE.Color('#EC4899')
            );
        }

        for (let i = 0; i < count; i++) {
            const theta = _pulseHashFloat(this.animProfile.seed, 300 + i, 0, Math.PI * 2);
            const r = 0.15 + _pulseHashFloat(this.animProfile.seed, 400 + i, 0, 2.3);
            const y = stemTop - 0.5 + _pulseHashFloat(this.animProfile.seed, 500 + i, 0, 2.6);

            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = r * Math.sin(theta);
            phases[i] = _pulseHashFloat(this.animProfile.seed, 100 + i, 0, Math.PI * 2);
            sizes[i] = 0.028 + _pulseHashFloat(this.animProfile.seed, 200 + i, 0, 0.045);

            const c = pollenColors[i % pollenColors.length];
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.38,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        this.particles = new THREE.Points(geo, mat);
        this.scene.add(this.particles);
        this.animRegistry.pollen = {
            mesh: this.particles,
            basePositions: positions.slice(),
            phases,
            baseSizes: sizes.slice(),
            baseOpacity: mat.opacity,
        };
    }

    // ── Ground ────────────────────────────────────────────────────────────
    _addGround() {
        const geo = new THREE.CircleGeometry(6, 64);
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#D97706'),
            metalness: 0.0,
            roughness: 1.0,
        });
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.animRegistry.ground = ground;
    }

    _computeBreath(elapsed, p) {
        const t = elapsed * p.breathSpeed + p.phaseBase;
        switch (p.motionStyle) {
            case 'heartbeat':
                return 1 + (Math.pow(Math.max(0, Math.sin(t)), 3) * p.breathAmp)
                    + (Math.pow(Math.max(0, Math.sin(t * 2.05)), 4) * p.breathAmp * 0.45);
            case 'deep_tide':
                return 1 + Math.sin(t * 0.85) * p.breathAmp + Math.sin(t * 0.37 + 1.2) * p.breathAmp2;
            case 'staccato':
                return 1 + (Math.floor(Math.sin(t * 2.8) * 2 + 2) / 2) * p.breathAmp * 0.35;
            case 'quantum_fizz':
                return 1 + (Math.sin(t * 3.2) * 0.4 + Math.sin(t * 7.1) * 0.25) * p.breathAmp;
            case 'meditative':
                return 1 + Math.sin(t * 0.5) * p.breathAmp * 0.6;
            case 'volcanic_core':
                return 1 + Math.pow(Math.max(0, Math.sin(t * 0.9)), 2) * p.breathAmp * 0.25;
            default:
                return 1 + Math.sin(t) * p.breathAmp + Math.sin(elapsed * p.breathSpeed2 + p.phaseBase * 1.7) * p.breathAmp2;
        }
    }

    _applyStylePetalMotion(elapsed, p, petal, base) {
        const style = p.motionStyle;
        const amp = p.petalFlutterAmp;
        const ph = base.phase;
        const li = base.layerIndex;
        const lt = base.layerT;

        switch (style) {
            case 'spiral_bloom': {
                const dir = li % 2 === 0 ? 1 : -1;
                petal.rotation.y = base.rotY + elapsed * p.layerWaveSpeed * dir * (0.12 + lt * 0.18);
                petal.rotation.z = base.rotZ + Math.sin(elapsed * 0.55 + li * 0.9 + ph) * amp * 0.5;
                petal.rotation.x = Math.sin(elapsed * 0.4 + ph) * amp * 0.35;
                petal.scale.setScalar(1 + Math.sin(elapsed * p.vertexBreathSpeed + li) * p.shimmerAmp * 0.6);
                return { layerOffset: li * 1.6, microShake: 0, emissiveWave: Math.sin(elapsed * p.emissiveSpeed + li + ph) };
            }
            case 'staccato': {
                const snap = Math.sign(Math.sin(elapsed * p.petalFlutterSpeed * 2.8 + ph));
                petal.rotation.z = base.rotZ + snap * amp * 0.95;
                petal.rotation.x = snap * amp * 0.35;
                petal.rotation.y = base.rotY + snap * amp * 0.2;
                petal.scale.setScalar(1 + Math.abs(snap) * p.shimmerAmp * 1.2);
                return { layerOffset: li * 0.4, microShake: 0, emissiveWave: Math.abs(Math.sin(elapsed * p.emissiveSpeed * 3 + ph)) };
            }
            case 'quantum_fizz': {
                const shakeX = Math.sin(elapsed * 13 + ph) * 0.045 + Math.sin(elapsed * 19 + ph * 2) * 0.028;
                const shakeZ = Math.sin(elapsed * 11 + ph * 1.3) * 0.05 + Math.cos(elapsed * 17 + ph) * 0.032;
                petal.rotation.x = shakeX;
                petal.rotation.z = base.rotZ + shakeZ;
                petal.rotation.y = base.rotY + Math.sin(elapsed * 8 + ph) * amp * 0.4;
                petal.scale.set(1 + Math.sin(elapsed * p.shimmerSpeed + ph) * p.shimmerAmp * 1.5, 1, 1 + Math.cos(elapsed * p.shimmerSpeed * 1.3 + ph) * p.shimmerAmp);
                return { layerOffset: li * 0.3, microShake: Math.sin(elapsed * 15 + ph) * 0.012, emissiveWave: 0.4 + Math.abs(Math.sin(elapsed * p.emissiveSpeed * 4 + ph)) * 0.6 };
            }
            case 'wind_sweep': {
                const gust = Math.sin(elapsed * p.petalWaveSpeed * 0.6 + p.phaseBase);
                petal.rotation.z = base.rotZ + gust * amp * 1.2;
                petal.rotation.y = base.rotY + gust * amp * 0.55;
                petal.rotation.x = gust * amp * 0.4;
                petal.scale.setScalar(1 + gust * p.shimmerAmp * 0.5);
                return { layerOffset: base.petalIndex * 0.08, microShake: 0, emissiveWave: gust };
            }
            case 'counter_spin': {
                const dir = li % 2 === 0 ? 1 : -1;
                petal.rotation.y = base.rotY + Math.sin(elapsed * p.layerWaveSpeed + li) * p.layerSpinAmp * dir * 3.5;
                petal.rotation.z = base.rotZ + Math.cos(elapsed * p.petalFlutterSpeed + ph) * amp * 0.6;
                petal.rotation.x = Math.sin(elapsed * p.petalFlutterSpeed * 0.5 + ph) * amp * 0.3;
                petal.scale.setScalar(1 + Math.sin(elapsed * p.vertexBreathSpeed + ph) * p.shimmerAmp);
                return { layerOffset: li * dir * 0.8, microShake: 0, emissiveWave: Math.sin(elapsed * p.emissiveSpeed + li * dir + ph) };
            }
            case 'bloom_pulse': {
                const open = Math.sin(elapsed * p.petalFlutterSpeed + ph);
                petal.rotation.z = base.rotZ + open * amp * 2.2;
                petal.rotation.y = base.rotY;
                petal.rotation.x = open * amp * 0.25;
                petal.scale.set(1 + open * p.shimmerAmp * 2.5, 1 + open * p.shimmerAmp * 1.8, 1 + open * p.shimmerAmp * 2);
                return { layerOffset: li * 0.5, microShake: 0, emissiveWave: open };
            }
            case 'meditative':
            case 'volcanic_core':
                petal.rotation.set(0, base.rotY, base.rotZ);
                petal.scale.setScalar(1);
                return { layerOffset: 0, microShake: 0, emissiveWave: Math.sin(elapsed * p.emissiveSpeed * 0.5 + ph) * 0.5 };
            case 'neon_storm':
                petal.rotation.z = base.rotZ + Math.sin(elapsed * 2 + ph) * amp * 0.15;
                petal.rotation.y = base.rotY;
                petal.rotation.x = 0;
                petal.scale.setScalar(1);
                return { layerOffset: li * 0.2, microShake: 0, emissiveWave: 0.3 + Math.abs(Math.sin(elapsed * p.emissiveSpeed * 5 + ph * 3)) * 0.7 };
            case 'ripple_ring': {
                const ringPhase = elapsed * p.ringPulseSpeed * 0.5;
                const ripple = Math.sin(ringPhase - li * 0.85 + ph);
                petal.rotation.z = base.rotZ + ripple * amp * 0.9;
                petal.rotation.y = base.rotY + ripple * amp * 0.35;
                petal.rotation.x = ripple * amp * 0.25;
                petal.scale.setScalar(1 + ripple * p.shimmerAmp * 0.8);
                return { layerOffset: li * 1.1, microShake: 0, emissiveWave: ripple };
            }
            case 'helix_bloom': {
                const helix = Math.sin(elapsed * p.petalWaveSpeed + ph + li * 0.55);
                const dir = li % 2 === 0 ? 1 : -1;
                petal.rotation.y = base.rotY + elapsed * p.layerWaveSpeed * dir * (0.08 + lt * 0.24) + helix * amp * 0.22;
                petal.rotation.z = base.rotZ + helix * amp * 1.35;
                petal.rotation.x = Math.cos(elapsed * p.petalFlutterSpeed * 0.7 + ph) * amp * 0.4;
                petal.scale.set(1 + helix * p.shimmerAmp, 1 + Math.abs(helix) * p.shimmerAmp * 0.8, 1 + helix * p.shimmerAmp * 0.6);
                return { layerOffset: li * 1.35 + base.petalIndex * 0.08, microShake: 0, emissiveWave: helix };
            }
            case 'crystal_lattice': {
                const facet = Math.sign(Math.sin(elapsed * p.petalFlutterSpeed * 1.4 + ph));
                const glint = Math.abs(Math.sin(elapsed * p.shimmerSpeed * 1.8 + ph));
                petal.rotation.z = base.rotZ + facet * amp * 0.55;
                petal.rotation.y = base.rotY + facet * amp * 0.24;
                petal.rotation.x = Math.sin(elapsed * p.petalWaveSpeed + li) * amp * 0.18;
                petal.scale.set(1 + glint * p.shimmerAmp * 1.2, 1, 1 + facet * p.shimmerAmp * 0.5);
                return { layerOffset: li * 0.65, microShake: facet * 0.004, emissiveWave: glint };
            }
            case 'orbital_crown': {
                const orbit = Math.sin(elapsed * p.ringPulseSpeed * 0.65 + ph + base.petalIndex * 0.18);
                petal.rotation.y = base.rotY + orbit * amp * 0.48 + Math.sin(elapsed * p.layerWaveSpeed + li) * p.layerSpinAmp;
                petal.rotation.z = base.rotZ + orbit * amp * 0.8;
                petal.rotation.x = Math.cos(elapsed * p.petalFlutterSpeed * 0.55 + ph) * amp * 0.32;
                petal.scale.setScalar(1 + orbit * p.shimmerAmp * 0.9);
                return { layerOffset: base.petalIndex * 0.16 + li * 0.45, microShake: 0, emissiveWave: orbit };
            }
            case 'iris_unfold': {
                const open = 0.5 + Math.sin(elapsed * p.petalFlutterSpeed * 0.55 + ph) * 0.5;
                const fold = Math.sin(elapsed * p.petalWaveSpeed + li * 0.8 + ph);
                petal.rotation.z = base.rotZ + open * amp * 1.85 - amp * 0.45;
                petal.rotation.y = base.rotY + fold * amp * 0.34;
                petal.rotation.x = fold * amp * 0.28;
                petal.scale.set(1 + open * p.shimmerAmp * 1.4, 1 + open * p.shimmerAmp, 1 + fold * p.shimmerAmp * 0.6);
                return { layerOffset: li * 1.0, microShake: 0, emissiveWave: open * 2 - 1 };
            }
            case 'deep_tide':
            default: {
                const swell = Math.sin(elapsed * p.petalFlutterSpeed * 0.45 + ph + li * 0.3);
                petal.rotation.z = base.rotZ + swell * amp * 0.35;
                petal.rotation.x = Math.sin(elapsed * p.petalWaveSpeed * 0.5 + ph) * amp * 0.2;
                petal.rotation.y = base.rotY + swell * amp * 0.12;
                petal.scale.set(1 + swell * p.shimmerAmp * 0.4, 1 + swell * p.shimmerAmp * 0.8, 1 + swell * p.shimmerAmp * 0.4);
                return { layerOffset: li * 0.9, microShake: 0, emissiveWave: Math.sin(elapsed * p.emissiveSpeed * 0.65 + ph) };
            }
        }
    }

    _animatePetalVertices(petal, base, elapsed, p, archMotion) {
        if (!base.vertexBase || p.staticPetals) return;
        const posAttr = petal.geometry.attributes.position;
        const arr = posAttr.array;
        const style = p.motionStyle;
        let breath = Math.sin(elapsed * p.vertexBreathSpeed + base.phase + archMotion.layerOffset) * p.vertexBreathAmp;
        let ripple = Math.sin(elapsed * p.petalWaveSpeed * 1.6 + base.phase + archMotion.layerOffset) * p.vertexBreathAmp * 0.55;

        if (style === 'ripple_ring') {
            ripple = Math.sin(elapsed * p.ringPulseSpeed * 0.6 - base.layerIndex * 0.9 + base.phase) * p.vertexBreathAmp * 1.2;
        } else if (style === 'quantum_fizz') {
            breath = (Math.sin(elapsed * 9 + base.phase) + Math.sin(elapsed * 14 + base.phase * 2)) * p.vertexBreathAmp * 0.35;
        } else if (style === 'deep_tide') {
            breath = Math.sin(elapsed * p.vertexBreathSpeed * 0.55 + base.phase) * p.vertexBreathAmp * 1.4;
        } else if (style === 'helix_bloom') {
            ripple = Math.sin(elapsed * p.petalWaveSpeed * 2.0 + base.phase + base.petalIndex * 0.2) * p.vertexBreathAmp * 1.05;
        } else if (style === 'crystal_lattice') {
            breath = Math.sign(Math.sin(elapsed * p.vertexBreathSpeed * 1.9 + base.phase)) * p.vertexBreathAmp * 0.42;
        } else if (style === 'orbital_crown') {
            ripple = Math.sin(elapsed * p.ringPulseSpeed * 0.9 - base.petalIndex * 0.22 + base.phase) * p.vertexBreathAmp * 0.85;
        } else if (style === 'iris_unfold') {
            breath = Math.pow(Math.max(0, Math.sin(elapsed * p.vertexBreathSpeed * 0.7 + base.phase)), 1.6) * p.vertexBreathAmp * 1.3;
        }

        const maxY = base.maxY || 1;
        for (let pi = 0; pi < base.vertexBase.length; pi += 3) {
            const y = base.vertexBase[pi + 1];
            const tY = clamp(y / maxY, 0, 1);
            const edge = clamp(Math.abs(base.vertexBase[pi]) / Math.max(maxY * 0.5, 0.001), 0, 1);
            const deform = (breath * tY * tY) + (ripple * edge * tY);
            arr[pi] = base.vertexBase[pi] + archMotion.microShake;
            arr[pi + 1] = base.vertexBase[pi + 1];
            arr[pi + 2] = base.vertexBase[pi + 2] + deform;
        }
        posAttr.needsUpdate = true;
    }

    _animatePollenByStyle(elapsed, p, pollenAnim) {
        const pos = pollenAnim.mesh.geometry.attributes.position.array;
        const base = pollenAnim.basePositions;
        const phases = pollenAnim.phases;
        const mode = p.pollenMode || 'pulse';
        const orbitR = p.pollenOrbitRadius;

        for (let i = 0; i < phases.length; i++) {
            const idx = i * 3;
            const phase = phases[i];
            const orbit = elapsed * p.pollenOrbitSpeed + phase;

            if (mode === 'chaos') {
                pos[idx] = base[idx] + Math.cos(orbit * 2.3 + phase) * orbitR * 1.4;
                pos[idx + 1] = base[idx + 1] + Math.sin(elapsed * p.pollenOpacitySpeed * 1.5 + phase * 2) * orbitR;
                pos[idx + 2] = base[idx + 2] + Math.sin(orbit * 1.7 + phase) * orbitR * 1.4;
            } else if (mode === 'spiral') {
                const spiral = orbit + base[idx] * 0.5;
                pos[idx] = base[idx] + Math.cos(spiral) * orbitR * 0.8;
                pos[idx + 1] = base[idx + 1] + Math.sin(spiral * 0.5) * orbitR * 0.4;
                pos[idx + 2] = base[idx + 2] + Math.sin(spiral) * orbitR * 0.8;
            } else if (mode === 'wind') {
                const gust = Math.sin(elapsed * p.petalWaveSpeed * 0.5 + p.phaseBase);
                pos[idx] = base[idx] + gust * orbitR * 1.2;
                pos[idx + 1] = base[idx + 1] + Math.sin(elapsed * 0.8 + phase) * orbitR * 0.3;
                pos[idx + 2] = base[idx + 2] + gust * orbitR * 0.4;
            } else if (mode === 'snap') {
                const snap = Math.sign(Math.sin(elapsed * p.pollenOpacitySpeed + phase));
                pos[idx] = base[idx] + snap * orbitR * 0.5;
                pos[idx + 1] = base[idx + 1] + snap * orbitR * 0.25;
                pos[idx + 2] = base[idx + 2] + snap * orbitR * 0.35;
            } else if (mode === 'ripple') {
                const wave = Math.sin(elapsed * p.ringPulseSpeed * 0.45 - Math.sqrt(base[idx] * base[idx] + base[idx + 2] * base[idx + 2]) + phase);
                pos[idx] = base[idx] + wave * orbitR * 0.6;
                pos[idx + 1] = base[idx + 1] + wave * orbitR * 0.35;
                pos[idx + 2] = base[idx + 2] + wave * orbitR * 0.6;
            } else if (mode === 'counter') {
                const dir = i % 2 === 0 ? 1 : -1;
                pos[idx] = base[idx] + Math.cos(orbit * dir) * orbitR;
                pos[idx + 1] = base[idx + 1] + Math.sin(elapsed * 0.9 + phase) * orbitR * 0.4;
                pos[idx + 2] = base[idx + 2] + Math.sin(orbit * dir) * orbitR;
            } else if (mode === 'slow_orbit') {
                pos[idx] = base[idx] + Math.cos(orbit * 0.5) * orbitR * 0.7;
                pos[idx + 1] = base[idx + 1] + Math.sin(elapsed * 0.35 + phase) * orbitR * 0.25;
                pos[idx + 2] = base[idx + 2] + Math.sin(orbit * 0.5) * orbitR * 0.7;
            } else if (mode === 'helix') {
                const h = Math.sin(orbit * 0.5 + phase) * orbitR * 0.75;
                pos[idx] = base[idx] + Math.cos(orbit) * orbitR * 1.15;
                pos[idx + 1] = base[idx + 1] + h + Math.sin(elapsed * 0.55 + phase) * 0.05;
                pos[idx + 2] = base[idx + 2] + Math.sin(orbit) * orbitR * 1.15;
            } else if (mode === 'petal_drift') {
                const open = Math.sin(elapsed * p.petalWaveSpeed * 0.45 + phase);
                pos[idx] = base[idx] + Math.cos(phase) * open * orbitR * 0.8;
                pos[idx + 1] = base[idx + 1] + Math.abs(open) * orbitR * 0.45;
                pos[idx + 2] = base[idx + 2] + Math.sin(phase) * open * orbitR * 0.8;
            } else {
                pos[idx] = base[idx] + Math.cos(orbit) * orbitR;
                pos[idx + 1] = base[idx + 1] + Math.sin(elapsed * p.pollenOpacitySpeed + phase) * orbitR * 0.55;
                pos[idx + 2] = base[idx + 2] + Math.sin(orbit) * orbitR;
            }
        }
        pollenAnim.mesh.geometry.attributes.position.needsUpdate = true;
        pollenAnim.mesh.material.opacity = pollenAnim.baseOpacity
            + Math.sin(elapsed * p.pollenOpacitySpeed + p.phaseBase) * (mode === 'chaos' ? 0.22 : 0.12);
        pollenAnim.mesh.material.size = 0.05 + Math.sin(elapsed * p.pollenOpacitySpeed * 0.7 + p.phaseBase) * p.pollenSizePulse;
    }

    // ── Animation ─────────────────────────────────────────────────────────
    _animate() {
        if (this._destroyed) return;
        this.animationId = requestAnimationFrame(() => this._animate());
        if (!this.renderer || !this.scene || !this.camera) return;

        const elapsed = this.clock.getElapsedTime();
        const p = this.animProfile;
        this._animFrame = (this._animFrame || 0) + 1;

        const breath = this._computeBreath(elapsed, p);

        if (this.flowerGroup && !p.staticGroup) {
            this.flowerGroup.scale.set(
                1 + (breath - 1) * (p.motionStyle === 'deep_tide' ? 0.55 : 0.45),
                breath,
                1 + (breath - 1) * (p.motionStyle === 'deep_tide' ? 0.55 : 0.45)
            );
            const swayMul = p.motionStyle === 'wind_sweep' ? 1.8 : 1;
            this.flowerGroup.rotation.z = Math.sin(elapsed * p.swaySpeedZ + p.phaseBase) * p.swayAmpX * swayMul
                + Math.sin(elapsed * p.swaySpeedZ * 2.1 + p.phaseBase) * p.swayAmpX * 0.25;
            this.flowerGroup.rotation.x = Math.sin(elapsed * p.swaySpeedX + p.phaseBase + 1) * p.swayAmpZ * swayMul
                + Math.cos(elapsed * p.swaySpeedX * 1.6 + p.phaseBase) * p.swayAmpZ * 0.3;
            if (p.motionStyle === 'spiral_bloom') {
                this.flowerGroup.rotation.y = elapsed * p.layerWaveSpeed * 0.12;
            } else if (p.motionStyle !== 'meditative') {
                this.flowerGroup.rotation.y = Math.sin(elapsed * p.layerWaveSpeed * 0.35 + p.phaseBase) * p.layerSpinAmp * 0.35;
            }
        } else if (this.flowerGroup) {
            this.flowerGroup.scale.set(1, 1, 1);
            this.flowerGroup.rotation.set(0, 0, 0);
        }

        if (this.animRegistry.stem) {
            this.animRegistry.stem.rotation.y = Math.sin(elapsed * p.stemTwistSpeed + p.phaseBase) * p.stemTwistAmp;
            this.animRegistry.stem.rotation.z = Math.sin(elapsed * p.stemTwistSpeed * 0.8 + p.phaseBase) * p.stemBendAmp;
        }
        if (this.animRegistry.cap) {
            const capPulse = 1 + Math.sin(elapsed * p.centerPulseSpeed * 0.9 + p.phaseBase) * p.centerPulseAmp * 0.35;
            this.animRegistry.cap.scale.set(capPulse, 1, capPulse);
        }

        let needsNormalRefresh = false;
        for (const petal of this.animRegistry.petals) {
            const base = petal.userData.animBase;
            if (!base) continue;

            const arch = this._applyStylePetalMotion(elapsed, p, petal, base);
            if (!p.staticPetals) {
                this._animatePetalVertices(petal, base, elapsed, p, arch);
                needsNormalRefresh = true;
            }

            if (petal.material) {
                const emWave = typeof arch.emissiveWave === 'number' ? arch.emissiveWave : Math.sin(elapsed * p.emissiveSpeed + base.phase);
                petal.material.emissiveIntensity = base.emissiveBase + emWave * p.emissiveRange * base.emissiveBase;
                if (p.motionStyle === 'neon_storm' || p.motionStyle === 'quantum_fizz') {
                    const hueShift = Math.sin(elapsed * p.emissiveSpeed * 0.8 + base.phase) * 0.12;
                    petal.material.emissive.copy(base.emissiveColor);
                    const hsl = { h: 0, s: 0, l: 0 };
                    petal.material.emissive.getHSL(hsl);
                    petal.material.emissive.setHSL((hsl.h + hueShift + 1) % 1, clamp(hsl.s * 1.15, 0, 1), hsl.l);
                }
            }
        }
        if (needsNormalRefresh && this._animFrame % 2 === 0) {
            for (const petal of this.animRegistry.petals) {
                if (petal.geometry) petal.geometry.computeVertexNormals();
            }
        }

        for (const leaf of this.animRegistry.leaves) {
            const base = leaf.userData.animBase;
            if (!base) continue;
            const flutter = Math.sin(elapsed * p.leafFlutterSpeed + base.phase);
            const ripple = Math.sin(elapsed * p.leafFlutterSpeed * 1.8 + base.phase + 1.2);
            leaf.rotation.z = base.rotZ + flutter * p.leafFlutterAmp + ripple * p.leafFlutterAmp * 0.35;
            leaf.rotation.x = base.rotX + Math.cos(elapsed * p.leafFlutterSpeed * 0.75 + base.phase) * p.leafFlutterAmp * 0.55;
            leaf.scale.setScalar(1 + Math.sin(elapsed * p.leafFlutterSpeed * 1.2 + base.phase) * 0.06);
        }

        for (const center of this.animRegistry.centers) {
            let pulse = 1 + Math.sin(elapsed * p.centerPulseSpeed + p.phaseBase) * p.centerPulseAmp;
            if (p.motionStyle === 'heartbeat') {
                pulse = 1 + Math.pow(Math.max(0, Math.sin(elapsed * p.centerPulseSpeed + p.phaseBase)), 2) * p.centerPulseAmp;
            } else if (p.motionStyle === 'volcanic_core') {
                pulse = 1 + Math.pow(Math.max(0, Math.sin(elapsed * p.centerPulseSpeed * 0.85 + p.phaseBase)), 1.5) * p.centerPulseAmp * 1.5;
            } else if (p.motionStyle === 'staccato') {
                pulse = 1 + Math.abs(Math.sign(Math.sin(elapsed * p.centerPulseSpeed * 2.5 + p.phaseBase))) * p.centerPulseAmp * 0.6;
            }
            const bob = Math.sin(elapsed * p.centerPulseSpeed * 1.35 + p.phaseBase) * p.centerBobAmp;
            if (center.userData.isDome) {
                center.scale.set(pulse, pulse * 0.7, pulse);
                center.rotation.y = elapsed * p.centerTwistSpeed;
                center.rotation.x = Math.sin(elapsed * p.centerPulseSpeed * 0.7 + p.phaseBase) * 0.08;
                center.position.y = (this.stemTop || 2.5) + 0.14 + bob;
                if (center.material) {
                    const emBase = center.userData.emissiveBase || 0.15;
                    center.material.emissiveIntensity = emBase
                        + Math.sin(elapsed * p.emissiveSpeed * 1.45 + p.phaseBase) * emBase * 1.1;
                }
            } else {
                center.scale.set(pulse, 1, pulse);
                center.position.y = (this.stemTop || 2.5) + 0.06 + bob * 0.35;
            }
        }

        if (this.animRegistry.ring) {
            const ringPulse = 1 + Math.sin(elapsed * p.ringPulseSpeed + p.phaseBase) * p.ringScaleAmp;
            this.animRegistry.ring.scale.set(ringPulse, ringPulse, ringPulse);
            this.animRegistry.ring.rotation.z = elapsed * p.ringPulseSpeed * 0.22;
        }

        for (const aura of this.animRegistry.auras) {
            const base = aura.userData.animBase;
            if (!base) continue;
            let pulse = 0.72 + Math.sin(elapsed * p.auraPulseSpeed + base.phase) * 0.28;
            if (p.motionStyle === 'neon_storm' || p.motionStyle === 'quantum_fizz') {
                pulse = 0.4 + Math.abs(Math.sin(elapsed * p.auraPulseSpeed * 3 + base.phase)) * 0.6;
            } else if (p.motionStyle === 'deep_tide') {
                pulse = 0.55 + Math.sin(elapsed * p.auraPulseSpeed * 0.45 + base.phase) * 0.45;
            }
            if (base.isDomeAura) {
                aura.scale.setScalar(pulse * (1.05 + Math.sin(elapsed * p.auraPulseSpeed * 0.6 + p.phaseBase) * 0.08));
                aura.material.opacity = base.baseOpacity * (0.65 + pulse * 0.55);
            } else {
                aura.scale.set(pulse, pulse, pulse);
                aura.rotation.z = elapsed * p.auraPulseSpeed * 0.35 * (base.spinDir || 1);
                aura.material.opacity = base.baseOpacity * (0.55 + pulse * 0.65);
            }
        }

        for (const ribbon of this.animRegistry.pulseRibbons) {
            const base = ribbon.userData.animBase;
            if (!base) continue;
            const wave = Math.sin(elapsed * p.ribbonOrbitSpeed + base.phase);
            const shimmer = Math.abs(Math.sin(elapsed * p.shimmerSpeed * 0.55 + base.phase));
            const spinMul = base.mode === 'crown' ? 0.65 : (base.mode === 'crystal' ? 0.38 : 1);
            ribbon.rotation.y = elapsed * p.ribbonOrbitSpeed * base.spinDir * spinMul;
            ribbon.rotation.x = Math.sin(elapsed * p.ribbonOrbitSpeed * 0.7 + base.phase) * p.ribbonTwistAmp;
            ribbon.rotation.z = Math.cos(elapsed * p.ribbonOrbitSpeed * 0.55 + base.phase) * p.ribbonTwistAmp * 0.7;
            ribbon.position.y = base.lift + wave * 0.035;
            const scale = base.baseScale + wave * p.ribbonPulseAmp;
            if (base.mode === 'crystal') {
                ribbon.scale.set(scale, 1 + shimmer * p.ribbonPulseAmp * 0.8, scale);
            } else if (base.mode === 'petal') {
                ribbon.scale.set(1 + shimmer * p.ribbonPulseAmp * 1.5, scale, 1 + shimmer * p.ribbonPulseAmp * 1.5);
            } else {
                ribbon.scale.setScalar(scale);
            }
            if (ribbon.material) {
                ribbon.material.opacity = clamp(base.baseOpacity * (0.55 + shimmer * 0.85), 0.04, 0.72);
            }
        }

        for (const orb of this.animRegistry.sparkOrbs) {
            const base = orb.userData.animBase;
            if (!base) continue;
            let angle = base.angle + elapsed * p.sparkOrbitSpeed * base.speedMul;
            let radius = base.radius;
            if (p.motionStyle === 'quantum_fizz') {
                radius = base.radius * (0.7 + Math.abs(Math.sin(elapsed * 4 + base.phase)) * 0.6);
                angle += Math.sin(elapsed * 6 + base.phase) * 0.5;
            } else if (p.motionStyle === 'staccato') {
                angle += Math.floor(Math.sin(elapsed * 3 + base.phase) * 2) * 0.4;
            }
            orb.position.set(
                Math.cos(angle) * radius,
                base.height + Math.sin(elapsed * p.sparkOrbitSpeed * 1.6 + base.phase) * 0.08,
                Math.sin(angle) * radius
            );
            orb.rotation.x = elapsed * 2.2 + base.phase;
            orb.rotation.y = elapsed * 1.6 + base.tilt;
            const sparkPulse = 0.75 + Math.sin(elapsed * p.emissiveSpeed * 2.4 + base.phase) * 0.35;
            orb.scale.setScalar(sparkPulse);
            if (orb.material) {
                orb.material.emissiveIntensity = base.emissiveBase * (0.6 + Math.abs(Math.sin(elapsed * p.shimmerSpeed + base.phase)) * 0.9);
                orb.material.opacity = 0.55 + Math.sin(elapsed * p.emissiveSpeed * 1.8 + base.phase) * 0.35;
            }
        }

        const pollenAnim = this.animRegistry.pollen;
        if (pollenAnim?.mesh) {
            this._animatePollenByStyle(elapsed, p, pollenAnim);
        }

        for (const entry of this.animRegistry.lights) {
            entry.light.intensity = entry.baseIntensity
                + Math.sin(elapsed * p.lightPulseSpeed + entry.phase) * entry.baseIntensity * 0.55;
        }

        if (this.animRegistry.rimLight) {
            this.animRegistry.rimLight.intensity = 0.22
                + Math.sin(elapsed * p.lightPulseSpeed * 0.85 + p.phaseBase) * 0.18;
        }

        if (this.animRegistry.ground) {
            const gPulse = 1 + Math.sin(elapsed * p.breathSpeed * 0.65 + p.phaseBase) * p.groundPulseAmp;
            this.animRegistry.ground.scale.set(gPulse, gPulse, 1);
        }

        if (this.animRegistry.bgBase && this.animRegistry.bgAccent) {
            const bgMix = 0.5 + Math.sin(elapsed * p.breathSpeed * 0.45 + p.phaseBase) * 0.5;
            this.scene.background = this.animRegistry.bgBase.clone().lerp(this.animRegistry.bgAccent, bgMix * p.bgPulseStrength);
        }

        if (this.renderer) {
            this.renderer.toneMappingExposure = 1.1
                + Math.sin(elapsed * p.emissiveSpeed * 0.35 + p.phaseBase) * p.tonePulseAmp;
        }

        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // ── Resize ────────────────────────────────────────────────────────────
    _onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (w === 0 || h === 0) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    destroy() {
        this._destroyed = true;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
        window.removeEventListener('resize', this._resizeHandler);

        if (this.scene) {
            this.scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
        }

        if (this.controls && this.controls.dispose) this.controls.dispose();
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
        }
        if (this.container) this.container.innerHTML = '';
        this.controls = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.flowerGroup = null;
        this.particles = null;
    }

    // ── Screenshot ────────────────────────────────────────────────────────
    exportPNG(filename) {
        this.renderer.render(this.scene, this.camera);
        const link = document.createElement('a');
        link.download = filename || 'pulso_neurofuncional_3d.png';
        link.href = this.renderer.domElement.toDataURL('image/png');
        link.click();
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    _buildPrintableGroup(targetHeightMm = 120) {
        const clone = this.flowerGroup.clone(true);
        const bbox = new THREE.Box3().setFromObject(clone);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const currentHeight = Math.max(0.0001, size.y);
        const scaleFactor = targetHeightMm / currentHeight;
        clone.scale.setScalar(scaleFactor);

        const scaledBox = new THREE.Box3().setFromObject(clone);
        clone.position.y -= scaledBox.min.y;

        return { clone, scaleFactor, targetHeightMm, sourceHeight: currentHeight };
    }

    _buildPrintSpec(scaleFactor, targetHeightMm) {
        const petals = this.printSpec.map((p) => ({
            bandKey: p.bandKey,
            bandName: p.bandName,
            layerIndex: p.layerIndex,
            petalIndex: p.petalIndex,
            color: p.color,
            colorDeep: p.colorDeep,
            percentage: p.percentage,
            dimensionsMm: {
                x: +(p.dimensionsModelUnits.x * scaleFactor).toFixed(2),
                y: +(p.dimensionsModelUnits.y * scaleFactor).toFixed(2),
                z: +(p.dimensionsModelUnits.z * scaleFactor).toFixed(2),
            },
        }));

        return {
            format: '3d-print-spec-v1',
            model: 'pulso_neurofuncional_print.glb',
            units: 'mm',
            targetHeightMm,
            petals,
        };
    }

    exportGLBFor3DPrint(filename = 'pulso_neurofuncional_print.glb', targetHeightMm = 120) {
        if (!THREE.GLTFExporter) {
            alert('No se encontró GLTFExporter. Recarga la página e intenta de nuevo.');
            return;
        }
        if (!this.flowerGroup) {
            alert('La pulso 3D aún no está lista para exportar.');
            return;
        }

        const printable = this._buildPrintableGroup(targetHeightMm);
        const exportScene = new THREE.Scene();
        exportScene.add(printable.clone);

        const exporter = new THREE.GLTFExporter();
        exporter.parse(
            exportScene,
            (result) => {
                if (!(result instanceof ArrayBuffer)) {
                    alert('No se pudo exportar en formato GLB binario.');
                    return;
                }

                this._downloadBlob(new Blob([result], { type: 'model/gltf-binary' }), filename);

                const printSpec = this._buildPrintSpec(printable.scaleFactor, targetHeightMm);
                this._downloadBlob(
                    new Blob([JSON.stringify(printSpec, null, 2)], { type: 'application/json' }),
                    'pulso_neurofuncional_print_spec.json'
                );
            },
            { binary: true, onlyVisible: true, trs: false }
        );
    }

    _bakeMeshWorld(mesh) {
        const baked = new THREE.Mesh(mesh.geometry.clone(), mesh.material);
        baked.geometry.applyMatrix4(mesh.matrixWorld);
        baked.position.set(0, 0, 0);
        baked.rotation.set(0, 0, 0);
        baked.scale.set(1, 1, 1);
        baked.updateMatrixWorld(true);
        baked.userData = { ...mesh.userData };
        return baked;
    }

    _exportSTLObject(object3D, filename) {
        const exporter = new THREE.STLExporter();
        const stlString = exporter.parse(object3D);
        this._downloadBlob(new Blob([stlString], { type: 'model/stl' }), filename);
    }

    _buildSTLParts(printableClone) {
        const structureGroup = new THREE.Group();
        const bandGroups = {};

        printableClone.updateMatrixWorld(true);
        printableClone.traverse((obj) => {
            if (!obj.isMesh || !obj.geometry) return;

            const baked = this._bakeMeshWorld(obj);
            const isPetal = obj.userData?.type === 'petal';
            const bandKey = obj.userData?.bandKey;

            if (isPetal && bandKey) {
                if (!bandGroups[bandKey]) bandGroups[bandKey] = new THREE.Group();
                bandGroups[bandKey].add(baked);
            } else {
                structureGroup.add(baked);
            }
        });

        return { structureGroup, bandGroups };
    }

    exportSTLFor3DPrint(baseFilename = 'pulso_neurofuncional_print', targetHeightMm = 120) {
        if (!THREE.STLExporter) {
            alert('No se encontró STLExporter. Recarga la página e intenta de nuevo.');
            return;
        }
        if (!this.flowerGroup) {
            alert('La pulso 3D aún no está lista para exportar.');
            return;
        }

        const printable = this._buildPrintableGroup(targetHeightMm);
        const fullClone = printable.clone.clone(true);
        this._exportSTLObject(fullClone, `${baseFilename}_full_${targetHeightMm}mm.stl`);

        const parts = this._buildSTLParts(printable.clone.clone(true));
        this._exportSTLObject(parts.structureGroup, `${baseFilename}_structure_${targetHeightMm}mm.stl`);

        const bandFiles = [];
        const bandOrder = this.bands.map((b) => b.key);
        bandOrder.forEach((key) => {
            const group = parts.bandGroups[key];
            if (!group || group.children.length === 0) return;
            const filename = `${baseFilename}_${key}_${targetHeightMm}mm.stl`;
            this._exportSTLObject(group, filename);

            const bandMeta = this.bands.find((b) => b.key === key);
            bandFiles.push({
                bandKey: key,
                bandName: bandMeta?.name || key,
                color: bandMeta?.color || '#FFFFFF',
                colorDeep: bandMeta?.colorDeep || '#FFFFFF',
                percentage: bandMeta?.percentage || 0,
                file: filename,
            });
        });

        const manifest = {
            format: 'stl-multicolor-print-v1',
            note: 'STL no guarda color interno. Usa los archivos STL por banda para asignar filamento/color en el slicer.',
            units: 'mm',
            targetHeightMm,
            files: {
                fullModel: `${baseFilename}_full_${targetHeightMm}mm.stl`,
                structure: `${baseFilename}_structure_${targetHeightMm}mm.stl`,
                bands: bandFiles,
            },
            petals: this._buildPrintSpec(printable.scaleFactor, targetHeightMm).petals,
        };

        this._downloadBlob(
            new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
            `${baseFilename}_manifest_${targetHeightMm}mm.json`
        );
    }

    // ── Export geometry JSON for local Python conversion ───────────────────
    exportGeometryJSON(targetHeightMm = 120) {
        if (!this.flowerGroup) {
            throw new Error('La pulso 3D aún no está lista.');
        }

        const printable = this._buildPrintableGroup(targetHeightMm);
        const clone = printable.clone;
        clone.updateMatrixWorld(true);

        const meshes = [];

        clone.traverse((obj) => {
            if (!obj.isMesh || !obj.geometry) return;

            // Bake world transform into geometry
            const geo = obj.geometry.clone();
            geo.applyMatrix4(obj.matrixWorld);

            const posAttr = geo.attributes.position;
            const vertices = [];
            for (let i = 0; i < posAttr.count; i++) {
                vertices.push([posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)]);
            }

            // Extract faces (indexed or non-indexed)
            const faces = [];
            if (geo.index) {
                const idx = geo.index.array;
                for (let i = 0; i < idx.length; i += 3) {
                    faces.push([idx[i], idx[i + 1], idx[i + 2]]);
                }
            } else {
                for (let i = 0; i < posAttr.count; i += 3) {
                    faces.push([i, i + 1, i + 2]);
                }
            }

            // Material color
            const mat = obj.material;
            let colorHex = '#CCCCCC';
            let emissiveHex = '#000000';
            if (mat && mat.color) {
                colorHex = '#' + mat.color.getHexString();
            }
            if (mat && mat.emissive) {
                emissiveHex = '#' + mat.emissive.getHexString();
            }

            // Print color should not include emissive glow (avoids over-saturated exports)
            const baseC = mat?.color ? mat.color.clone() : new THREE.Color(0xcccccc);
            const hsl = { h: 0, s: 0, l: 0 };
            baseC.getHSL(hsl);
            const printColor = new THREE.Color().setHSL(
                hsl.h,
                clamp(hsl.s * 0.72, 0, 1),
                clamp(hsl.l * 0.86, 0, 1)
            );

            meshes.push({
                name: obj.name || 'unnamed',
                userData: obj.userData || {},
                vertices,
                faces,
                color: colorHex,
                emissive: emissiveHex,
                emissiveIntensity: mat?.emissiveIntensity || 0,
                printColorHex: '#' + printColor.getHexString(),
                printColorRGB: [
                    Math.round(printColor.r * 255),
                    Math.round(printColor.g * 255),
                    Math.round(printColor.b * 255),
                ],
            });
        });

        const payload = {
            format: 'pulse-geometry-v1',
            units: 'mm',
            targetHeightMm,
            scaleFactor: printable.scaleFactor,
            sourceHeightModelUnits: printable.sourceHeight,
            meshCount: meshes.length,
            bands: this.bands.map(b => ({
                key: b.key,
                name: b.name,
                color: b.color,
                colorDeep: b.colorDeep,
                percentage: b.percentage,
            })),
            meshes,
        };

        return payload;
    }

    downloadGeometryJSON(targetHeightMm = 120) {
        const data = this.exportGeometryJSON(targetHeightMm);
        const json = JSON.stringify(data);
        this._downloadBlob(
            new Blob([json], { type: 'application/json' }),
            `pulso_neurofuncional_${targetHeightMm}mm.json`
        );
        return data;
    }
}
