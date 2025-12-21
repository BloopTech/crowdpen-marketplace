"use server";

import { z } from "zod";
import { render } from "@react-email/render";
import { sendEmail } from "@/app/lib/sendEmail";
import ContactFormSubmission from "@/app/emails/ContactFormSubmission";

const contactSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .email("Please enter a valid email address"),
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
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || "support@crowdpen.co";
    
    const html = await render(
      ContactFormSubmission({
        name,
        email,
        subject,
        message,
        submittedAt,
      })
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
      message: "Your message has been sent successfully! We'll get back to you soon.",
    };
  } catch (error) {
    console.error("Contact form submission error:", error);
    return {
      success: false,
      errors: {
        form: "Failed to send your message. Please try again later or email us directly.",
      },
      values: rawData,
    };
  }
}
