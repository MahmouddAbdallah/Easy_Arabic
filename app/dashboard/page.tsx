import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/verifyAuth';
import Teachers from './component/Teachers';
import Families from './component/Families';

const Dashboard = async () => {
    const user = await verifyAuth();
    if (user) {
        if (user.role == 'admin') {
            return (
                <div className='p-container py-10'>
                    <div className='py-10 bg-white lg:px-5 shadow rounded-xl space-y-10'>
                        <Teachers />
                        <Families />
                    </div>
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

export default Dashboard