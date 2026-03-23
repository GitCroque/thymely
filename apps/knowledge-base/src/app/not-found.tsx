import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-[2rem] border border-border bg-card p-8 text-center shadow-article">
        <p className="text-sm uppercase tracking-[0.22em] text-inkSoft">
          Knowledge Base
        </p>
        <h1 className="mt-4 font-serif text-4xl text-foreground">
          Article not found
        </h1>
        <p className="mt-4 text-sm leading-6 text-inkSoft">
          The article may be unpublished, moved, or never existed on this public
          surface.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full border border-border bg-white/70 px-4 py-2 text-sm text-foreground transition hover:border-foreground/30"
        >
          Browse all articles
        </Link>
      </div>
    </main>
  );
}
