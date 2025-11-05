import React from "react";
import { Html } from "@react-email/html";
import { Head } from "@react-email/head";
import { Preview } from "@react-email/preview";
import { Tailwind } from "@react-email/tailwind";
import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Img } from "@react-email/img";

export default function EmailLayout({ preview, children }) {
  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                primary: {
                  50: "#eff6ff",
                  100: "#dbeafe",
                  200: "#bfdbfe",
                  300: "#93c5fd",
                  400: "#60a5fa",
                  500: "#3b82f6",
                  600: "#2563eb",
                  700: "#1d4ed8",
                  800: "#1e40af",
                  900: "#1e3a8a",
                },
              },
            },
          },
        }}
      >
        <Body className="bg-[#f6f9fc] m-0 p-0">
          <Container className="w-[600px] mx-auto my-6 bg-white rounded-lg shadow-sm border border-slate-200 p-0">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Img
                  src="https://crowdpen.co/crowdpen_icon.png"
                  width="32"
                  height="32"
                  alt="Crowdpen"
                  style={{ borderRadius: 6 }}
                />
                <span className="text-xl font-semibold text-slate-900">Crowdpen</span>
              </div>
            </div>
            <div className="p-6">{children}</div>
            <div className="px-6 py-4 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                This email was sent by Crowdpen. If you have any questions, reply to this message or contact support.
              </p>
            </div>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
