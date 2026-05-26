import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="arcade-title font-display text-6xl leading-none text-arcade-amber">
        GAME OVER
      </div>
      <p className="mt-3 text-sm text-arcade-muted">이 도장은 존재하지 않습니다</p>
      <Link
        href="/"
        className="arcade-btn-primary mt-6 px-4 py-2 text-xs tracking-arcade"
      >
        ▸ CONTINUE
      </Link>
    </div>
  );
}
