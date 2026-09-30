import About from '@/components/landing/About'
import CTA from '@/components/landing/Cta'
import Features from '@/components/landing/Features'
import Footer from '@/components/Footer'
import ForRoleSection from '@/components/landing/ForRole'
import HeroSection from '@/components/landing/Hero'
import { authorization } from '@/lib/verifyAuth'
import { displayFont } from '@/lib/fonts'
import AdminHome from '@/components/home-dashboard/AdminHome'
import TeacherHome from '@/components/home-dashboard/TeacherHome'
import FamilyHome from '@/components/home-dashboard/FamilyHome'

const page = async () => {
  const { user } = await authorization();

  if (user) {
    return (
      <div className={displayFont.variable}>
        {user.role === 'admin' && <AdminHome name={user.name} role={user.role} />}
        {user.role === 'teacher' && <TeacherHome id={user.id} name={user.name} role={user.role} />}
        {user.role !== 'admin' && user.role !== 'teacher' && (
          <FamilyHome id={user.id} name={user.name} role={user.role} />
        )}
      </div>
    )
  }

  return (
    <div className={displayFont.variable}>
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
