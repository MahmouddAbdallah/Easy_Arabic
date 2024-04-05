import ErrorMsg from '@/app/component/ErrorMsg'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'

const ChangePassword = ({ role, id }: { role: string, id: string, }) => {

    const { register, handleSubmit, watch, formState: { errors, isValid } } = useForm()
    const onSubmit = handleSubmit(async (formData) => {
        try {
            const { data } = await axios.patch(`/api/${role === "admin" ? 'teacher' : role}/${id}/password/change`,
                {
                    password: formData.password,
                    newPassword: formData.newPassword,
                })
            toast.success(data.message);
            window.location.reload();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an error');
            console.error(error);
        }
    })

    return (
        <form className='md:w-[500px] px-5 pt-10 pb-5'>
            <div className='text-center pb-10 text-xl uppercase font-medium'>
                <span>Change Password</span>
            </div>
            <div className='space-y-5'>
                <input
                    type="password"
                    placeholder='Password'
                    {...register('password', { required: 'Please Enter Password' })}
                    className=' p-2 rounded-md w-full border border-gray-400 disabled:placeholder:text-black/50  placeholder:text-blac outline-none focus:border-blue-500k'
                />
                <ErrorMsg message={errors.password?.message as string} />
                <input
                    type="password"
                    placeholder='New Password'
                    {...register('newPassword', { required: 'Please Enter New Password' })}
                    className=' p-2 rounded-md w-full border border-gray-400 disabled:placeholder:text-black/50  placeholder:text-blac outline-none focus:border-blue-500k'
                />
                <ErrorMsg message={errors.newPassword?.message as string} />
                <input
                    type="password"
                    placeholder='Confirmation Password'
                    {...register('confirmPassword', {
                        required: 'Please Enter Password',
                        validate: (val) => {
                            if (!val) {
                                return "Please enter your password again.";
                            } else if (watch('newPassword') != val) {
                                return "Passwords do not match!";
                            }
                        }
                    })}
                    className=' p-2 rounded-md w-full border border-gray-400 disabled:placeholder:text-black/50  placeholder:text-blac outline-none focus:border-blue-500k'
                />
                <ErrorMsg message={errors.confirmPassword?.message as string} />

                <div className='flex gap-5'>
                    <button
                        onClick={onSubmit}
                        disabled={!isValid}
                        className="w-full py-2 rounded-md bg-blue-500 disabled:bg-blue-300 text-white font-semibold">Save</button>

                </div>
            </div>
        </form>
    )
}

export default ChangePassword