/**
 * NadIntroGalaxy — spiral starfield + falling star rain for NAD garden intro.
 * Palette aligned with campo resonante: violet/silver dust, colored falling stars.
 */
class NadIntroGalaxy {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.dust = [];
        this.fallingRain = [];
        this.running = false;
        this.raf = null;
        this.t = 0;
        this.w = 0;
        this.h = 0;
        this.cx = 0;
        this.cy = 0;
        this._resizeHandler = () => this._resize();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this._resize();
        this._seed();
        window.addEventListener('resize', this._resizeHandler);
        this._loop();
    }

    stop() {
        this.running = false;
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
        window.removeEventListener('resize', this._resizeHandler);
    }

    _resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = this.canvas.clientWidth || window.innerWidth;
        const h = this.canvas.clientHeight || window.innerHeight;
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.w = w;
        this.h = h;
        this.cx = w * 0.5;
        this.cy = h * 0.5;
    }

    _seed() {
        this.dust = Array.from({ length: 4800 }, () => {
            const r = Math.pow(Math.random(), 0.55);
            const branch = (Math.floor(Math.random() * 4) / 4) * Math.PI * 2;
            return {
                r,
                branch,
                spin: r * 7.2,
                spread: (Math.random() - 0.5) * 0.09,
                yOff: (Math.random() - 0.5) * 0.05,
                size: 0.25 + Math.random() * 1.05,
                alpha: 0.06 + Math.random() * 0.28,
                tw: Math.random() * Math.PI * 2,
            };
        });

        this.stars = Array.from({ length: 320 }, () => ({
            x: Math.random(),
            y: Math.random(),
            size: Math.random() < 0.9 ? 0.55 : 1.25,
            alpha: 0.12 + Math.random() * 0.48,
            tw: Math.random() * Math.PI * 2,
            spd: 0.25 + Math.random() * 0.9,
        }));

        const rainTints = [
            [236, 238, 246],
            [224, 231, 255],
            [251, 207, 232],
            [221, 214, 254],
            [199, 210, 254],
            [245, 247, 255],
        ];

        this.fallingRain = Array.from({ length: 520 }, () => {
            const tint = rainTints[Math.floor(Math.random() * rainTints.length)];
            return {
                x: Math.random(),
                y: Math.random(),
                speed: 0.22 + Math.random() * 0.95,
                drift: (Math.random() - 0.5) * 0.001,
                size: 0.45 + Math.random() * 1.85,
                alpha: 0.28 + Math.random() * 0.62,
                tw: Math.random() * Math.PI * 2,
                tint,
                streak: Math.random() < 0.22,
                streakLen: 14 + Math.random() * 36,
                depth: 0.45 + Math.random() * 0.75,
            };
        });
    }

    _loop() {
        if (!this.running) return;
        this.t += 0.006;
        this._draw();
        this.raf = requestAnimationFrame(() => this._loop());
    }

    _draw() {
        const { ctx, w, h, cx, cy } = this;

        ctx.fillStyle = '#05030a';
        ctx.fillRect(0, 0, w, h);

        this._drawFallingRain(ctx, w, h);

        for (const s of this.stars) {
            const tw = 0.7 + Math.sin(this.t * s.spd + s.tw) * 0.3;
            ctx.fillStyle = `rgba(236,238,246,${s.alpha * tw})`;
            ctx.beginPath();
            ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
            ctx.fill();
        }

        const scale = Math.min(w, h) * 0.46;
        const rot = this.t * 0.1;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.42 + rot * 0.03);

        for (const p of this.dust) {
            const angle = p.branch + p.spin + rot;
            const radius = p.r * scale;
            const x = Math.cos(angle) * radius + p.spread * scale;
            const y = p.yOff * scale * 0.32 + Math.sin(this.t * 0.22 + p.tw) * 1.5;
            const edge = Math.min(p.r * 1.15, 1);
            const lum = 228 - edge * 38;
            const a = p.alpha * (0.55 + 0.45 * Math.sin(this.t * 0.35 + p.tw));

            ctx.fillStyle = `rgba(${lum | 0},${(lum + 6) | 0},${(lum + 18) | 0},${a})`;
            ctx.beginPath();
            ctx.arc(x, y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.2);
        core.addColorStop(0, 'rgba(245,247,255,0.055)');
        core.addColorStop(0.45, 'rgba(210,218,235,0.018)');
        core.addColorStop(1, 'rgba(5,3,10,0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.2, 0, Math.PI * 2);
        ctx.fill();

        const vig = ctx.createRadialGradient(cx, cy, scale * 0.15, cx, cy, Math.max(w, h) * 0.72);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(5,3,10,0.72)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
    }

    _drawFallingRain(ctx, w, h) {
        for (const s of this.fallingRain) {
            s.y += s.speed * 0.0035 * s.depth + 0.0018;
            s.x += s.drift;

            if (s.y > 1.06) {
                s.y = -0.04 - Math.random() * 0.1;
                s.x = Math.random();
            }
            if (s.x < -0.02) s.x = 1.02;
            if (s.x > 1.02) s.x = -0.02;

            const tw = 0.78 + Math.sin(this.t * 2.4 + s.tw) * 0.42;
            const px = s.x * w;
            const py = s.y * h;
            const [r, g, b] = s.tint;
            const a = Math.min(1, s.alpha * tw * s.depth * 1.35);

            if (s.streak) {
                const len = s.streakLen * s.depth;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const grad = ctx.createLinearGradient(px, py - len, px, py + 2);
                grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
                grad.addColorStop(0.55, `rgba(${r},${g},${b},${a * 0.45})`);
                grad.addColorStop(1, `rgba(${r},${g},${b},${Math.min(1, a * 1.1)})`);
                ctx.strokeStyle = grad;
                ctx.lineWidth = Math.max(0.4, s.size * 0.32);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(px, py - len);
                ctx.lineTo(px, py);
                ctx.stroke();
                ctx.restore();
            }

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const glowR = s.size * (s.streak ? 2.2 : 3.2);
            const glow = ctx.createRadialGradient(px, py, 0, px, py, glowR);
            glow.addColorStop(0, `rgba(${r},${g},${b},${a})`);
            glow.addColorStop(0.35, `rgba(${r},${g},${b},${a * 0.35})`);
            glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(px, py, glowR, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a * 1.45)})`;
            ctx.beginPath();
            ctx.arc(px, py, s.size * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}
