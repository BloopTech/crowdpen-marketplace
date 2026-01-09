import React from "react";
import { Html } from "@react-email/html";
import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Preview } from "@react-email/preview";
import { Text } from "@react-email/text";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Tailwind } from "@react-email/tailwind";

export function PayoutReceiptEmail({
  merchantName,
  merchantEmail,
  payoutId,
  amount,
  currency,
  paidAt,
  settlementFrom,
  settlementTo,
  reference,
}) {
  const fmtMoney = (v) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(v || 0));
    } catch {
      return `${Number(v || 0).toFixed(2)} ${currency || "USD"}`;
    }
  };

  const settledWindow = settlementFrom && settlementTo
    ? `${settlementFrom} → ${settlementTo}`
    : null;

  return (
    <Html>
      <Head />
      <Preview>Payout receipt {payoutId ? `(${payoutId})` : ""}</Preview>
      <Tailwind>
        <Body className="bg-white text-black my-0 mx-auto">
          <Container className="mx-auto pt-[20px] pb-[32px] px-[25px] max-w-[560px]">
            <Heading className="text-black text-[22px] font-semibold p-0 my-[10px] mx-0">
              Payout Receipt
            </Heading>

            <Text className="text-base">
              Hi {merchantName || merchantEmail || "there"},
            </Text>
            <Text className="text-base">
              This is a confirmation that Crowdpen has issued a payout to you.
            </Text>

            <Hr />

            <Text className="font-semibold mt-2">Payout details</Text>
            <table className="w-full text-sm" cellPadding="6">
              <tbody>
                <tr>
                  <td className="text-left">Payout amount</td>
                  <td className="text-right font-semibold">{fmtMoney(amount)}</td>
                </tr>
                {paidAt ? (
                  <tr>
                    <td className="text-left">Paid at (UTC)</td>
                    <td className="text-right">{paidAt}</td>
                  </tr>
                ) : null}
                {settledWindow ? (
                  <tr>
                    <td className="text-left">Settlement window</td>
                    <td className="text-right">{settledWindow}</td>
                  </tr>
                ) : null}
                {reference ? (
                  <tr>
                    <td className="text-left">Reference</td>
                    <td className="text-right">{reference}</td>
                  </tr>
                ) : null}
                {payoutId ? (
                  <tr>
                    <td className="text-left">Receipt / Payout ID</td>
                    <td className="text-right">{payoutId}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <Hr />

            <Text className="text-sm text-gray-600">
              Keep this email for your records. If you believe this payout is incorrect, please reply to this email.
            </Text>
            <Text className="text-sm text-gray-600">
              This receipt is not a tax document.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
