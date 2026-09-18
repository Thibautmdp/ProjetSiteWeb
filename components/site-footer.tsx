export default function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <p className="font-serif text-base tracking-[0.25em] text-foreground">
          MAISON&nbsp;LAME
        </p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          © {new Date().getFullYear()} — Barbier &amp; Coiffeur d&apos;exception
        </p>
        <div className="flex gap-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <a href="#" className="transition-colors hover:text-foreground">
            Instagram
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Mentions
          </a>
        </div>
      </div>
    </footer>
  )
}
