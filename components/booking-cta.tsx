'use client'

import { useState } from 'react'

export default function BookingCta() {
  const [submitted, setSubmitted] = useState(false)

  return (
    <section id="reservation" className="relative border-t border-border py-28">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-2">
        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.4em] text-primary">
            Réservation
          </p>
          <h2 className="max-w-md font-serif text-4xl font-medium leading-tight text-balance sm:text-5xl">
            Réservez votre fauteuil en ligne
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
            Choisissez votre créneau, nous nous occupons du reste. Confirmation
            immédiate et rappel la veille de votre rendez-vous.
          </p>

          <dl className="mt-12 space-y-6 text-sm">
            <div className="flex gap-6 border-t border-border pt-6">
              <dt className="w-28 shrink-0 uppercase tracking-[0.2em] text-muted-foreground">
                Adresse
              </dt>
              <dd className="text-foreground">
                12 rue des Orfèvres, 75002 Paris
              </dd>
            </div>
            <div className="flex gap-6 border-t border-border pt-6">
              <dt className="w-28 shrink-0 uppercase tracking-[0.2em] text-muted-foreground">
                Horaires
              </dt>
              <dd className="text-foreground">Mar &ndash; Sam · 9h &ndash; 20h</dd>
            </div>
            <div className="flex gap-6 border-t border-border pt-6">
              <dt className="w-28 shrink-0 uppercase tracking-[0.2em] text-muted-foreground">
                Téléphone
              </dt>
              <dd className="text-foreground">01 42 60 00 00</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-border bg-card p-8 sm:p-10">
          {submitted ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center duration-500 animate-in fade-in zoom-in-95">
              <p className="font-serif text-3xl text-primary">Merci !</p>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Votre demande de réservation a bien été enregistrée. Nous vous
                confirmons votre créneau par SMS très prochainement.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-8 text-xs uppercase tracking-[0.2em] text-primary underline-offset-4 hover:underline"
              >
                Nouvelle réservation
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSubmitted(true)
              }}
              className="space-y-6"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Nom" name="name" placeholder="Jean Dupont" />
                <Field
                  label="Téléphone"
                  name="phone"
                  type="tel"
                  placeholder="06 00 00 00 00"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="service"
                    className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Prestation
                  </label>
                  <select
                    id="service"
                    name="service"
                    className="rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  >
                    <option>La Coupe Signature</option>
                    <option>Taille de Barbe</option>
                    <option>Le Rituel Complet</option>
                    <option>Rasage Traditionnel</option>
                  </select>
                </div>
                <Field label="Date souhaitée" name="date" type="date" />
              </div>

              <button
                type="submit"
                className="w-full rounded-sm bg-primary px-6 py-4 text-xs uppercase tracking-[0.3em] text-primary-foreground transition-opacity hover:opacity-90"
              >
                Confirmer la réservation
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Réservation sans engagement · Annulation gratuite 24h avant
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={name}
        className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        placeholder={placeholder}
        className="rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary"
      />
    </div>
  )
}
