"use server";

import React from "react";
import AuthorProfileContent from "./content";
import ErrorPage from "../../../components/ErrorPage";
import { AuthorProfileContextProvider } from "./context";
import { headers } from "next/headers";

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
  const origin =
    (host ? `${proto}://${host}` : null) ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL(`/api/marketplace/author/${pen_name}`, origin).toString();

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
