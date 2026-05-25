import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { VT323 } from "next/font/google";
import "./globals.css";

const fontDisplay = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "공스장 — 동네 철봉 도장깨기",
    template: "%s · 공스장",
  },
  description:
    "공스장 — 우리 동네 철봉에서 은둔고수의 기록을 깨라. GPS 기반 현실 도장깨기.",
  applicationName: "공스장",
  openGraph: {
    title: "공스장 — 동네 철봉 도장깨기",
    description: "동네 철봉 위에 새겨진 전설을 깨러 가자.",
    siteName: "공스장",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={fontDisplay.variable}>
      <body className="min-h-screen bg-arcade-bg text-zinc-100">
        <div className="mx-auto flex min-h-screen max-w-md flex-col">
          <header className="sticky top-0 z-20 border-b border-arcade-border bg-arcade-bg/90 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3">
              <Link
                href="/"
                aria-label="공스장 — 동네 철봉 도장깨기"
                className="group inline-flex items-baseline gap-2"
              >
                <span className="arcade-title text-xl font-black text-arcade-accent">
                  공스장
                </span>
                <span className="font-display text-base leading-none tracking-[0.1em] text-zinc-500 group-hover:text-arcade-accent">
                  GONGSJANG
                </span>
              </Link>
              <nav className="flex gap-3 text-xs tracking-arcade">
                <Link href="/" className="hover:text-arcade-accent">지도</Link>
                <Link href="/locations" className="hover:text-arcade-accent">목록</Link>
              </nav>
            </div>
            <div className="border-t border-arcade-border/60 px-4 py-1 text-[9px] tracking-arcade-wide text-zinc-500">
              동네 철봉 도장깨기 · 은둔고수의 기록을 깨라
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-arcade-border px-4 py-4 text-center text-[10px] tracking-arcade text-zinc-500">
            INSERT COIN · 공스장
          </footer>
        </div>
      </body>
    </html>
  );
}
