import React from "react";
import { Html } from "@react-email/html";
import { Head } from "@react-email/head";
import { Preview } from "@react-email/preview";
import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Img } from "@react-email/img";

export default function EmailLayout({ preview, children }) {
  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body style={{ backgroundColor: "#f6f9fc", margin: 0, padding: 0 }}>
        <Container
          style={{
            width: 600,
            margin: "24px auto",
            backgroundColor: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            padding: 0,
          }}
        >
          <div style={{ padding: 24, borderBottom: "1px solid #e2e8f0" }}>
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ width: 32, verticalAlign: "middle" }}>
                    <Img
                      src="https://crowdpen.site/crowdpen_icon_logo.png"
                      width="32"
                      height="32"
                      alt="Crowdpen"
                      style={{ borderRadius: 6 }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle", paddingLeft: 12 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: "#0f172a" }}>
                      Crowdpen
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ padding: 24 }}>{children}</div>
          <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: "16px" }}>
              This email was sent by Crowdpen. If you have any questions, reply to this message or contact support.
            </p>
          </div>
        </Container>
      </Body>
    </Html>
  );
}
