import { NextResponse } from "next/server";

function readCountryHeader(headers) {
  try {
    const vercel = headers.get("x-vercel-ip-country");
    const cf = headers.get("cf-ipcountry");
    const generic = headers.get("x-country-code");
    const code = (vercel || cf || generic || "").toUpperCase();
    return code || null;
  } catch {
    return null;
  }
}

function deriveCurrencyByCountry(countryCode) {
  const c = (countryCode || "").toUpperCase();

  const euroCountries = new Set([
    "AT",
    "BE",
    "CY",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PT",
    "SK",
    "SI",
    "ES",
  ]);
  if (euroCountries.has(c)) return "EUR";

  const map = {
    US: "USD",
    GB: "GBP",
    CA: "CAD",
    AU: "AUD",
    NZ: "NZD",
    CH: "CHF",
    SE: "SEK",
    NO: "NOK",
    DK: "DKK",
    PL: "PLN",
    CZ: "CZK",
    HU: "HUF",
    RO: "RON",
    BG: "BGN",

    NG: "NGN",
    GH: "GHS",
    ZA: "ZAR",
    KE: "KES",
    UG: "UGX",
    RW: "RWF",
    TZ: "TZS",
    ZM: "ZMW",

    CI: "XOF",
    BJ: "XOF",
    TG: "XOF",
    SN: "XOF",
    ML: "XOF",
    BF: "XOF",

    JP: "JPY",
    CN: "CNY",
    IN: "INR",
    SG: "SGD",
    HK: "HKD",
    KR: "KRW",

    BR: "BRL",
    MX: "MXN",

    EG: "EGP",
    MA: "MAD",
  };

  return map[c] || "USD";
}

export async function GET(request) {
  try {
    const country = readCountryHeader(request.headers) || "US";
    const currency = deriveCurrencyByCountry(country);
    return NextResponse.json({ country, currency });
  } catch (error) {
    return NextResponse.json(
      { country: null, currency: "USD", error: error?.message || "Failed" },
      { status: 200 }
    );
  }
}
