import SiteHeader from '@/components/site-header'
import Hero from '@/components/hero'
import ServicesGrid from '@/components/services-grid'
import Gallery from '@/components/gallery'
import BookingCta from '@/components/booking-cta'
import SiteFooter from '@/components/site-footer'

export default function Page() {
  return (
    <main id="top" className="relative">
      <SiteHeader />
      <Hero />
      <ServicesGrid />
      <Gallery />
      <BookingCta />
      <SiteFooter />
    </main>
  )
}
