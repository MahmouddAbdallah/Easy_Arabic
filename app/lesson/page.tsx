import LessonForm from './components/LessonForm'
import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/verifyAuth';

const Lesson = async () => {
    const user = await verifyAuth();
    if (user) {
        if (user.role == 'admin' || user.role == 'teacher') {
            return (
                <div className='p-container py-10 flex justify-center'>
                    <LessonForm />
                </div>
            )
        } else {
            redirect("/")
        }
    }
    else {
        redirect("/")
    }
}

export default Lesson