"use client";

import { useActionState } from "react";
import { Mail, User, MessageSquare, Send, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { submitContactForm } from "./actions";

const initialState = {
  success: false,
  errors: {},
  values: {},
  message: "",
};

export default function ContactPage() {
  const [state, formAction, isPending] = useActionState(submitContactForm, initialState);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-tertiary/10 dark:bg-primary/10 rounded-full mb-4">
            <Mail className="w-8 h-8 text-tertiary dark:text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Get in Touch
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Have a question, feedback, or need support? We&apos;d love to hear from you. Fill out the form below and we&apos;ll get back to you as soon as possible.
          </p>
        </div>

        {/* Success Message */}
        {state.success && (
          <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-800 dark:text-green-200 font-medium">Message Sent!</p>
              <p className="text-green-700 dark:text-green-300 text-sm mt-1">{state.message}</p>
            </div>
          </div>
        )}

        {/* Form Error */}
        {state.errors?.form && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 dark:text-red-200 font-medium">Failed to Send</p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">{state.errors.form}</p>
            </div>
          </div>
        )}

        {/* Contact Form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
          <form action={formAction} className="space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  defaultValue={state.values?.name || ""}
                  placeholder="John Doe"
                  className={`block w-full pl-10 pr-4 py-3 rounded-xl border ${
                    state.errors?.name
                      ? "border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 dark:border-gray-700 focus:ring-tertiary dark:focus:ring-primary focus:border-tertiary dark:focus:border-primary"
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors`}
                  disabled={isPending}
                />
              </div>
              {state.errors?.name && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.errors.name}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  defaultValue={state.values?.email || ""}
                  placeholder="john@example.com"
                  className={`block w-full pl-10 pr-4 py-3 rounded-xl border ${
                    state.errors?.email
                      ? "border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 dark:border-gray-700 focus:ring-tertiary dark:focus:ring-primary focus:border-tertiary dark:focus:border-primary"
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors`}
                  disabled={isPending}
                />
              </div>
              {state.errors?.email && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.errors.email}</p>
              )}
            </div>

            {/* Subject Field */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FileText className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  defaultValue={state.values?.subject || ""}
                  placeholder="How can we help you?"
                  className={`block w-full pl-10 pr-4 py-3 rounded-xl border ${
                    state.errors?.subject
                      ? "border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 dark:border-gray-700 focus:ring-tertiary dark:focus:ring-primary focus:border-tertiary dark:focus:border-primary"
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors`}
                  disabled={isPending}
                />
              </div>
              {state.errors?.subject && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.errors.subject}</p>
              )}
            </div>

            {/* Message Field */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Message
              </label>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <MessageSquare className="h-5 w-5 text-gray-400" />
                </div>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  defaultValue={state.values?.message || ""}
                  placeholder="Tell us more about your inquiry..."
                  className={`block w-full pl-10 pr-4 py-3 rounded-xl border ${
                    state.errors?.message
                      ? "border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 dark:border-gray-700 focus:ring-tertiary dark:focus:ring-primary focus:border-tertiary dark:focus:border-primary"
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors resize-none`}
                  disabled={isPending}
                />
              </div>
              {state.errors?.message && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.errors.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-tertiary hover:bg-tertiary/90 dark:bg-primary dark:hover:bg-primary/90 text-white font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-tertiary dark:focus:ring-primary focus:ring-offset-2 shadow-lg shadow-tertiary/20 dark:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Message
                </>
              )}
            </button>
          </form>
        </div>

        {/* Additional Contact Info */}
        <div className="mt-10 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Prefer email?{" "}
            <a
              href="mailto:support@crowdpen.co"
              className="text-tertiary dark:text-primary hover:underline font-medium"
            >
              support@crowdpen.co
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
