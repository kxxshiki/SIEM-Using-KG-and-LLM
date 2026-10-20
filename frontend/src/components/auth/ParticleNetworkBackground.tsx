import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}
interface Palette {
  dot: string;
  line: string;
  dotAlpha: number;
  lineAlpha: number;
  glow: number;
}

const PALETTES: Record<"dark" | "light", Palette> = {
  dark: { dot: "167, 139, 250", line: "139, 92, 246", dotAlpha: 0.8, lineAlpha: 0.3, glow: 8 },
  light: { dot: "109, 40, 217", line: "124, 58, 237", dotAlpha: 0.55, lineAlpha: 0.22, glow: 0 },
};

/** Always-moving network of dots and lines. The parent element must be `relative`. */
interface ParticleNetworkBackgroundProps {
  className?: string;
  animate?: boolean;
}

export default function ParticleNetworkBackground({
  className,
  animate = true,
}: ParticleNetworkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef<"dark" | "light">(theme);

  useEffect(() => {
    themeRef.current = theme; // colours are read on every frame; no restart needed
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext("2d") : null;
    if (!canvas || !ctx) return;

    const host = canvas.parentElement ?? canvas;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!animate) {
  const pal = PALETTES[themeRef.current];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return;
}
    // Always animated. If the computer asks for reduced motion, move gently instead of stopping.
    let speed = motionQuery.matches ? 0.35 : 1;
    let width = 1;
    let height = 1;
    let linkDist = 140;
    let particles: Particle[] = [];
    let raf = 0;
    let last = 0;
    let running = false;

    const make = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 36, // pixels per second
      vy: (Math.random() - 0.5) * 36,
      r: 1 + Math.random() * 1.4,
    });

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      linkDist = width < 640 ? 100 : 140;
      const density = width < 640 ? 17000 : 14000; // fewer particles on small screens
      const target = Math.round(Math.min(90, Math.max(22, (width * height) / density)));
      if (particles.length > target) particles.length = target;
      while (particles.length < target) particles.push(make());
      for (const p of particles) {
        p.x = Math.min(p.x, width);
        p.y = Math.min(p.y, height);
      }
    };

    const draw = () => {
      const pal = PALETTES[themeRef.current];
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      const maxSq = linkDist * linkDist;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxSq) {
            const alpha = (1 - Math.sqrt(d2) / linkDist) * pal.lineAlpha;
            ctx.strokeStyle = `rgba(${pal.line}, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = `rgba(${pal.dot}, ${pal.dotAlpha})`;
      ctx.shadowColor = `rgba(${pal.dot}, 0.6)`;
      ctx.shadowBlur = pal.glow;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const step = (dt: number) => {
      for (const p of particles) {
        p.x += p.vx * dt * speed;
        p.y += p.vy * dt * speed;
        if (p.x < 0 || p.x > width) {
          p.vx *= -1;
          p.x = Math.min(Math.max(p.x, 0), width);
        }
        if (p.y < 0 || p.y > height) {
          p.vy *= -1;
          p.y = Math.min(Math.max(p.y, 0), height);
        }
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; // about 30 frames per second keeps CPU use low
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      step(dt);
      draw();
    };
    const start = () => {
      if (running || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotion = () => {
      speed = motionQuery.matches ? 0.35 : 1;
    };
    const onResize = () => {
      resize();
      if (!running) draw();
    };

    resize();
    draw();
    start();

    document.addEventListener("visibilitychange", onVisibility);
    motionQuery.addEventListener("change", onMotion);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(onResize);
      observer.observe(host);
    } else {
      window.addEventListener("resize", onResize);
    }

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", onMotion);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-0 h-full w-full", className)}
    />
  );
}