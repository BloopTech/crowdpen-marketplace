import React from "react";
import { Button } from "@react-email/button";
import { Heading } from "@react-email/heading";
import { Text } from "@react-email/text";
import { Section } from "@react-email/section";
import EmailLayout from "./components/EmailLayout";

export default function KycRejected({
  name = "there",
  accountUrl = "#",
  reason = "",
}) {
  return (
    <EmailLayout preview="Update on your KYC verification">
      <Section>
        <Heading as="h2" className="text-2xl font-bold text-slate-900">
          Your identity verification needs attention
        </Heading>
        <Text className="text-slate-700 leading-6 mt-2">Hi {name},</Text>
        <Text className="text-slate-700 leading-6">
          Unfortunately, we couldn&apos;t approve your KYC this time.{" "}
          {reason ? "Here is the reason:" : ""}
        </Text>
        {reason ? (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <Text className="text-amber-800 leading-6 m-0">{reason}</Text>
          </div>
        ) : null}
        <Text className="text-slate-700 leading-6 mt-4">
          Please review and resubmit your details. If you believe this was a
          mistake, reply to this email and our team will help.
        </Text>
        <div className="mt-6">
          <Button
            href={accountUrl}
            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-md font-medium"
          >
            Review and resubmit
          </Button>
        </div>
      </Section>
    </EmailLayout>
  );
}
