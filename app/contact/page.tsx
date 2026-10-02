import ContactConcierge from '@/components/contact/ContactConcierge'
import ContactHero from '@/components/contact/ContactHero'
import Footer from '@/components/Footer'
import React from 'react'

const page = () => {
    return (
        <div>
            <ContactHero />
            <ContactConcierge />
            <Footer />
        </div>
    )
}

export default page