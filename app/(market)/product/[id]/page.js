"use server";
import { ProductItemContextProvider } from "./context";
import ProductDetailContent from "./content";
import { headers } from "next/headers";
import { sanitizeHtmlServer } from "../../../lib/sanitizeHtmlServer";

function htmlToTextServer(dirty) {
  if (!dirty || typeof dirty !== "string") return "";
  const clean = sanitizeHtmlServer(dirty);
  return clean.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function getOriginFromHeaders() {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "http";
    const host = h.get("x-forwarded-host") || h.get("host");
    return host ? `${proto}://${host}` : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const origin =
    (await getOriginFromHeaders()) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  try {
    const res = await fetch(
      new URL(`/api/marketplace/products/item/${encodeURIComponent(id)}`, origin),
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data?.error) {
      return {
        title: "Product",
      };
    }

    const title = data?.title ? String(data.title) : "Product";
    const image =
      (Array.isArray(data?.images) && data.images[0]) || data?.image || null;
    const descriptionRaw = data?.description ? String(data.description) : "";
    const description = htmlToTextServer(descriptionRaw).slice(0, 300);

    const url = new URL(`/product/${encodeURIComponent(id)}`, origin).toString();

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
    return {
      title: "Product",
    };
  }
}

export default async function ProductDetailPage({ params }) {
  const { id } = await params;

  return (
    <>
      <ProductItemContextProvider id={id}>
        <ProductDetailContent id={id} />
      </ProductItemContextProvider>
    </>
  );
}
