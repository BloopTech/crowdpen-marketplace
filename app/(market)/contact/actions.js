"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { render, pretty } from "@react-email/render";
import { sendEmail } from "@/app/lib/sendEmail";
import ContactFormSubmission from "@/app/emails/ContactFormSubmission";
import { getRequestIdFromHeaders, reportError } from "../../lib/observability/reportError";

const contactSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z
    .string()
    .min(5, "Subject must be at least 5 characters")
    .max(200, "Subject must be less than 200 characters"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message must be less than 5000 characters"),
});

export async function submitContactForm(prevState, formData) {
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  };

  const validation = contactSchema.safeParse(rawData);

  if (!validation.success) {
    const errors = {};
    validation.error.errors.forEach((err) => {
      errors[err.path[0]] = err.message;
    });
    return {
      success: false,
      errors,
      values: rawData,
    };
  }

  const { name, email, subject, message } = validation.data;
  const submittedAt = new Date().toISOString();

  try {
    const supportEmail =
      process.env.SUPPORT_EMAIL ||
      process.env.EMAIL_FROM ||
      "support@crowdpen.co";

    const html = await pretty(
      await render(
        <ContactFormSubmission
          name={name}
          email={email}
          subject={subject}
          message={message}
          submittedAt={submittedAt}
        />
      )
    );

    const text = `
New Contact Form Submission

From: ${name}
Email: ${email}
Subject: ${subject}
Date: ${submittedAt}

Message:
${message}
    `.trim();

    await sendEmail({
      to: supportEmail,
      subject: `[Contact Form] ${subject}`,
      html,
      text,
      replyTo: email,
    });

    return {
      success: true,
      message:
        "Your message has been sent successfully! We'll get back to you soon.",
    };
  } catch (error) {
    let requestId = null;
    try {
      requestId = getRequestIdFromHeaders(await headers());
    } catch {
      requestId = null;
    }
    await reportError(error, {
      tag: "contact_form_submit",
      route: "server_action:contact#submitContactForm",
      method: "SERVER_ACTION",
      status: 500,
      requestId,
    });
    return {
      success: false,
      errors: {
        form: "Failed to send your message. Please try again later or email us directly.",
      },
      values: rawData,
    };
  }
}
