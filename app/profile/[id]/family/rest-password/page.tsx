import { verifyAuth } from '@/lib/verifyAuth';
import React from 'react'
import { redirect } from 'next/navigation'
import { Params } from 'next/dist/shared/lib/router/utils/route-matcher';
import axios from 'axios';
import RestPassword from '@/app/profile/components/RestPassword';

const EditTeacher = async ({ params }: { params: Params }) => {
    const user = await verifyAuth();
    if (user) {
        if (user.role == 'admin') {
            const { id } = params
            const { data } = await axios.get(`/api/family/${id}`)
            return (
                <div className='p-container py-10 space-y-10'>
                    <RestPassword role={data.user.role} id={data?.user.id} />
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