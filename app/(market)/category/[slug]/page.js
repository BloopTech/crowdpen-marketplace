"use server";

import React from "react";
import { headers } from "next/headers";
import CategoryContentPage from "./content";
import { CategoryContextProvider } from "./context";
import { sanitizeHtmlServer } from "../../../lib/sanitizeHtmlServer";

const CATEGORY_FALLBACK_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL;
const DEFAULT_CATEGORY_METADATA = {
  title: "Crowdpen Marketplace Category",
};

function toPlainText(value) {
  if (!value || typeof value !== "string") return "";
  const clean = sanitizeHtmlServer(value);
  return clean.replace(/\s+/g, " ").trim();
}

async function resolveOrigin() {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "http";
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // Ignore header resolution errors and fall back to env values
  }
  return CATEGORY_FALLBACK_ORIGIN;
}

function getDefaultCategoryMetadata() {
  return { ...DEFAULT_CATEGORY_METADATA };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (!slug) {
    return getDefaultCategoryMetadata();
  }

  const origin = await resolveOrigin();

  try {
    const res = await fetch(
      new URL(
        `/api/marketplace/categories/${encodeURIComponent(slug)}`,
        origin
      ),
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data?.error) {
      return getDefaultCategoryMetadata();
    }

    const categoryName = data?.name ? String(data.name) : null;
    const title = categoryName
      ? `${categoryName} Resources | Crowdpen Marketplace`
      : DEFAULT_CATEGORY_METADATA.title;
    const descriptionRaw = data?.description ? String(data.description) : "";
    const description = toPlainText(descriptionRaw).slice(0, 200);
    const url = new URL(
      `/category/${encodeURIComponent(slug)}`,
      origin
    ).toString();
    const image = data?.image
      ? String(data.image)
      : `https://crowdpen.site/bd2be0d5db87189129e4a8e63baaa2bb684edc743e1f332e7004233767cb5752.crowdpenlogonew.jpg`;

    return {
      title,
      description: description || undefined,
      openGraph: {
        title,
        description: description || undefined,
        url,
        type: "website",
        images: image
          ? [
              {
                url: image,
                alt: title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description: description || undefined,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return getDefaultCategoryMetadata();
  }
}

export default async function CategoryPage({ params }) {
  const { slug } = await params;

  return (
    <>
      <CategoryContextProvider slug={slug}>
        <CategoryContentPage />
      </CategoryContextProvider>
    </>
  );
}
