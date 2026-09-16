import "server-only";

import type { Metadata } from "next";
import { buildAbsoluteUrl } from "@/lib/routing/origins";
import type { PublicPath } from "@/lib/routing/types";

interface MarketingMetadataInput {
  path: PublicPath;
  title: string;
  description: string;
}

export function buildMarketingMetadata({
  path,
  title,
  description,
}: MarketingMetadataInput): Metadata {
  const url = buildAbsoluteUrl({ surface: "marketing", path });

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      locale: "es_PE",
      type: "website",
      siteName: "VeraDoc.pe",
    },
  };
}
