import React from "react";
import { Html } from "@react-email/html";
import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Preview } from "@react-email/preview";
import { Text } from "@react-email/text";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Section } from "@react-email/section";
import { Link } from "@react-email/link";
import { Button } from "@react-email/button";
import { Img } from "@react-email/img";

export function OrderConfirmationEmail({
  customerName,
  orderNumber,
  items = [],
  subtotal = 0,
  discount = 0,
  total = 0,
  currencyCode = "USD",
}) {
  const GOLD = "#d3a155";
  const BLACK = "#000000";
  const WHITE = "#ffffff";
  const GREY_BG = "#f3f4f6";
  const GREY_TEXT = "#6b7280";
  const BORDER = "#e5e7eb";

  const origin =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const purchasesUrl = new URL("/account?tab=purchases", origin).toString();
  const helpUrl = new URL("/help", origin).toString();

  const supportEmail =
    process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || "support@crowdpen.co";
  const supportMailto = `mailto:${supportEmail}`;

  const money = (v) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (currencyCode || "USD").toString().toUpperCase(),
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(v || 0));
    } catch {
      return `${Number(v || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${(currencyCode || "USD").toString().toUpperCase()}`;
    }
  };

  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Html>
      <Head />
      <Preview>Order {orderNumber} confirmed</Preview>
      <Body style={{ backgroundColor: GREY_BG, margin: 0, padding: 0 }}>
        <Container
          style={{
            width: 560,
            margin: "24px auto",
            backgroundColor: WHITE,
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            padding: 0,
          }}
        >
          <Section style={{ backgroundColor: BLACK, padding: "22px 24px" }}>
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td align="center">
                    <div
                      style={{
                        display: "inline-block",
                        padding: "10px 16px",
                        borderRadius: 8,
                        backgroundColor: "#1f1f1f",
                      }}
                    >
                      <Img
                        src="https://crowdpen.site/crowdpen_icon_logo.png"
                        width="20"
                        height="20"
                        alt="Crowdpen"
                        style={{
                          verticalAlign: "middle",
                          borderRadius: 4,
                          marginRight: 8,
                          display: "inline-block",
                        }}
                      />
                      <span
                        style={{
                          verticalAlign: "middle",
                          fontSize: 14,
                          fontWeight: 700,
                          letterSpacing: 0.3,
                          color: GOLD,
                        }}
                      >
                        CrowdPen
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ padding: "28px 24px 10px" }}>
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td align="center">
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 999,
                        backgroundColor: GOLD,
                        color: WHITE,
                        fontSize: 30,
                        fontWeight: 800,
                        lineHeight: "56px",
                        textAlign: "center",
                      }}
                    >
                      ✓
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <Heading
              style={{
                textAlign: "center",
                fontSize: 28,
                fontWeight: 800,
                color: "#111827",
                margin: "16px 0 6px",
                padding: 0,
              }}
            >
              You&apos;re All Set!
            </Heading>
            <Text
              style={{
                textAlign: "center",
                fontSize: 14,
                color: GREY_TEXT,
                margin: "0 0 18px",
                lineHeight: "20px",
              }}
            >
              Your purchase is ready to download right now
            </Text>

            <div
              style={{
                backgroundColor: GREY_BG,
                borderRadius: 10,
                padding: 16,
                borderLeft: `4px solid ${GOLD}`,
                marginBottom: 18,
              }}
            >
              <Text style={{ margin: 0, fontSize: 12, color: GREY_TEXT }}>
                Your Order Number
              </Text>
              <Text style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 700, color: "#111827" }}>
                {orderNumber}
              </Text>
            </div>

            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td align="center">
                    <Button
                      href={purchasesUrl}
                      style={{
                        backgroundColor: GOLD,
                        color: BLACK,
                        padding: "12px 18px",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-block",
                      }}
                    >
                      Download My Product
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>

            <Text
              style={{
                textAlign: "center",
                fontSize: 12,
                color: GREY_TEXT,
                margin: "12px 0 0",
              }}
            >
              Click the button above or go to your Purchases page
            </Text>
          </Section>

          <Section style={{ padding: "0 24px 18px" }}>
            <Heading
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#111827",
                margin: "16px 0 10px",
                padding: 0,
              }}
            >
              What You Bought
            </Heading>

            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
              {safeItems.map((it, idx) => {
                const amount = it?.subtotal != null ? it.subtotal : Number(it?.price || 0) * Number(it?.quantity || 0);
                return (
                  <div
                    key={idx}
                    style={{
                      padding: 16,
                      borderTop: idx === 0 ? "none" : `1px solid ${BORDER}`,
                    }}
                  >
                    <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
                      <tbody>
                        <tr>
                          <td style={{ verticalAlign: "top" }}>
                            <Text style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#111827" }}>
                              {it?.name || "Product"}
                            </Text>
                            <Text style={{ margin: "6px 0 0", fontSize: 12, color: GREY_TEXT }}>
                              Digital Download
                            </Text>
                            <Text style={{ margin: "6px 0 0", fontSize: 12, color: GREY_TEXT }}>
                              From:{" "}
                              <span style={{ color: GOLD, fontWeight: 700 }}>
                                {it?.vendor || "Crowdpen Marketplace"}
                              </span>
                            </Text>
                          </td>
                          <td style={{ verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap" }}>
                            <Text style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#111827" }}>
                              {money(amount)}
                            </Text>
                            <Text style={{ margin: "6px 0 0", fontSize: 12, color: GREY_TEXT }}>
                              Qty: {Number(it?.quantity || 0) || 1}
                            </Text>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            <Hr style={{ borderColor: BORDER, margin: "18px 0" }} />

            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 13, color: GREY_TEXT }}>Subtotal</td>
                  <td style={{ fontSize: 13, color: GREY_TEXT, textAlign: "right" }}>
                    {money(subtotal)}
                  </td>
                </tr>
                {Number(discount) > 0 ? (
                  <tr>
                    <td style={{ fontSize: 13, color: GREY_TEXT, paddingTop: 8 }}>Discount</td>
                    <td style={{ fontSize: 13, color: GREY_TEXT, textAlign: "right", paddingTop: 8 }}>
                      - {money(discount)}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td style={{ fontSize: 14, fontWeight: 800, color: "#111827", paddingTop: 10 }}>
                    Total Paid
                  </td>
                  <td style={{ fontSize: 14, fontWeight: 800, color: "#111827", textAlign: "right", paddingTop: 10 }}>
                    {money(total)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div
              style={{
                backgroundColor: "#fff7ed",
                borderLeft: `4px solid ${GOLD}`,
                borderRadius: 10,
                padding: 16,
                marginTop: 18,
              }}
            >
              <Text style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#111827" }}>
                How to Get Your Product
              </Text>
              <Text style={{ margin: "8px 0 0", fontSize: 12, color: "#374151", lineHeight: "18px" }}>
                Your product is waiting for you! Just head to the{' '}
                <Link href={purchasesUrl} style={{ color: "#111827", fontWeight: 800, textDecoration: "none" }}>
                  Purchases
                </Link>{' '}
                section in your CrowdPen marketplace account. You can download it anytime you want - no time limit!
              </Text>
            </div>
          </Section>

          <Section style={{ padding: "0 24px 22px" }}>
            <Heading
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "#111827",
                margin: "6px 0 10px",
                padding: 0,
              }}
            >
              Need a Hand?
            </Heading>

            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ width: "50%", verticalAlign: "top", paddingRight: 10 }}>
                    <Text style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#111827" }}>
                      Questions about your product?
                    </Text>
                    <Link
                      href={purchasesUrl}
                      style={{
                        fontSize: 12,
                        color: GOLD,
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-block",
                        marginTop: 6,
                      }}
                    >
                      Message the seller
                    </Link>
                  </td>
                  <td style={{ width: "50%", verticalAlign: "top", paddingLeft: 10 }}>
                    <Text style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#111827" }}>
                      Problems with your order?
                    </Text>
                    <Link
                      href={supportMailto}
                      style={{
                        fontSize: 12,
                        color: GOLD,
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-block",
                        marginTop: 6,
                      }}
                    >
                      {supportEmail}
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ backgroundColor: BLACK, padding: "18px 24px" }}>
            <Text style={{ margin: 0, fontSize: 12, color: WHITE, textAlign: "center" }}>
              Thanks for shopping with us!
            </Text>
            <Text style={{ margin: "10px 0 0", fontSize: 12, textAlign: "center" }}>
              <Link href={purchasesUrl} style={{ color: GOLD, textDecoration: "none", fontWeight: 700 }}>
                View Order
              </Link>
              <span style={{ color: "#9ca3af", padding: "0 10px" }}>|</span>
              <Link href={purchasesUrl} style={{ color: GOLD, textDecoration: "none", fontWeight: 700 }}>
                My Purchases
              </Link>
              <span style={{ color: "#9ca3af", padding: "0 10px" }}>|</span>
              <Link href={helpUrl} style={{ color: GOLD, textDecoration: "none", fontWeight: 700 }}>
                Get Help
              </Link>
            </Text>
            <Text
              style={{
                margin: "12px 0 0",
                fontSize: 11,
                color: "#9ca3af",
                textAlign: "center",
              }}
            >
              CrowdPen Marketplace
            </Text>
          </Section>
        </Container>

        <Text style={{ margin: "18px 0 0", fontSize: 12, color: GREY_TEXT, textAlign: "center" }}>
          Hi {customerName || "there"}, if you didn&apos;t make this purchase, please contact support.
        </Text>
      </Body>
    </Html>
  );
}
