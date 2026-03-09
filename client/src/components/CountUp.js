import { useEffect, useRef, useState } from 'react';

export default function CountUp({ value, decimals = 2, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef();
  const startRef = useRef();
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = parseFloat(value) || 0;
    prevRef.current = to;
    const start = performance.now();
    startRef.current = start;
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{display.toFixed(decimals)}</>;
}
