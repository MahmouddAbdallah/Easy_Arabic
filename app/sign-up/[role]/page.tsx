import { Params } from "next/dist/shared/lib/router/utils/route-matcher"
import SignUpForm from "../components/SignUpForm"

const SignUp = ({ params }: { params: Params }) => {
    const { role } = params
    return (
        <div className='flex justify-center items-center h-svh bg-gray-200 px-5'>
            <div className="w-full sm:w-[400px] bg-white px-10 sm:px-5 py-10 rounded-md space-y-7">
                <div className="text-center ">
                    <span className="text-lg uppercase font-semibold">{role}</span>
                </div>
                <SignUpForm role={role as string} />
            </div>
        </div>
    )
}

export default SignUp