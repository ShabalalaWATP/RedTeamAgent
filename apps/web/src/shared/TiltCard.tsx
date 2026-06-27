import { useCallback, useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';

const MAX_TILT_DEGREES = 5;

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Wraps content in an <article> that tilts subtly in 3D toward the pointer.
 * Updates CSS custom properties directly (no re-render) and honours
 * reduced-motion. At rest it renders flat, so it is snapshot-stable.
 */
export function TiltCard({ className = '', children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  const handleMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    // Handlers only fire on the mounted <article>, so the ref is always set.
    const element = ref.current!;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const tiltY = ((event.clientX - rect.left) / rect.width - 0.5) * 2 * MAX_TILT_DEGREES;
    const tiltX = (0.5 - (event.clientY - rect.top) / rect.height) * 2 * MAX_TILT_DEGREES;
    element.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
    element.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
  }, []);

  const reset = useCallback(() => {
    const element = ref.current!;
    element.style.setProperty('--tilt-x', '0deg');
    element.style.setProperty('--tilt-y', '0deg');
  }, []);

  return (
    <article ref={ref} className={`tilt ${className}`.trim()} onPointerMove={handleMove} onPointerLeave={reset}>
      {children}
    </article>
  );
}
