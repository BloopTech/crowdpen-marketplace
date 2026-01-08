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

export function OrderConfirmationEmail({ customerName, orderNumber, items = [], subtotal = 0, discount = 0, total = 0 }) {
  const currency = (v) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Html>
      <Head />
      <Preview>Order {orderNumber} confirmed</Preview>
      <Tailwind>
        <Body className="bg-white text-black my-0 mx-auto">
          <Container className="mx-auto pt-[20px] pb-[32px] px-[25px] max-w-[560px]">
            <Heading className="text-black text-[22px] font-semibold p-0 my-[10px] mx-0">Thank you for your purchase!</Heading>
            <Text className="text-base">Hi {customerName || "there"},</Text>
            <Text className="text-base">We&apos;re happy to let you know your order <strong>{orderNumber}</strong> is confirmed.</Text>
            <Hr />
            <Text className="font-semibold mt-2">Order summary</Text>
            <table className="w-full text-sm" cellPadding="6">
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="text-left">{it.name} × {it.quantity}</td>
                    <td className="text-right">{currency(it.subtotal || (Number(it.price) * Number(it.quantity)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Hr />
            <table className="w-full text-sm" cellPadding="6">
              <tbody>
                <tr>
                  <td className="text-left">Subtotal</td>
                  <td className="text-right">{currency(subtotal)}</td>
                </tr>
                {Number(discount) > 0 && (
                  <tr>
                    <td className="text-left">Discount</td>
                    <td className="text-right">- {currency(discount)}</td>
                  </tr>
                )}
                <tr>
                  <td className="text-left font-semibold">Total</td>
                  <td className="text-right font-semibold">{currency(total)}</td>
                </tr>
              </tbody>
            </table>
            <Hr />
            <Text className="text-sm text-gray-600">You will receive another email with download links if applicable.</Text>
            <Text className="text-sm text-gray-600">Thanks for shopping at CrowdPen Market.</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
