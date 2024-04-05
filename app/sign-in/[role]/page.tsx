import { Params } from "next/dist/shared/lib/router/utils/route-matcher"
import SignInForm from "../component/SignInForm"
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'


const SignIn = ({ params }: { params: Params }) => {
    const { role } = params
    const token = cookies().get('token')
    if (token) {
        redirect('/')
    } else if (role != 'family' && role != 'teacher') {
        redirect('/sign-in')
    }
    return (
        <div className='flex justify-center items-center h-screen px-5'>
            <div className='w-full sm:w-[400px] bg-white px-10 sm:px-5 py-10 rounded-md '>
                <div className="text-center pb-10">
                    <span className="text-lg uppercase font-semibold">{role}</span>
                </div>
                <SignInForm role={role} />
            </div>
        </div>
    )
}

export default SignIn