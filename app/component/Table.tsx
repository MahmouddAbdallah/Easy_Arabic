'use client'
import React, { useState } from 'react'
import { useAppContext } from '../context/appContext';
import EditRowTable from './EditRowTable';
import { sumMoney } from '@/lib/function';

const Table = () => {
    const context = useAppContext()
    const [open, setOpen] = useState(false);
    const [edit, setEdit] = useState({
        family: { name: "" },
        student: "",
        status: "",
        classDate: "",
        month: "",
        duration: "",
        TeacherReward: ""
    });

    return (
        <div className='p-container py-10'>
            <div className='bg-white py-5 lg:py-10 lg:px-10 rounded-xl space-y-10 shadow'>
                {context?.data?.map((item: any) => (
                    <div key={item.monthYear} >
                        <div className='pb-5 pl-2 text-xs font-semibold uppercase'>
                            <span>DateTime : </span>
                            <span>{item.monthYear}</span>
                        </div>
                        <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                            <table className="w-full text-sm text-left rtl:text-right text-gray-500 ">
                                <thead className="text-xs text-gray-700 whitespace-nowrap uppercase bg-gray-100">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">
                                            Family
                                        </th>
                                        <th scope="col" className="px-6 py-3">
                                            The student
                                        </th>
                                        <th scope="col" className="px-6 py-3">
                                            The status
                                        </th>
                                        <th scope="col" className="px-6 py-3">
                                            Duration
                                        </th>
                                        {(context?.user?.role == 'teacher' ||
                                            context?.user?.role == 'admin') &&
                                            <th scope="col" className="px-6 py-3">
                                                Money
                                            </th>
                                        }
                                        <th scope="col" className="px-6 py-3">
                                            Class Date
                                        </th>
                                        <th scope="col" className="px-6 py-3">
                                            Teacher reward
                                        </th>
                                        <th scope="col" className="px-6 py-3">
                                            Teacher
                                        </th>
                                        {(context?.user?.role == 'teacher' ||
                                            context?.user?.role == 'admin') &&
                                            <th scope="col" className="px-6 py-3">
                                                Action
                                            </th>
                                        }
                                    </tr>
                                </thead>
                                <tbody>
                                    {item.lessons?.map((item: any) => (
                                        <tr
                                            key={item.id}
                                            className="odd:bg-white even:bg-gray-50 ">
                                            <th scope="row" className="px-6 py-4 text-xs font-medium text-gray-900 whitespace-nowrap ">
                                                {item.family.name}
                                            </th>
                                            <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                {item.student}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {item.status}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {item.duration}
                                            </td>
                                            {
                                                (context?.user?.role == 'teacher' ||
                                                    context?.user?.role == 'admin') &&
                                                <td className="px-6 py-4 text-xs">
                                                    {item.money}
                                                </td>
                                            }
                                            <td className="px-6 py-4 text-xs">
                                                {item.classDate}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-center">
                                                {item.TeacherReward ?
                                                    item.TeacherReward :
                                                    <div className='relative text-center flex items-center'>
                                                        <span className='text-center w-full block text-2xl absolute'>
                                                            -
                                                        </span>
                                                    </div>
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                {item.user.name}
                                            </td>
                                            {
                                                (context?.user?.role == 'teacher' ||
                                                    context?.user?.role == 'admin') &&
                                                <td className="px-6 py-4 text-xs">
                                                    <button
                                                        className='text-blue-600 font-semibold text-xs'
                                                        onClick={() => {
                                                            setEdit(item)
                                                            setOpen(true)
                                                            document.body.style.overflowY = 'hidden'
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            }
                                        </tr>
                                    ))}
                                </tbody>
                                {(context?.user?.role == 'teacher' ||
                                    context?.user?.role == 'admin') &&
                                    <tfoot className='bg-gray-200'>
                                        <tr>
                                            <td className='py-3 px-5' colSpan={7}>Total Money</td>
                                            <td className='py-3 text-center text-white bg-gray-400' colSpan={2}>
                                                {
                                                    sumMoney(item.lessons)
                                                }
                                            </td>
                                        </tr>
                                    </tfoot>
                                }
                            </table>
                        </div>
                        <div>
                            {open &&
                                <EditRowTable
                                    open={open}
                                    setOpen={setOpen}
                                    setEdit={setEdit}
                                    edit={edit}
                                />
                            }
                        </div>
                    </div>
                ))}
                {!context?.data?.length &&
                    <div>
                        <div className=' py-5 md:py-10 text-center bg-white rounded-md'>
                            No data available yet.
                        </div>
                    </div>
                }
            </div>
        </div>
    )
}

export default Table