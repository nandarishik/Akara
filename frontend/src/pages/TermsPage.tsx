export function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-bg">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold text-text-primary">Terms of Service</h1>
        <p className="text-text-muted">Last updated: July 2026 · Version 1.0</p>

        <h2>Acceptance</h2>
        <p>
          By creating an AKARA account you agree to these Terms and our Privacy Policy.
          You must be authorised to bind your business to this agreement.
        </p>

        <h2>Service</h2>
        <p>
          AKARA provides sales analytics, AI copilot, reports, and related SaaS features
          subject to your subscription plan limits.
        </p>

        <h2>Payments &amp; Refunds</h2>
        <p>
          Paid plans are billed via Razorpay. GST invoices are issued by AKARA. Subscriptions
          renew automatically unless cancelled in Billing. Refunds are handled case-by-case
          for billing errors within 7 days of charge.
        </p>

        <h2>SLA</h2>
        <p>
          We target 99.5% monthly API availability excluding scheduled maintenance.
          Business plan customers may request priority support via support@akara.ai.
        </p>

        <h2>Acceptable Use</h2>
        <p>
          You may not abuse rate limits, attempt cross-tenant access, upload malware,
          or use the service for unlawful purposes. We may suspend accounts that violate
          these terms.
        </p>

        <h2>Data Ownership</h2>
        <p>
          You retain ownership of uploaded sales data. AKARA processes it only to provide
          the service as described in the Privacy Policy.
        </p>

        <h2>Liability</h2>
        <p>
          AKARA is provided &quot;as is&quot; to the maximum extent permitted by law.
          Our aggregate liability is limited to fees paid in the preceding 12 months.
        </p>

        <h2>Termination</h2>
        <p>
          You may delete your account from Settings. We may terminate for material breach
          with notice. Upon termination, data is deleted per the retention schedule.
        </p>

        <h2>Governing Law</h2>
        <p>
          These Terms are governed by the laws of India. Courts in Bengaluru, Karnataka
          have exclusive jurisdiction.
        </p>

        <h2>Contact</h2>
        <p>
          Legal: <a href="mailto:legal@akara.ai">legal@akara.ai</a>
        </p>
      </div>
    </div>
  );
}
