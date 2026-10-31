import { useEffect, useRef } from 'react';
import { useSettings } from '../store/settings';

export function FpsCounter() {
  const show = useSettings((s) => s.showFps);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!show) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (t: number) => {
      frames++;
      if (t - last >= 500) {
        if (ref.current) ref.current.textContent = `${Math.round((frames * 1000) / (t - last))} FPS`;
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [show]);
  if (!show) return null;
  return <div ref={ref} className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 font-mono text-xs" />;
}
