import { Link } from "react-router-dom";
import { AkaraButton } from "@/components/ui/GradientButton";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-canvas text-center p-8">
      <div className="text-8xl font-black text-surface-raised mb-4 select-none font-display">
        404
      </div>
      <h1 className="text-display text-2xl mb-2">Page not found</h1>
      <p className="text-body mb-4 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-wrap gap-3 justify-center mb-8">
        <Link to="/dashboard">
          <AkaraButton>Back to Dashboard</AkaraButton>
        </Link>
        <Link to="/data" className="text-accent text-sm underline self-center">
          Import data
        </Link>
      </div>
    </div>
  );
}
