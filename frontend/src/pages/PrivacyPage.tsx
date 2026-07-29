export function PrivacyPage() {
  return (
    <div className="theme-product-dark min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-headings:text-white prose-p:text-white/80 prose-li:text-white/80 prose-th:text-white prose-td:text-white/80 prose-a:text-[#03B3C3] hover:prose-a:text-[#38bdf8]">
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-white/50">Last updated: July 2026 · Version 1.0</p>

        <h2>Information We Collect</h2>
        <p>
          AKARA collects account information (name, email), sales data you upload,
          usage analytics, and billing details when you subscribe. We use cookies for
          session management and product analytics.
        </p>

        <h2 id="ai-processing">AI Processing</h2>
        <p>
          Your sales data (revenue figures, party names, product names) is analysed by
          AI systems to generate insights. Personal contact information (phone numbers,
          GSTIN, PAN, email addresses in uploaded files) is automatically removed
          before processing. Your data is never shared with other organisations.
        </p>
        <p>
          AI inference uses OpenAI-compatible APIs. Requests may be processed in the
          United States under OpenAI&apos;s Data Processing Agreement. AKARA acts as a
          Data Processor; your business is the Data Controller under DPDP Act 2023.
        </p>

        <h2>Data Storage and Processing</h2>
        <p>
          Primary data is stored in Supabase (PostgreSQL) on AWS. Verify your project
          region in Supabase Dashboard — we target India regions (ap-south-1 Mumbai or
          ap-south-2 Hyderabad) for DPDP compliance.
        </p>

        <h2>Sub-processors</h2>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Supabase</td><td>Database + Auth</td><td>India (target)</td></tr>
            <tr><td>OpenAI / OpenRouter</td><td>AI inference</td><td>US</td></tr>
            <tr><td>Railway</td><td>Backend hosting</td><td>US</td></tr>
            <tr><td>Vercel</td><td>Frontend hosting</td><td>US</td></tr>
            <tr><td>SendGrid</td><td>Email delivery</td><td>US</td></tr>
            <tr><td>Razorpay</td><td>Payment processing</td><td>India</td></tr>
          </tbody>
        </table>

        <h2>Your Rights (DPDP Act 2023)</h2>
        <p>
          You may request access, correction, or deletion of your data. Contact us to
          withdraw AI processing consent or export your tenant data. We respond within
          statutory timelines.
        </p>

        <h2>Retention</h2>
        <p>
          Data retention depends on your plan: Free 30 days, Pro 365 days, Business
          1,095 days. Backups follow the same policy unless law requires longer retention.
        </p>

        <h2>Security</h2>
        <p>
          Tenant data is isolated with Row Level Security. API traffic uses HTTPS,
          rate limiting, and security headers. Incidents are investigated per our
          breach notification procedure.
        </p>

        <h2>Contact</h2>
        <p>
          Privacy inquiries: <a href="mailto:privacy@akara.ai">privacy@akara.ai</a>
        </p>
      </div>
    </div>
  );
}
