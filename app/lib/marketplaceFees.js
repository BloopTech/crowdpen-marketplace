function parsePct(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/%/g, ""));
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function fallbackFromEnv({ defaultCrowdpenPct, defaultStartbuttonPct }) {
  const crowdpenPct = parsePct(
    process.env.CROWDPEN_FEE_PCT ||
      process.env.CROWD_PEN_FEE_PCT ||
      process.env.PLATFORM_FEE_PCT ||
      defaultCrowdpenPct
  );
  const startbuttonPct = parsePct(
    process.env.STARTBUTTON_FEE_PCT ||
      process.env.START_BUTTON_FEE_PCT ||
      process.env.GATEWAY_FEE_PCT ||
      defaultStartbuttonPct
  );

  return {
    crowdpenPct: clampPct(crowdpenPct),
    startbuttonPct: clampPct(startbuttonPct),
  };
}

export async function getMarketplaceFeePercents({
  db,
  defaultCrowdpenPct = 0.15,
  defaultStartbuttonPct = 0.05,
} = {}) {
  const fallback = fallbackFromEnv({ defaultCrowdpenPct, defaultStartbuttonPct });

  if (!db?.MarketplaceFeeSettings) return fallback;

  try {
    const row = await db.MarketplaceFeeSettings.findOne({
      where: { is_active: true },
      order: [["createdAt", "DESC"]],
      attributes: ["crowdpen_fee_pct", "startbutton_fee_pct"],
    });

    const crowdpenPct = row?.crowdpen_fee_pct != null ? Number(row.crowdpen_fee_pct) : null;
    const startbuttonPct = row?.startbutton_fee_pct != null ? Number(row.startbutton_fee_pct) : null;

    if (Number.isFinite(crowdpenPct) && Number.isFinite(startbuttonPct)) {
      return {
        crowdpenPct: clampPct(crowdpenPct),
        startbuttonPct: clampPct(startbuttonPct),
      };
    }

    return fallback;
  } catch (e) {
    const code = e?.original?.code || e?.code;
    if (code === "42P01") return fallback;
    return fallback;
  }
}

export function normalizeFeePctInput(v) {
  return clampPct(parsePct(v));
}
