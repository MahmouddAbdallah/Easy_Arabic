import { verifyAuth } from '@/lib/verifyAuth';
import React from 'react'
import { redirect } from 'next/navigation'
import { Params } from 'next/dist/shared/lib/router/utils/route-matcher';
import EditProfile from '@/app/profile/components/EditProfile';
import axios from 'axios';

const EditTeacher = async ({ params }: { params: Params }) => {
    const user = await verifyAuth();
    if (user) {
        if (user.role == 'admin') {
            const { id } = params
            const { data } = await axios.get(`/api/family/${id}`)
            return (
                <div className='p-container py-10 space-y-10'>
                    <div className='bg-white py-3 lg:py-10 lg:px-10 rounded-xl space-y-10 shadow'>
                        <EditProfile user={data.user} />
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

export default EditTeacher