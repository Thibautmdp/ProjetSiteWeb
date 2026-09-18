import Image from 'next/image'
import Reveal from './reveal'

const cuts = [
  { src: '/gallery/cut-1.png', title: 'Le Fade Moderne', tag: 'Dégradé' },
  { src: '/gallery/cut-2.png', title: 'Pompadour Classique', tag: 'Signature' },
  { src: '/gallery/cut-3.png', title: 'Crew Cut Net', tag: 'Précision' },
  { src: '/gallery/cut-4.png', title: 'Texture Naturelle', tag: 'Coiffage' },
]

export default function Gallery() {
  return (
    <section id="galerie" className="relative border-t border-border py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.4em] text-primary">
            Le portfolio
          </p>
          <h2 className="mx-auto max-w-2xl font-serif text-4xl font-medium leading-tight text-balance sm:text-5xl">
            Des coupes pensées comme des œuvres
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cuts.map((cut, i) => (
            <Reveal
              key={cut.title}
              delay={i * 100}
              className="group relative aspect-[3/4] overflow-hidden rounded-md border border-border"
            >
              <Image
                src={cut.src || '/placeholder.svg'}
                alt={`Coupe : ${cut.title}`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover grayscale transition-all duration-700 ease-out group-hover:scale-110 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-95" />
              <div className="absolute inset-x-0 bottom-0 translate-y-2 p-5 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                <span className="text-[0.65rem] uppercase tracking-[0.3em] text-primary">
                  {cut.tag}
                </span>
                <p className="mt-1 font-serif text-xl text-foreground">
                  {cut.title}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
