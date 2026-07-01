import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiat: "ARS",
          page: 1,
          rows: 10,
          tradeType: "SELL",
          asset: "USDT",
          countries: [],
          additionalKycVerifyFilter: 0,
          classifies: ["mass", "profession", "fiat_trade"],
          filterType: "all",
          followed: false,
          payTypes: [],
          periods: [],
          proMerchantAds: false,
          publisherType: "merchant",
          shieldMerchantAds: false,
          tradedWith: false,
        }),
        next: { revalidate: 300 },
      }
    );
    const data = await res.json();

    const ad = (data?.data ?? []).find(
      (item: { adv: { price: string }; privilegeDesc: string | null }) =>
        !item.privilegeDesc
    );

    const price = parseFloat(ad?.adv?.price ?? "0");
    if (!price) return NextResponse.json({ error: "No hay datos disponibles" }, { status: 502 });
    return NextResponse.json({ price, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "No se pudo obtener la cotización" }, { status: 502 });
  }
}
