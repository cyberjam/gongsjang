import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "공스장 - 동네 철봉 랭킹",
  description: "GPS로 찾는 우리 동네 철봉. 은둔고수의 기록을 깨라.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-arcade-bg text-zinc-100">
        <div className="mx-auto flex min-h-screen max-w-md flex-col">
          <header className="sticky top-0 z-20 border-b border-arcade-border bg-arcade-bg/90 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/" className="arcade-title text-lg font-bold text-arcade-accent">
                공스장 GONG-JANG
              </Link>
              <nav className="flex gap-3 text-xs">
                <Link href="/" className="hover:text-arcade-accent">지도</Link>
                <Link href="/locations" className="hover:text-arcade-accent">목록</Link>
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-arcade-border px-4 py-4 text-center text-[10px] text-zinc-500">
            INSERT COIN · 동네 은둔고수의 기록을 깨라
          </footer>
        </div>
      </body>
    </html>
  );
}
