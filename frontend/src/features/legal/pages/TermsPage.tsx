import { useEffect, useState } from "react";
import { PageSEO } from "@/shared/PageSEO";
import { fetchPublicLegal } from "@/lib/api/public";

const FALLBACK = (
  <>
    <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
    <p className="text-white/50">Last updated: July 2026 · Version 1.0</p>
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
  </>
);

export function TermsPage() {
  const [body, setBody] = useState<string | null>(null);
  const [version, setVersion] = useState("1.0");
  const [title, setTitle] = useState("Terms of Service");

  useEffect(() => {
    fetchPublicLegal("terms")
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
        description="Terms governing use of AKARA sales analytics and AI copilot for Indian FMCG businesses."
        path="/terms"
      />
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-headings:text-white prose-p:text-white/80 prose-li:text-white/80 prose-a:text-[#03B3C3] hover:prose-a:text-[#38bdf8]">
        {body ? (
          <>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <p className="text-white/50">Version {version}</p>
            <div className="whitespace-pre-wrap text-white/80">{body}</div>
          </>
        ) : (
          FALLBACK
        )}
      </div>
    </div>
  );
}
