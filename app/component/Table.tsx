'use client'
import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react'
import { useAppContext } from '../context/appContext';
import EditRowTable from './EditRowTable';

const Table = () => {
    const [data, setData] = useState([]);
    const [open, setOpen] = useState(false);
    const context = useAppContext()

    const [edit, setEdit] = useState({
        family: { name: "" },
        student: "",
        status: "",
        classDate: "",
        month: "",
        duration: "",
        TeacherReward: ""
    });

    const fetchDataTeacher = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/lesson/teacher/${context?.user?.id}`)
            setData(data.tables);
        } catch (error) {
            console.error(error);
        }
    }, [context?.user?.id])

    useEffect(() => {
        if ((context?.user?.role == 'teacher' || context?.user?.role == 'admin')) {
            fetchDataTeacher();
        }
    }, [context?.user?.role, fetchDataTeacher])

    const fetchDataFamily = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/lesson/family/${context?.user?.id}`)
            setData(data.tables);
        } catch (error) {
            console.error(error);
        }
    }, [context?.user?.id])

    useEffect(() => {
        if (context?.user?.role == 'family') {
            fetchDataFamily();
        }
    }, [context?.user?.role, fetchDataFamily])

    const sumMoney = (lesson: any) => {
        let sum: number = 0;
        lesson?.map((lesson: any) => {
            sum += lesson.money
        })
        return sum
    }

    return (
        <div className='p-container py-10'>
            <div className='bg-white py-5 lg:py-10 lg:px-10 rounded-xl space-y-10 shadow'>
                {data?.map((item: any) => (
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
                                            <td className="px-6 py-4 text-xs">
                                                {item.TeacherReward}
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
                {!data?.length &&
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