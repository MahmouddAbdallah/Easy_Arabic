import About from '@/components/landing/About'
import CTA from '@/components/landing/Cta'
import Features from '@/components/landing/Features'
import Footer from '@/components/Footer'
import ForRoleSection from '@/components/landing/ForRole'
import HeroSection from '@/components/landing/Hero'
import { authorization } from '@/lib/verifyAuth'

const page = async () => {
  const { user } = await authorization();
  if (user) {
    return (
      <div>
        login
      </div>
    )
  }
  return (
    <div>
      <HeroSection />
      <About />
      <Features />
      <ForRoleSection />
      <CTA />
      <Footer />
    </div>
  )
}

export default page