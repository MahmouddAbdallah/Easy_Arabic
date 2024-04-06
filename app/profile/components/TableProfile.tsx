'use client';
import EditRowTable from '@/app/component/EditRowTable';
import { readableFormat, sumMoney } from '@/lib/function';
import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react'

const TableProfile = ({ role, id }: { role: string, id: string }) => {
    const [data, setData] = useState([]);
    const [open, setOpen] = useState(false);

    const [edit, setEdit] = useState({
        family: { name: "" },
        student: "",
        status: "",
        classDate: "",
        month: "",
        duration: "",
        TeacherReward: "",
    });

    const fetchDataTeacher = useCallback(
        async () => {
            try {
                const { data } = await axios.get(`/api/lesson/${role}/${id}`)
                setData(data.tables);
            } catch (error) {
                console.error(error);
            }
        }, [id, role])

    useEffect(() => {
        fetchDataTeacher();
    }, [fetchDataTeacher])

    return (
        <div>
            <div className='bg-white py-3 lg:py-10 lg:px-10 rounded-xl space-y-10 shadow'>
                {data?.map((item: any) => (
                    <div key={item.monthYear} >
                        <div className='py-3 pl-2 text-xs font-semibold uppercase'>
                            <span>DateTime : </span>
                            <span>{item.monthYear}</span>
                        </div>
                        <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                            <table className="w-full text-sm text-left rtl:text-right text-gray-500 ">
                                <thead className="text-xs text-gray-700 whitespace-nowrap uppercase bg-gray-100">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">
                                            Family
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            The student
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            The status
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Class Date
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            reward
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Teacher
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Created at
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            update at
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Duration
                                        </th>
                                        {role != 'family' &&
                                            <th scope="col" className="px-4 py-3">
                                                Money
                                            </th>
                                        }
                                        <th scope="col" className="px-4 py-3">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {item?.lessons?.map((item: any) => {
                                        const createdAt = readableFormat(item.createdAt)?.split(" ")
                                        const updatedAt = readableFormat(item.updatedAt)?.split(" ")
                                        return (
                                            <tr
                                                key={item.id}
                                                className="odd:bg-white even:bg-gray-50 ">
                                                <th scope="row" className="px-4 py-4 text-xs font-medium text-gray-900 whitespace-nowrap ">
                                                    {item.family.name}
                                                </th>
                                                <td className="px-4 py-4 text-xs whitespace-nowrap">
                                                    {item.student}
                                                </td>
                                                <td className="px-4 py-4 text-xs">
                                                    {item.status}
                                                </td>
                                                <td className="px-4 py-4 text-xs">
                                                    {item.classDate}
                                                </td>
                                                <td className="px-4 py-4 text-xs">
                                                    {item.TeacherReward}
                                                </td>
                                                <td className="px-4 py-4 text-xs whitespace-nowrap">
                                                    {item.user.name}
                                                </td>
                                                <td className="px-4 py-4 text-xs whitespace-nowrap">
                                                    <span>{createdAt[0]}</span>
                                                    <br />
                                                    <span>{createdAt[1]}</span>
                                                </td>
                                                <td className="px-4 py-4 text-xs whitespace-nowrap">
                                                    <span>{updatedAt[0]}</span>
                                                    <br />
                                                    <span>{updatedAt[1]}</span>
                                                </td>
                                                <td className="px-4 py-4 text-xs">
                                                    {item.duration}
                                                </td>
                                                {role != 'family' && <td className="px-4 py-4 text-xs">
                                                    {item.money}
                                                </td>}
                                                <td className="px-4 py-4 text-xs">
                                                    <button
                                                        onClick={() => {
                                                            setEdit(item)
                                                            setOpen(true)
                                                            document.body.style.overflowY = 'hidden'
                                                        }}
                                                        className='text-blue-600 font-semibold text-xs'>Edit</button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                {role == 'teacher' &&
                                    <tfoot className='bg-gray-200'>
                                        <tr>
                                            <td className='py-3 px-4' colSpan={8}>Total Money</td>
                                            <td className='py-3 text-center text-white bg-gray-400' colSpan={3}>
                                                {
                                                    sumMoney(item.lessons)
                                                }
                                            </td>
                                        </tr>
                                    </tfoot>}
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

export default TableProfile