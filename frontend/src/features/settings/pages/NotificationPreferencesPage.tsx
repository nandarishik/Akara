import ProductPageLayout from "@/shared/layout/ProductPageLayout";

import { NotificationPreferencesPanel } from "../components/NotificationPreferencesPanel";

export function NotificationPreferencesPage() {
  return (
    <ProductPageLayout maxWidth="3xl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Alert channel matrix</h1>
        <p className="text-sm text-text-muted mt-1">
          Choose email, WhatsApp, and in-app delivery per café alert type.
        </p>
      </div>
      <NotificationPreferencesPanel />
    </ProductPageLayout>
  );
}
