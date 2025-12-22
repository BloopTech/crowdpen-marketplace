"use server";
import React from "react";
import AdminAnalyticsContent from "./content";
import { AdminAnalyticsProvider } from "./context";

export default async function AdminAnalyticsPage() {
  return (
    <>
      <AdminAnalyticsProvider>
        <AdminAnalyticsContent />
      </AdminAnalyticsProvider>
    </>
  );
}
