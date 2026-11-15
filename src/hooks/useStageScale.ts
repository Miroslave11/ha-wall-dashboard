import { useEffect, useState } from "react";

/** Měřítko, kterým se návrhová plocha (např. 1280×800) vejde do okna. */
export function useStageScale(width: number, height: number): number {
  const calc = () => Math.min(window.innerWidth / width, window.innerHeight / height);
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const onResize = () => setScale(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);
  return scale;
}
