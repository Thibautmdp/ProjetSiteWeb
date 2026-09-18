import Reveal from './reveal'

const services = [
  {
    name: 'La Coupe Signature',
    desc: 'Consultation, coupe aux ciseaux et coiffage sur mesure.',
    price: '55',
    duration: '45 min',
  },
  {
    name: 'Taille de Barbe',
    desc: 'Sculpture à la tondeuse et au rasoir, serviette chaude.',
    price: '35',
    duration: '30 min',
  },
  {
    name: 'Le Rituel Complet',
    desc: 'Coupe, barbe et soin du visage. L\u2019expérience intégrale.',
    price: '85',
    duration: '75 min',
  },
  {
    name: 'Rasage Traditionnel',
    desc: 'Rasage au coupe-chou, huiles chaudes et baume apaisant.',
    price: '45',
    duration: '40 min',
  },
  {
    name: 'Coloration & Camouflage',
    desc: 'Estompage naturel des cheveux blancs, teinte discrète.',
    price: '50',
    duration: '50 min',
  },
  {
    name: 'Coupe Enfant',
    desc: 'Pour les moins de 12 ans, patience et précision.',
    price: '28',
    duration: '30 min',
  },
]

export default function ServicesGrid() {
  return (
    <section id="prestations" className="relative border-t border-border py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.4em] text-primary">
              Nos prestations
            </p>
            <h2 className="max-w-xl font-serif text-4xl font-medium leading-tight text-balance sm:text-5xl">
              Un tarif clair pour chaque geste maîtrisé
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Tous nos soins incluent une boisson d&apos;accueil et un conseil
            personnalisé de nos maîtres barbiers.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => (
            <Reveal
              key={service.name}
              delay={(i % 3) * 80}
              className="group flex flex-col justify-between gap-8 bg-card p-8 hover:bg-secondary"
            >
              <div>
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <h3 className="font-serif text-2xl text-foreground">
                    {service.name}
                  </h3>
                  <span className="shrink-0 font-serif text-2xl text-primary">
                    {service.price}&nbsp;€
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {service.desc}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span>{service.duration}</span>
                <a
                  href="#reservation"
                  className="text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                >
                  Réserver &rarr;
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
