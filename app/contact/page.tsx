import ContactConcierge from '@/components/contact/ContactConcierge'
import ContactDetails from '@/components/contact/ContactDetails'
import ContactHero from '@/components/contact/ContactHero'
import Footer from '@/components/Footer'
import { getContactPageContent } from '@/lib/data/contact-info'

// Rendered per request: the content is edited from the dashboard and must never
// be baked in at build time (the build also doesn't need a database this way).
export const dynamic = 'force-dynamic'

const page = async () => {
    const { info, hours, faqs } = await getContactPageContent()

    return (
        <div>
            <ContactHero info={info} />
            <ContactDetails info={info} hours={hours} />
            <ContactConcierge info={info} faqs={faqs} />
            <Footer />
        </div>
    )
}

export default page
