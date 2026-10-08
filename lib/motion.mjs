import { useEffect, useState } from 'react';

// lite: phones, save-data and low-end devices get fewer objects and no blur.
function getMotionProfile() {
  if (typeof window === 'undefined') return { lite: false, reduced: false, compact: false, touch: false };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = matchMedia('(max-width: 760px)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const weak = !!navigator.connection?.saveData || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4);
  return { reduced, compact, touch, lite: reduced || compact || weak };
}

export function useMotionProfile() {
  const [value, setValue] = useState(getMotionProfile);
  useEffect(() => {
    const queries = [matchMedia('(prefers-reduced-motion: reduce)'), matchMedia('(max-width: 760px)'), matchMedia('(hover: none)')];
    const update = () => setValue(getMotionProfile());
    queries.forEach(q => q.addEventListener('change', update));
    return () => queries.forEach(q => q.removeEventListener('change', update));
  }, []);
  return value;
}
