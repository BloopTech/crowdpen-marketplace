"use server";

import React from "react";
import AuthorProfileContent from "./content";
import ErrorPage from "../../../components/ErrorPage";
import { AuthorProfileContextProvider } from "./context";

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

  const origin = process.env.NEXTAUTH_URL;
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
