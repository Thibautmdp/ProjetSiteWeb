'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const HeroCanvas = dynamic(() => import('./hero-canvas'), { ssr: false })

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export default function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null)
  // shared, mutable scroll progress read inside the 3D render loop (no re-render)
  const progress = useRef(0)
  const [p, setP] = useState(0)

  useEffect(() => {
    let raf = 0
    const update = () => {
      const el = sectionRef.current
      if (!el) return
      const total = el.offsetHeight - window.innerHeight
      const scrolled = Math.min(Math.max(-el.getBoundingClientRect().top, 0), total)
      const value = total > 0 ? scrolled / total : 0
      progress.current = value
      setP(value)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const introOpacity = clamp01(1 - p / 0.28)
  const outroOpacity = clamp01((p - 0.55) / 0.3)
  const hintOpacity = clamp01(1 - p / 0.12)

  return (
    <section ref={sectionRef} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* radial glow behind the object */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.79 0.1 82 / 0.35), transparent 65%)',
          }}
        />

        <div className="absolute inset-0">
          <HeroCanvas progress={progress} />
        </div>

        {/* Intro copy */}
        <div
          style={{
            opacity: introOpacity,
            transform: `translateY(${(1 - introOpacity) * -40}px)`,
          }}
          className="pointer-events-none relative z-10 px-6 text-center"
        >
          <p className="mb-6 text-xs uppercase tracking-[0.5em] text-primary">
            Barbier &middot; Coiffeur &middot; Depuis 1998
          </p>
          <h1 className="font-serif text-6xl font-medium leading-[0.95] text-balance sm:text-7xl md:text-8xl lg:text-[7.5rem]">
            L&apos;art de
            <br />
            <span className="italic text-primary">la lame</span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Une maison dédiée à la précision du geste et à l&apos;élégance
            intemporelle. Chaque coupe, une signature.
          </p>
        </div>

        {/* Outro copy revealed as the object grows */}
        <div
          style={{ opacity: outroOpacity }}
          className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 px-6 text-center"
        >
          <p className="font-serif text-2xl italic text-foreground/90 sm:text-3xl">
            « La précision est notre matière première. »
          </p>
        </div>

        {/* Scroll hint */}
        <div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground"
        >
          Défilez
        </div>
      </div>
    </section>
  )
}
