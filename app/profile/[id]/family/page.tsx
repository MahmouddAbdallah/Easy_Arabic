import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/verifyAuth';
import { Params } from 'next/dist/shared/lib/router/utils/route-matcher'
import React from 'react'
import axios from 'axios';
import UserInfo from '../../components/UserInfo';
import TableProfile from '../../components/TableProfile';

const Family = async ({ params }: { params: Params }) => {
    const user = await verifyAuth();
    if (user) {
        if (user.role == 'admin') {
            const { id } = params

            const { data } = await axios.get(`/api/family/${id}`)
            return (
                <div className='p-container py-10 space-y-10'>
                    <UserInfo user={data?.user} />
                    <TableProfile id={id} role='family' />
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

export default Family