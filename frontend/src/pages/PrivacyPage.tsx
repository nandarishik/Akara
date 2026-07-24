export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-bg">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold text-text-primary">Privacy Policy</h1>
        <p className="text-text-muted">Last updated: {new Date().getFullYear()}</p>

        <h2>Information We Collect</h2>
        <p>
          AKARA collects sales data that you upload, your email address used for
          account creation, and usage analytics to improve the product.
        </p>

        <h2>How We Use Your Data</h2>
        <p>
          Your data is used exclusively to power analytics features within your
          account. We do not sell your data to third parties.
        </p>

        <h2>Data Storage</h2>
        <p>
          All data is stored in Supabase (PostgreSQL) hosted on AWS. Data is
          encrypted at rest and in transit.
        </p>

        <h2>Data Isolation</h2>
        <p>
          Each customer's data is logically isolated using Row Level Security
          policies. No tenant can access another tenant's data.
        </p>

        <h2>Contact</h2>
        <p>For privacy inquiries, email: privacy@yourdomain.com</p>
      </div>
    </div>
  );
}
