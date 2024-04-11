import { redirect } from 'next/navigation'
import { verifyAuth } from '@/lib/verifyAuth';
import { Params } from 'next/dist/shared/lib/router/utils/route-matcher'
import React from 'react'
import axios from 'axios';
import UserInfo from '../../components/UserInfo';
import TableProfile from '../../components/TableProfile';

export async function generateMetadata({ params }: { params: Params }) {
    const { id } = params
    const { data } = await axios.get(`/api/teacher/${id}`)
    return {
        title: data?.user?.name || 'DELETD ACCOUNT',
    }
}

const Teacher = async ({ params }: { params: Params }) => {
    const user = await verifyAuth();
    if (user) {
        if (user.role == 'admin') {
            const { id } = params
            const { data } = await axios.get(`/api/teacher/${id}`)
            return (
                <div className='p-container py-10 space-y-10'>
                    <UserInfo user={data?.user} />
                    <TableProfile id={id} role='teacher' />
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

export default Teacher