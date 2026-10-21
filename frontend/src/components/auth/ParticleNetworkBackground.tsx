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
  dark: {
    dot: "167, 139, 250",
    line: "139, 92, 246",
    dotAlpha: 0.8,
    lineAlpha: 0.3,
    glow: 8,
  },
  light: {
    dot: "109, 40, 217",
    line: "124, 58, 237",
    dotAlpha: 0.55,
    lineAlpha: 0.22,
    glow: 0,
  },
};

/** Decorative network background. It is not data and not the Neo4j graph. */
export default function ParticleNetworkBackground({
  className,
}: {
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef<"dark" | "light">(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let width = 1;
    let height = 1;
    let linkDist = 140;
    let particles: Particle[] = [];
    let raf = 0;
    let last = 0;
    let running = false;
    let resizeTimer = 0;

    const reducedMotion = () => motionQuery.matches;

    const make = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 36,
      vy: (Math.random() - 0.5) * 36,
      r: 1 + Math.random() * 1.4,
    });

    const resize = () => {
      width = Math.max(window.innerWidth, 1);
      height = Math.max(window.innerHeight, 1);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      linkDist = width < 640 ? 100 : 140;

      const density = width < 640 ? 20000 : 16000;
      const target = Math.round(
        Math.min(70, Math.max(20, (width * height) / density)),
      );

      if (particles.length > target) particles.length = target;

      while (particles.length < target) {
        particles.push(make());
      }

      for (const particle of particles) {
        particle.x = Math.min(particle.x, width);
        particle.y = Math.min(particle.y, height);
      }
    };

    const draw = () => {
      const palette = PALETTES[themeRef.current];

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;

      const maxDistanceSquared = linkDist * linkDist;

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared < maxDistanceSquared) {
            const alpha =
              (1 - Math.sqrt(distanceSquared) / linkDist) *
              palette.lineAlpha;

            ctx.strokeStyle = `rgba(${palette.line}, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = `rgba(${palette.dot}, ${palette.dotAlpha})`;
      ctx.shadowColor = `rgba(${palette.dot}, 0.6)`;
      ctx.shadowBlur = palette.glow;

      for (const particle of particles) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    };

    const step = (dt: number) => {
      for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        if (particle.x < 0 || particle.x > width) {
          particle.vx *= -1;
          particle.x = Math.min(Math.max(particle.x, 0), width);
        }

        if (particle.y < 0 || particle.y > height) {
          particle.vy *= -1;
          particle.y = Math.min(Math.max(particle.y, 0), height);
        }
      }
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const frame = (time: number) => {
      if (!running || document.hidden || reducedMotion()) {
        stop();
        return;
      }

      if (time - last >= 33) {
        const dt = Math.min((time - last) / 1000, 0.1);
        last = time;
        step(dt);
        draw();
      }

      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || document.hidden || reducedMotion()) return;

      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        draw();
        start();
      }
    };

    const onMotionChange = () => {
      if (reducedMotion()) {
        stop();
        draw();
      } else {
        start();
      }
    };

    const onResize = () => {
      window.clearTimeout(resizeTimer);

      resizeTimer = window.setTimeout(() => {
        resize();
        draw();
      }, 120);
    };

    resize();
    draw();
    start();

    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      window.clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 h-full w-full",
        className,
      )}
    />
  );
}
