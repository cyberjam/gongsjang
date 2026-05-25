import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: "#0a0a0f",        // 화면 배경
          panel: "#15151f",     // 카드/패널
          inset: "#0e0e16",     // 카드 안쪽 inset (stat 등)
          border: "#2a2a3a",    // 1px 보더
          accent: "#ffd23f",    // 금색 — primary
          neon: "#39ff14",      // 네온 그린 — 현재위치 / 새것
          danger: "#ff3864",    // 빨강 — HOT / 경고
          muted: "#888fa0",     // 보조 텍스트
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        // 디스플레이용 비트맵 폰트 (큰 숫자/헤딩/주요 버튼). Latin 전용.
        // 한글은 자동으로 mono로 폴백돼 가독성 유지.
        display: [
          "var(--font-display)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        arcade: "0.18em",         // 일반 캡스 라벨
        "arcade-wide": "0.28em",  // CTA, 헤더
        "arcade-xwide": "0.42em", // 강조 라벨 (STAGE BOSS)
      },
      boxShadow: {
        "arcade-glow-sm":      "0 0 8px rgba(255, 210, 63, 0.25)",
        "arcade-glow":         "0 0 14px rgba(255, 210, 63, 0.4)",
        "arcade-glow-lg":      "0 0 22px rgba(255, 210, 63, 0.55)",
        "arcade-glow-neon":    "0 0 12px rgba(57, 255, 20, 0.4)",
        "arcade-glow-neon-lg": "0 0 18px rgba(57, 255, 20, 0.55)",
        "arcade-glow-danger":  "0 0 12px rgba(255, 56, 100, 0.4)",
        "arcade-card-hover":   "0 0 0 1px rgba(255, 210, 63, 0.08), 0 6px 18px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
