import { Link } from "react-router-dom";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { AkaraButton } from "@/shared/ui/GradientButton";

export function ServerErrorPage() {
  return (
    <div className="theme-product-dark min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <GlowSurfaceCard className="max-w-md w-full text-center" hover={false}>
        <p className="text-4xl mb-4" aria-hidden>
          âš ï¸
        </p>
        <h1 className="text-2xl font-bold text-text-primary">Server error</h1>
        <p className="text-sm text-text-secondary mt-2">
          Something went wrong on our end. Please try again in a few minutes.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <AkaraButton onClick={() => window.location.reload()}>Reload page</AkaraButton>
          <Link to="/dashboard">
            <AkaraButton variant="secondary">Go to dashboard</AkaraButton>
          </Link>
        </div>
      </GlowSurfaceCard>
    </div>
  );
}
