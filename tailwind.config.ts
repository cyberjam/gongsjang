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
          bg: "#050507",          // 더 깊은 검정 (CRT 끄진 화면)
          panel: "#0f1112",       // 패널
          inset: "#0a0c0d",       // 패널 안쪽
          border: "#1f2a23",      // 보더 (살짝 녹색 톤)

          // 형광 그린 — UI 베이스
          phosphor: "#39ff14",    // 가장 밝은 인광 (라벨, 활성 강조)
          phosphor2: "#5dd472",   // 중간 밝기 (h1, 본문 강조)
          phosphor3: "#3d7f47",   // 어두운 (보더 강조, 비활성 텍스트)

          // 앰버 — 마스터·점수 전용
          amber: "#ffb000",       // 메인 앰버 (마스터 점수, ★ 고수)
          amber2: "#ff8a00",      // 더 진한 (강조, 위험)

          // 레거시 — 기존 컴포넌트 호환용 (사용 자제)
          accent: "#ffd23f",      // 구 골드 → 앰버로 점진 교체
          neon: "#39ff14",        // = phosphor (호환)
          danger: "#cf3838",      // 더 어둡게 (네온 핑크 X)
          muted: "#5a6b60",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: [
          "var(--font-display)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        arcade: "0.18em",
        "arcade-wide": "0.28em",
        "arcade-xwide": "0.42em",
      },
      boxShadow: {
        // 매우 약한 glow만 유지 — CRT phosphor 잔상 정도
        "phosphor-sm":   "0 0 4px rgba(57, 255, 20, 0.25)",
        "phosphor":      "0 0 8px rgba(57, 255, 20, 0.35)",
        "amber-sm":      "0 0 4px rgba(255, 176, 0, 0.3)",
        "amber":         "0 0 10px rgba(255, 176, 0, 0.4)",

        // 레거시 alias (점진 제거)
        "arcade-glow-sm":      "0 0 4px rgba(255, 176, 0, 0.25)",
        "arcade-glow":         "0 0 8px rgba(255, 176, 0, 0.35)",
        "arcade-glow-lg":      "0 0 12px rgba(255, 176, 0, 0.45)",
        "arcade-glow-neon":    "0 0 8px rgba(57, 255, 20, 0.35)",
        "arcade-glow-neon-lg": "0 0 12px rgba(57, 255, 20, 0.45)",
        "arcade-glow-danger":  "0 0 8px rgba(207, 56, 56, 0.35)",
        "arcade-card-hover":   "0 0 0 1px rgba(57, 255, 20, 0.08), 0 4px 12px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
