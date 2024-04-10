import { verifyAuth } from '@/lib/verifyAuth';
import Link from "next/link"
import { redirect } from 'next/navigation'

const SignUp = async () => {
    // const user = await verifyAuth();
    // if (user) {
    //     if (user.role == 'admin') {
    return (
        <div className='flex justify-center items-center h-[calc(100svh-76px)] px-5'>
            <div className="bg-white px-5 pb-10 w-full sm:w-[400px] rounded-md">
                <div className="pt-5">
                    <span className="text-sm font-medium">
                        Do you want to sign up as?
                    </span>
                </div>
                <div className="space-y-4 mt-8">
                    <Link className="w-full flex justify-center bg-blue-500 py-2 text-sm text-white rounded-md" href={'/sign-up/teacher'}>
                        Teacher
                    </Link>
                    <Link className="w-full flex justify-center bg-blue-500 py-2 text-sm text-white rounded-md" href={'/sign-up/family'}>
                        Family
                    </Link>
                </div>
            </div>
        </div>
    )
    //     } else {
    //         redirect("/")
    //     }
    // }
    // else {
    //     redirect("/")
    // }
}

export default SignUp