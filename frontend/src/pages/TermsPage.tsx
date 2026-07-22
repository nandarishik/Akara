export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-slate-500">Last updated: {new Date().getFullYear()}</p>

        <h2>Acceptance</h2>
        <p>
          By using AKARA, you agree to these terms. If you do not agree,
          discontinue use immediately.
        </p>

        <h2>Use of Service</h2>
        <p>
          AKARA is provided for business analytics purposes. You are responsible
          for the accuracy of data you upload.
        </p>

        <h2>Data Ownership</h2>
        <p>
          You retain ownership of all data you upload. AKARA claims no ownership
          over your sales data.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          AKARA provides analytics tools on an "as-is" basis. We are not liable
          for business decisions made based on dashboard outputs.
        </p>

        <h2>Termination</h2>
        <p>
          We may suspend accounts that violate these terms. You may delete your
          account and data at any time.
        </p>
      </div>
    </div>
  );
}
