import { cookies } from 'next/headers'
import Link from "next/link"
import { redirect } from 'next/navigation'

const SignIn = () => {
    const token = cookies().get('token')
    if (token) {
        redirect('/')
    }
    return (
        <div className='flex justify-center items-center h-screen'>
            <div className="bg-white px-5 py-10 w-full sm:w-[400px] rounded-md">
                <div className="">
                    <span className="text-sm">
                        Do you want to sign in as?
                    </span>
                </div>
                <div className="space-y-4 mt-8">
                    <Link className="w-full flex justify-center bg-blue-500 py-2 text-sm text-white rounded-md" href={'/sign-in/teacher'}>
                        Teacher
                    </Link>
                    <Link className="w-full flex justify-center bg-blue-500 py-2 text-sm text-white rounded-md" href={'/sign-in/family'}>
                        Family
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default SignIn