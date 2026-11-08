import { ReactNode, useLayoutEffect, useRef, useState } from 'react';

/**
 * Scales a fixed-width board to fit the available area, so the whole thing is
 * visible on any screen (13" laptop → 32"+ TV) with no scrolling. The content is
 * authored at `designWidth`; we shrink/enlarge it uniformly to fit both dimensions.
 */
export default function FitToScreen({
  enabled,
  designWidth = 1500,
  maxScale = 1.6,
  children,
}: {
  enabled: boolean;
  designWidth?: number;
  maxScale?: number;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!enabled) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const recompute = () => {
      const availW = outer.clientWidth;
      const availH = outer.clientHeight;
      const natH = inner.offsetHeight; // layout height is unaffected by the transform
      if (!natH || !availW || !availH) return;
      const s = Math.min(availW / designWidth, availH / natH, maxScale);
      setScale(s > 0 && isFinite(s) ? s : 1);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(outer);
    ro.observe(inner);
    window.addEventListener('resize', recompute);
    const t = setTimeout(recompute, 200); // after charts/fonts settle
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
      clearTimeout(t);
    };
  }, [enabled, designWidth, maxScale]);

  if (!enabled) return <div className="page tvboard">{children}</div>;

  return (
    <div ref={outerRef} className="fit-outer">
      <div ref={innerRef} className="tvboard fit-pad" style={{ width: designWidth, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {children}
      </div>
    </div>
  );
}
