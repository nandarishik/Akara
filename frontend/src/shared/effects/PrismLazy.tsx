import { lazy, Suspense, useEffect, useRef, useState } from "react";

const Prism = lazy(() => import("./Prism"));

type PrismProps = {
  animationType?: "rotate" | "hover" | "3drotate";
  timeScale?: number;
  height?: number;
  baseWidth?: number;
  scale?: number;
  hueShift?: number;
  colorFrequency?: number;
  noise?: number;
  glow?: number;
  suspendWhenOffscreen?: boolean;
  className?: string;
};

export default function PrismLazy(props: PrismProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={props.className ?? "absolute inset-0"}>
      {visible && (
        <Suspense fallback={null}>
          <Prism {...props} />
        </Suspense>
      )}
    </div>
  );
}
