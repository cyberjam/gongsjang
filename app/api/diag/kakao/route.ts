import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function probe(referer?: string) {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  const url = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  };
  if (referer) headers["Referer"] = referer;

  try {
    const res = await fetch(url, { headers, redirect: "follow" });
    const text = await res.text();
    return {
      referer: referer ?? "(none)",
      status: res.status,
      ok: res.ok,
      length: text.length,
      preview: text.slice(0, 300),
    };
  } catch (e: any) {
    return {
      referer: referer ?? "(none)",
      error: e?.message ?? String(e),
    };
  }
}

export async function GET(req: Request) {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  const masked =
    key.length > 8
      ? `${key.slice(0, 4)}…${key.slice(-4)} (len=${key.length})`
      : `(short or empty: "${key}")`;

  const origin = new URL(req.url).origin;

  const results = await Promise.all([
    probe(),
    probe(origin + "/"),
    probe("https://gongsjang.vercel.app/"),
    probe("http://localhost:3000/"),
  ]);

  return NextResponse.json(
    {
      env: {
        NEXT_PUBLIC_KAKAO_MAP_KEY_present: !!key,
        NEXT_PUBLIC_KAKAO_MAP_KEY_masked: masked,
        request_origin: origin,
      },
      probes: results,
      hint:
        "ok=true 인 referer가 하나라도 있으면 그 도메인은 등록됨. " +
        "전부 401/403이면 키가 잘못됐거나 카카오에서 도메인 등록이 실제로 저장 안 됨.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
