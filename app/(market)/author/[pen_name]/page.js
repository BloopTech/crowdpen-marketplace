"use server";

import React from "react";
import AuthorProfileContent from "./content";
import ErrorPage from "../../../components/ErrorPage";
import { AuthorProfileContextProvider } from "./context";
import { headers } from "next/headers";
import { sanitizeHtmlServer } from "../../../lib/sanitizeHtmlServer";

const AUTHOR_FALLBACK_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
const DEFAULT_AUTHOR_METADATA = {
  title: "Crowdpen Creator",
};

async function resolveOrigin() {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "http";
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // Ignore errors and fall back to env configuration
  }
  return AUTHOR_FALLBACK_ORIGIN;
}

function toPlainText(value) {
  if (!value || typeof value !== "string") return "";
  const clean = sanitizeHtmlServer(value);
  return clean.replace(/\s+/g, " ").trim();
}

function getDefaultAuthorMetadata() {
  return { ...DEFAULT_AUTHOR_METADATA };
}

export async function generateMetadata({ params }) {
  const { pen_name: penName } = await params;
  if (!penName) {
    return getDefaultAuthorMetadata();
  }

  const origin = await resolveOrigin();

  try {
    const res = await fetch(
      new URL(`/api/marketplace/author/${encodeURIComponent(penName)}/profile`, origin),
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data?.status === "error" || !data?.author) {
      return getDefaultAuthorMetadata();
    }

    const author = data.author;
    const name = author?.name ? String(author.name) : null;
    const title = name
      ? `${name} (@${penName}) | Crowdpen Marketplace`
      : DEFAULT_AUTHOR_METADATA.title;
    const descriptionSource =
      author?.bio || author?.description || author?.description_other || "";
    const description = toPlainText(descriptionSource).slice(0, 200);
    const image =
      author?.cover_image ||
      author?.image ||
      `https://crowdpen.site/bd2be0d5db87189129e4a8e63baaa2bb684edc743e1f332e7004233767cb5752.crowdpenlogonew.jpg`;
    const url = new URL(
      `/author/${encodeURIComponent(penName)}`,
      origin
    ).toString();

    return {
      title,
      description: description || undefined,
      openGraph: {
        title,
        description: description || undefined,
        url,
        type: "profile",
        images: image
          ? [
              {
                url: String(image),
                alt: title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description: description || undefined,
        images: image ? [String(image)] : undefined,
      },
    };
  } catch {
    return getDefaultAuthorMetadata();
  }
}

export default async function AuthorProfilePage({ params }) {
  const { pen_name } = await params;

  if (!pen_name) {
    return (
      <ErrorPage
        statusCode="404"
        translationKey="notFound"
        imageSrc="/images/404-illustration.svg"
        redirectPath="/"
      />
    );
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");
  const origin = (host ? `${proto}://${host}` : null) || AUTHOR_FALLBACK_ORIGIN;
  const url = new URL(`/api/marketplace/author/${pen_name}/profile`, origin).toString();

  const author = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());

  if (!author || (author && author.status === "error")) {
    return (
      <ErrorPage
        statusCode="404"
        translationKey="notFound"
        imageSrc="/images/404-illustration.svg"
        redirectPath="/"
      />
    );
  }

  return (
    <>
      <AuthorProfileContextProvider>
        <AuthorProfileContent author={author.author} />
      </AuthorProfileContextProvider>
    </>
  );
}
