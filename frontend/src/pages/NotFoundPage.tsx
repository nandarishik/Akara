import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-8">
      <div className="text-8xl font-black text-slate-200 mb-4 select-none">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Page not found
      </h1>
      <p className="text-slate-500 mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
