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

export function SaleNotificationEmail({
  productName = "Product",
  earnedAmount = 0,
  orderNumber = "",
  orderDate = "",
  quantity = 1,
  currencyCode = "NGN",
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

  const dashboardUrl = new URL("/account?tab=sales", origin).toString();
  const productsUrl = new URL("/account?tab=products", origin).toString();
  const salesHistoryUrl = new URL("/account?tab=sales", origin).toString();

  const money = (v) => {
    try {
      const cur = (currencyCode || "NGN").toString().toUpperCase();
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur,
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

  const formattedDate = orderDate
    ? new Date(orderDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });

  return (
    <Html>
      <Head />
      <Preview>You made a sale! {productName}</Preview>
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
          {/* Header - Black bar with logo */}
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

          {/* Main content */}
          <Section style={{ padding: "28px 24px 10px" }}>
            {/* Celebration icon */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td align="center">
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 999,
                        backgroundColor: "#fef3c7",
                        fontSize: 32,
                        lineHeight: "64px",
                        textAlign: "center",
                      }}
                    >
                      🎉
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
              You Made a Sale!
            </Heading>
            <Text
              style={{
                textAlign: "center",
                fontSize: 14,
                color: GREY_TEXT,
                margin: "0 0 24px",
                lineHeight: "20px",
              }}
            >
              Someone just purchased your product
            </Text>

            {/* Product sold card */}
            <div
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: 20,
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: GREY_TEXT,
                  textAlign: "center",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Product Sold
              </Text>
              <Text
                style={{
                  margin: "8px 0 16px",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#111827",
                  textAlign: "center",
                }}
              >
                {productName}
              </Text>

              {/* Earnings circle */}
              <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
                <tbody>
                  <tr>
                    <td align="center">
                      <div
                        style={{
                          display: "inline-block",
                          backgroundColor: "#fef3c7",
                          borderRadius: 999,
                          padding: "16px 32px",
                        }}
                      >
                        <Text
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: GREY_TEXT,
                            textAlign: "center",
                          }}
                        >
                          You Earned
                        </Text>
                        <Text
                          style={{
                            margin: "4px 0 0",
                            fontSize: 28,
                            fontWeight: 800,
                            color: GOLD,
                            textAlign: "center",
                          }}
                        >
                          {money(earnedAmount)}
                        </Text>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Order details */}
            <Hr style={{ borderColor: BORDER, margin: "0 0 16px" }} />

            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 13, color: GREY_TEXT, paddingBottom: 12 }}>
                    Order Number
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600, color: "#111827", textAlign: "right", paddingBottom: 12 }}>
                    {orderNumber}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: 13, color: GREY_TEXT, paddingBottom: 12 }}>
                    Date
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600, color: "#111827", textAlign: "right", paddingBottom: 12 }}>
                    {formattedDate}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: 13, color: GREY_TEXT }}>
                    Quantity
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600, color: "#111827", textAlign: "right" }}>
                    {quantity}
                  </td>
                </tr>
              </tbody>
            </table>

            <Hr style={{ borderColor: BORDER, margin: "16px 0 24px" }} />

            {/* CTA Button */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td align="center">
                    <Button
                      href={dashboardUrl}
                      style={{
                        backgroundColor: GOLD,
                        color: BLACK,
                        padding: "14px 28px",
                        borderRadius: 999,
                        fontSize: 14,
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-block",
                      }}
                    >
                      View Sale Details
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
                margin: "14px 0 0",
              }}
            >
              Check your dashboard for full details and analytics
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: BLACK, padding: "18px 24px", marginTop: 24 }}>
            <Text style={{ margin: 0, fontSize: 13, color: WHITE, textAlign: "center", fontWeight: 600 }}>
              Keep up the great work!
            </Text>
            <Text style={{ margin: "12px 0 0", fontSize: 12, textAlign: "center" }}>
              <Link href={dashboardUrl} style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>
                My Dashboard
              </Link>
              <span style={{ color: "#9ca3af", padding: "0 10px" }}>|</span>
              <Link href={productsUrl} style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>
                My Products
              </Link>
              <span style={{ color: "#9ca3af", padding: "0 10px" }}>|</span>
              <Link href={salesHistoryUrl} style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>
                Sales History
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
      </Body>
    </Html>
  );
}
