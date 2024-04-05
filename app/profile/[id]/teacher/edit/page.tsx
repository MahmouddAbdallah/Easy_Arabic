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
            const { data } = await axios.get(`/api/teacher/${id}`)
            return (
                <div className='p-container py-10 space-y-10'>
                    <EditProfile user={data.user} />
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