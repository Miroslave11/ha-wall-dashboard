import type { CSSProperties, ReactNode } from "react";
import { useStageScale } from "../hooks/useStageScale";

/**
 * Návrhová plocha pevné velikosti (např. 1280×800), která se proporcionálně
 * zvětší/zmenší na celý displej a vycentruje.
 */
export function Stage({ width, height, children, style }: { width: number; height: number; children: ReactNode; style?: CSSProperties }) {
  const scale = useStageScale(width, height);
  const left = (window.innerWidth - width * scale) / 2;
  const top = (window.innerHeight - height * scale) / 2;
  return (
    <div className="stage-wrap">
      <div className="stage" style={{ width, height, transform: `translate(${left}px, ${top}px) scale(${scale})`, ...style }}>
        {children}
      </div>
    </div>
  );
}
