'use client'

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a
          href="#top"
          className="font-serif text-lg font-semibold tracking-[0.25em] text-foreground"
        >
          MAISON&nbsp;LAME
        </a>

        <nav className="hidden items-center gap-10 text-xs uppercase tracking-[0.25em] text-muted-foreground md:flex">
          <a href="#prestations" className="transition-colors hover:text-foreground">
            Prestations
          </a>
          <a href="#galerie" className="transition-colors hover:text-foreground">
            Galerie
          </a>
          <a href="#reservation" className="transition-colors hover:text-foreground">
            Contact
          </a>
        </nav>

        <a
          href="#reservation"
          className="rounded-sm border border-primary/60 px-5 py-2 text-xs uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Réserver
        </a>
      </div>
    </header>
  )
}
