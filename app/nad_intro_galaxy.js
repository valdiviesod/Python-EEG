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

        const vig = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.07, cx, cy, Math.max(w, h) * 0.72);
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
