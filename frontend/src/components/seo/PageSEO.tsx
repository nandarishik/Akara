import { Helmet } from "react-helmet-async";

interface PageSEOProps {
  title: string;
  description: string;
  path?: string;
  jsonLd?: Record<string, unknown>;
  noindex?: boolean;
}

const SITE = "https://akara.ai";

export function PageSEO({
  title,
  description,
  path = "",
  jsonLd,
  noindex = false,
}: PageSEOProps) {
  const url = `${SITE}${path}`;
  const fullTitle = title.includes("AKARA") ? title : `${title} | AKARA`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="https://akara.ai/og-image.svg" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content="https://akara.ai/og-image.svg" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
