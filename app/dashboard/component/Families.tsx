import { sumDuration, sumMoney } from '@/lib/function';
import prisma from '@/prisma/client'
import Link from 'next/link';

const Families = async () => {
    const families = await prisma?.family.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            Lesson: {
                select: {
                    money: true,
                    duration: true
                }
            },
        }
    })

    return (
        <div className=''>
            <div className='py-3 pl-2 text-xs font-semibold uppercase'>
                <span>Families : </span>
            </div>
            {families?.length ?
                <>
                    <div className="relative overflow-x-auto shadow-md md:rounded-lg">
                        <table className="w-full text-sm text-left rtl:text-right text-gray-500 ">
                            <thead className="text-xs text-gray-700 whitespace-nowrap uppercase bg-gray-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3">
                                        Name
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Email
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Phone
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Role
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Duration
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Money
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {families?.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="odd:bg-white even:bg-gray-50 ">
                                        <th scope="row" className="px-6 py-4 text-xs font-medium text-gray-900 whitespace-nowrap ">
                                            <Link
                                                href={`/profile/${item.id}/family`}
                                                className='hover:underline hover:text-blue-500 duration-100 '
                                            >
                                                {item.name}
                                            </Link>
                                        </th>
                                        <td className="px-6 py-4 text-xs whitespace-nowrap">
                                            {item.email}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {item.phone}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {item.role}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {sumDuration(item.Lesson)}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-black">
                                            {sumMoney(item.Lesson)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
                :
                <div>
                    <div className=' py-5 md:py-10 text-center bg-white rounded-md'>
                        No data available yet.
                    </div>
                </div>
            }
        </div>
    )
}

export default Families