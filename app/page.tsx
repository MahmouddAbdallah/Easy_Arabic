import About from '@/components/landing/About'
import ChatShowcase from '@/components/landing/ChatShowcase'
import CTA from '@/components/landing/Cta'
import Features from '@/components/landing/Features'
import Footer from '@/components/Footer'
import ForRoleSection from '@/components/landing/ForRole'
import HeroSection from '@/components/landing/Hero'
import NotificationsShowcase from '@/components/landing/NotificationsShowcase'
import { authorization } from '@/lib/verifyAuth'
import { displayFont } from '@/lib/fonts'
import AdminHome from '@/components/home/AdminHome'
import TeacherHome from '@/components/home/TeacherHome'
import FamilyHome from '@/components/home/FamilyHome'

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
      <ChatShowcase />
      <NotificationsShowcase />
      <ForRoleSection />
      <CTA />
      <Footer />
    </div>
  )
}

export default page
