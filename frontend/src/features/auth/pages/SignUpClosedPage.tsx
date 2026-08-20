import { Link } from "react-router-dom";

import { AuthLayout } from "@/shared/layout/AuthLayout";
import { AkaraButton } from "@/shared/ui/GradientButton";

export function SignUpClosedPage() {
  return (
    <AuthLayout title="Signups paused" subtitle="We're not accepting new accounts right now.">
      <div className="space-y-4 text-center">
        <p className="text-sm text-text-secondary">
          AKARA is in invite-only or maintenance mode. If you already have an account, you can still log in.
        </p>
        <Link to="/login">
          <AkaraButton className="w-full">Go to login</AkaraButton>
        </Link>
      </div>
    </AuthLayout>
  );
}
