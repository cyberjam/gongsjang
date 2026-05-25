import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="arcade-title font-display text-6xl leading-none text-arcade-accent">
        GAME OVER
      </div>
      <p className="mt-2 text-sm text-zinc-400">찾는 페이지가 없어요.</p>
      <Link
        href="/"
        className="mt-6 rounded border border-arcade-accent px-4 py-2 text-xs text-arcade-accent hover:bg-arcade-accent hover:text-arcade-bg"
      >
        ▶ CONTINUE
      </Link>
    </div>
  );
}
