import { NextResponse } from "next/server";

function normalizeCurrency(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = normalizeCurrency(searchParams.get("from"));
    const to = normalizeCurrency(searchParams.get("to"));

    if (!from || !to) {
      return NextResponse.json(
        { error: "Invalid currency", from, to },
        { status: 400 }
      );
    }

    if (from === to) {
      return NextResponse.json({ from, to, rate: 1 });
    }

    const upstream = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Failed to fetch exchange rate", from, to },
        { status: 502 }
      );
    }

    const data = await upstream.json().catch(() => null);
    const rateRaw = data?.rates?.[to];
    const rate = rateRaw != null ? Number(rateRaw) : null;

    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: "Rate unavailable", from, to },
        { status: 404 }
      );
    }

    return NextResponse.json({ from, to, rate });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed" },
      { status: 500 }
    );
  }
}
