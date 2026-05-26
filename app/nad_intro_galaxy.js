/**
 * NadIntroGalaxy — minimal spiral starfield for NAD garden intro.
 * Muted palette: deep space + white/silver dust, slow drift.
 */
class NadIntroGalaxy {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.dust = [];
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
}
