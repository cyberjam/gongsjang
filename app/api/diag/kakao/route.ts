export const dynamic = "force-dynamic";

async function probe(referer: string | undefined, key: string) {
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
      preview: text.slice(0, 200),
    };
  } catch (e: any) {
    return {
      referer: referer ?? "(none)",
      error: e?.message ?? String(e),
    };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: Request) {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  const masked =
    key.length > 8
      ? `${key.slice(0, 4)}…${key.slice(-4)} (len=${key.length})`
      : `(short/empty: "${key}")`;

  const origin = new URL(req.url).origin;

  const probes = await Promise.all([
    probe(undefined, key),
    probe(origin + "/", key),
    probe("https://gongsjang.vercel.app/", key),
    probe("http://localhost:3000/", key),
  ]);

  const anyOk = probes.some((p) => "ok" in p && p.ok);
  const verdict = !key
    ? "❌ 환경변수가 비어있음. Vercel에서 NEXT_PUBLIC_KAKAO_MAP_KEY 설정 후 재배포 필요."
    : anyOk
      ? "✅ 키는 살아있고 일부 도메인에서 응답 받음. 아래 표에서 어떤 Referer가 OK인지 확인."
      : "❌ 모든 호출이 거부됨. 키가 잘못됐거나 Kakao 측 도메인 등록이 실제로 저장 안 됐을 가능성.";

  const rows = probes
    .map((p) => {
      const status =
        "status" in p
          ? `<span style="color:${p.ok ? "#39ff14" : "#ff3864"}">${p.status} ${p.ok ? "OK" : "거부"}</span>`
          : `<span style="color:#ff3864">ERROR: ${escapeHtml(p.error ?? "")}</span>`;
      const preview =
        "preview" in p ? escapeHtml((p.preview ?? "").slice(0, 120)) : "";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #2a2a3a;word-break:break-all">${escapeHtml(p.referer)}</td>
        <td style="padding:8px;border-bottom:1px solid #2a2a3a;white-space:nowrap">${status}</td>
        <td style="padding:8px;border-bottom:1px solid #2a2a3a;font-size:10px;color:#888;word-break:break-all">${preview}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Kakao 진단</title>
<style>
  body{background:#0a0a0f;color:#f4f4f5;font-family:ui-monospace,monospace;padding:16px;margin:0;font-size:14px;line-height:1.5}
  h1{color:#ffd23f;font-size:18px;margin:0 0 12px}
  .panel{background:#15151f;border:1px solid #2a2a3a;border-radius:8px;padding:12px;margin-bottom:12px}
  .k{color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .v{color:#f4f4f5;word-break:break-all;font-size:13px;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:8px;border-bottom:2px solid #2a2a3a;color:#888;font-size:11px;text-transform:uppercase}
  td{vertical-align:top}
  .verdict{padding:12px;border-radius:8px;font-weight:bold;margin-bottom:12px}
  .ok{background:rgba(57,255,20,.1);border:1px solid #39ff14;color:#39ff14}
  .bad{background:rgba(255,56,100,.1);border:1px solid #ff3864;color:#ff3864}
</style>
</head>
<body>
<h1>공스장 / Kakao SDK 진단</h1>

<div class="verdict ${anyOk ? "ok" : "bad"}">${escapeHtml(verdict)}</div>

<div class="panel">
  <div class="k">NEXT_PUBLIC_KAKAO_MAP_KEY</div>
  <div class="v">${escapeHtml(masked)}</div>
</div>

<div class="panel">
  <div class="k">서버 origin</div>
  <div class="v">${escapeHtml(origin)}</div>
  <div class="k" style="margin-top:8px">실제 브라우저 origin (이 페이지를 연 주소창)</div>
  <div class="v">↓ 자바스크립트로 표시 ↓</div>
  <div class="v" id="origin" style="color:#ffd23f"></div>
</div>

<table>
  <tr><th>Referer로 보낸 값</th><th>응답</th><th>본문 일부</th></tr>
  ${rows}
</table>

<div class="panel" style="margin-top:12px;font-size:11px;color:#888">
  <b style="color:#ffd23f">읽는 법</b><br/>
  ① Referer=<code>https://gongsjang.vercel.app/</code> 행이 <b style="color:#39ff14">200 OK</b>이면 Kakao 등록 OK. 이 경우 코드 쪽 문제.<br/>
  ② 그 행이 <b style="color:#ff3864">401/403</b>이면 Kakao 도메인 화이트리스트에 실제로 저장 안 됨. Kakao Developers에서 다시 등록 + 저장 버튼.<br/>
  ③ 모든 행이 401 → 키 자체가 무효. 재발급 필요.
</div>

<script>
  document.getElementById('origin').textContent = window.location.origin;
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
