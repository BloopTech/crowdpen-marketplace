import React from "react";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";
import { Hr } from "@react-email/hr";
import EmailLayout from "./components/EmailLayout";

export default function ContactFormSubmission({
  name = "John Doe",
  email = "john@example.com",
  subject = "General Inquiry",
  message = "This is a sample message from the contact form.",
  submittedAt = new Date().toISOString(),
}) {
  const formattedDate = new Date(submittedAt).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <EmailLayout preview={`New contact form submission from ${name}`}>
      <Section>
        <Text className="text-2xl font-bold text-slate-900 m-0 mb-4">
          New Contact Form Submission
        </Text>
        <Text className="text-slate-600 m-0 mb-6">
          You received a new message from your website contact form.
        </Text>

        <Hr className="border-slate-200 my-6" />

        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <table className="w-full" cellPadding="0" cellSpacing="0">
            <tbody>
              <tr>
                <td className="py-2 pr-4 text-slate-500 font-medium text-sm align-top w-24">
                  From:
                </td>
                <td className="py-2 text-slate-900 text-sm">
                  {name}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-500 font-medium text-sm align-top">
                  Email:
                </td>
                <td className="py-2 text-sm">
                  <a href={`mailto:${email}`} className="text-primary-600 no-underline hover:underline">
                    {email}
                  </a>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-500 font-medium text-sm align-top">
                  Subject:
                </td>
                <td className="py-2 text-slate-900 text-sm">
                  {subject}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-slate-500 font-medium text-sm align-top">
                  Date:
                </td>
                <td className="py-2 text-slate-900 text-sm">
                  {formattedDate}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Text className="text-slate-500 font-medium text-sm m-0 mb-2">
          Message:
        </Text>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <Text className="text-slate-900 m-0 whitespace-pre-wrap leading-relaxed">
            {message}
          </Text>
        </div>

        <Hr className="border-slate-200 my-6" />

        <Text className="text-sm text-slate-500 m-0">
          You can reply directly to this email to respond to {name}.
        </Text>
      </Section>
    </EmailLayout>
  );
}
