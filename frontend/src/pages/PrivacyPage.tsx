import { useEffect, useState } from "react";
import { PageSEO } from "@/components/seo/PageSEO";
import { fetchPublicLegal } from "@/lib/api/public";

export function PrivacyPage() {
  const [body, setBody] = useState<string | null>(null);
  const [version, setVersion] = useState("1.0");
  const [title, setTitle] = useState("Privacy Policy");

  useEffect(() => {
    fetchPublicLegal("privacy")
      .then((doc) => {
        if (doc?.body_markdown) {
          setBody(doc.body_markdown);
          if (doc.version) setVersion(doc.version);
          if (doc.title) setTitle(doc.title);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="theme-product-dark min-h-screen bg-[#0a0a0a]">
      <PageSEO
        title={title}
        description="How AKARA collects, uses, and protects your sales data and account information under DPDP Act 2023."
        path="/privacy"
      />
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-headings:text-white prose-p:text-white/80 prose-li:text-white/80 prose-th:text-white prose-td:text-white/80 prose-a:text-[#03B3C3] hover:prose-a:text-[#38bdf8]">
        {body ? (
          <>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <p className="text-white/50">Version {version}</p>
            <div className="whitespace-pre-wrap text-white/80">{body}</div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
            <p className="text-white/50">Last updated: July 2026 · Version {version}</p>
            <h2>Information We Collect</h2>
            <p>
              AKARA collects account information (name, email), sales data you upload,
              usage analytics, and billing details when you subscribe.
            </p>
            <h2>Contact</h2>
            <p>
              Privacy inquiries: <a href="mailto:privacy@akara.ai">privacy@akara.ai</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
