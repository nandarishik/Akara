import { Link } from "react-router-dom";
import { AkaraButton } from "@/components/ui/GradientButton";

export function NotFoundPage() {
  return (
    <div className="theme-product-dark min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-center p-8">
      <div className="text-8xl font-black text-white/10 mb-4 select-none font-display">
        404
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-white/60 mb-4 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex flex-wrap gap-3 justify-center mb-8">
        <Link to="/dashboard">
          <AkaraButton>Back to Dashboard</AkaraButton>
        </Link>
        <Link to="/data" className="text-[#03B3C3] text-sm underline self-center hover:text-[#38bdf8]">
          Import data
        </Link>
      </div>
    </div>
  );
}
