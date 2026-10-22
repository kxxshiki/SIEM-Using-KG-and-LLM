
import { useCallback, useEffect, useRef } from "react";
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
    dot: "192, 153, 255",
    line: "139, 92, 246",
    dotAlpha: 0.9,
    lineAlpha: 0.4,
    glow: 10,
  },
  light: {
    dot: "109, 40, 217",
    line: "124, 58, 237",
    dotAlpha: 0.8,
    lineAlpha: 0.3,
    glow: 6,
  },
};

export default function ParticleNetworkBackground({
  className,
  animate,
}: {
  className?: string;
  /** Force animation on/off; by default the user's reduced-motion setting is respected. */
  animate?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const { theme } = useTheme();
  const themeRef = useRef<"dark" | "light">(theme);

  // Keep the current theme available to the animation without restarting it.
  useEffect(() => {
    themeRef.current = theme;
    drawRef.current?.();
  }, [theme]);

  const drawCurrentFrame = useCallback(() => {
    drawRef.current?.();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let width = 1;
    let height = 1;
    let linkDist = 150;
    let particles: Particle[] = [];
    let raf = 0;
    let last = 0;
    let running = false;
    let resizeTimer = 0;

    const reducedMotion = () => animate === false || (animate !== true && motionQuery.matches);

    const makeParticle = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      r: 1.1 + Math.random() * 1.5,
    });

    const resize = () => {
      width = Math.max(window.innerWidth, 1);
      height = Math.max(window.innerHeight, 1);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      linkDist = width < 640 ? 110 : 150;

      // Responsive particle density, capped to protect performance.
      const density = width < 640 ? 14000 : 11000;
      const target = Math.round(
        Math.min(100, Math.max(30, (width * height) / density)),
      );

      if (particles.length > target) {
        particles.length = target;
      }

      while (particles.length < target) {
        particles.push(makeParticle());
      }

      for (const particle of particles) {
        particle.x = Math.min(Math.max(particle.x, 0), width);
        particle.y = Math.min(Math.max(particle.y, 0), height);
      }
    };

    const draw = () => {
      const palette = PALETTES[themeRef.current];

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;

      const maxDistanceSquared = linkDist * linkDist;

      // Draw connections between nearby particles.
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared < maxDistanceSquared) {
            const distance = Math.sqrt(distanceSquared);
            const alpha =
              (1 - distance / linkDist) * palette.lineAlpha;

            ctx.strokeStyle = `rgba(${palette.line}, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw glowing purple nodes.
      ctx.fillStyle = `rgba(${palette.dot}, ${palette.dotAlpha})`;
      ctx.shadowColor = `rgba(${palette.dot}, 0.75)`;
      ctx.shadowBlur = palette.glow;

      for (const particle of particles) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    };

    drawRef.current = draw;

    const moveParticles = (dt: number) => {
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
        moveParticles(dt);
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

        if (!reducedMotion()) start();
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

      drawRef.current = null;
    };
  }, [animate]);

  // Redraw immediately when the theme changes, including reduced-motion mode.
  useEffect(() => {
    drawCurrentFrame();
  }, [theme, drawCurrentFrame]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-0 h-screen w-screen",
        className,
      )}
      style={{ pointerEvents: "none" }}
    />
  );
}
