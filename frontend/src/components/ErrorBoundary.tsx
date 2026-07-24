import { Component, type ReactNode } from "react";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { AkaraButton } from "@/components/ui/GradientButton";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 bg-surface-canvas">
          <SurfaceCard className="max-w-md w-full text-center">
            <p className="text-4xl mb-4" aria-hidden>
              ⚠️
            </p>
            <h2 className="text-h2">Something went wrong</h2>
            <p className="text-body text-sm mt-2">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <AkaraButton className="mt-6" onClick={() => window.location.reload()}>
              Reload page
            </AkaraButton>
          </SurfaceCard>
        </div>
      );
    }
    return this.props.children;
  }
}
