import { cn } from "@/lib/utils";
import "./DarkMeshBackground.css";

type Props = {
  className?: string;
  showVignette?: boolean;
};

/** Static BorderGlow mesh — CSS only, no WebGL. */
export default function DarkMeshBackground({ className, showVignette = true }: Props) {
  return (
    <div className={cn("dark-mesh-bg", className)} aria-hidden>
      <div className="dark-mesh-bg__gradients" />
      {showVignette && <div className="dark-mesh-bg__vignette" />}
    </div>
  );
}
