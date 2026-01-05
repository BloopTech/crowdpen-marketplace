import React from "react";
import { Button } from "@react-email/button";
import { Heading } from "@react-email/heading";
import { Text } from "@react-email/text";
import { Section } from "@react-email/section";
import EmailLayout from "./components/EmailLayout";

export default function KycApproved({
  name = "there",
  accountUrl = "#",
  level = "standard",
}) {
  return (
    <EmailLayout preview="Your KYC verification is approved">
      <Section>
        <Heading as="h2" className="text-2xl font-bold text-slate-900">
          Your identity verification is approved
        </Heading>
        <Text className="text-slate-700 leading-6 mt-2">Hi {name},</Text>
        <Text className="text-slate-700 leading-6">
          Great news! Your KYC has been approved. Your verification level is{" "}
          <strong className="font-semibold">
            {String(level).toUpperCase()}
          </strong>
          .
        </Text>
        <Text className="text-slate-700 leading-6">
          You can now access all marketplace features including selling and
          faster checkout.
        </Text>
        <div className="mt-6">
          <Button
            href={accountUrl}
            className="bg-primary-600 text-white px-5 py-3 rounded-md font-medium"
          >
            Go to your account
          </Button>
        </div>
      </Section>
    </EmailLayout>
  );
}
