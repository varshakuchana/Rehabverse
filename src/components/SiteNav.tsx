import Link from "next/link";

/* Small top navigation shared by the island pages. */
export default function SiteNav({ current }: { current?: "home" | "quest" | "hep" | "explore" | "progress" | "story" }) {
  const link = (href: string, label: string, key: typeof current) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`rounded-full px-4 py-2 text-[15px] transition ${current === key ? "bg-white/15 font-semibold" : "opacity-80 hover:bg-white/10 hover:opacity-100"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Main" className="relative z-20 flex flex-wrap items-center justify-between gap-3 mb-8">
      <Link href="/" className="font-display text-xl font-extrabold tracking-tight">RehabVerse</Link>
      <div className="rv-glass flex flex-wrap gap-1 rounded-full p-1">
        {link("/", "Home", "home")}
        {link("/quest", "My Quest", "quest")}
        {link("/hep", "My HEP", "hep")}
        {link("/explore", "Explore", "explore")}
        {link("/story", "Story Mode", "story")}
        {link("/progress", "Progress", "progress")}
      </div>
    </nav>
  );
}
