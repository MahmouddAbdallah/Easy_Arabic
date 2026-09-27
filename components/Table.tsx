import { LessonType } from "@/types/lessonTypes"

const Table = async ({ lessons }: { lessons: LessonType[] }) => {

    return (
        <div className='bg-surface pb-2 rounded-xl space-y-10 shadow'>
            <div  >
                <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left rtl:text-right text-muted-foreground ">
                        <thead className="text-xs text-muted-foreground whitespace-nowrap uppercase bg-muted">
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
                                <th scope="col" className="px-6 py-3">
                                    Money
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Class Date
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Teacher reward
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Teacher
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {lessons?.map((item, i) => (
                                <tr
                                    key={i}
                                    className="odd:bg-surface even:bg-muted ">
                                    <th scope="row" className="px-6 py-4 text-xs font-medium text-foreground whitespace-nowrap ">
                                        item.family.name
                                    </th>
                                    <td className="px-6 py-4 text-xs whitespace-nowrap">
                                        item.student
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        item.status
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        item.duration
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        item.money
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        item.classDate
                                    </td>
                                    <td className="px-6 py-4 text-xs text-center">

                                        <div className='relative text-center flex items-center'>
                                            <span className='text-center w-full block text-2xl absolute'>
                                                -
                                            </span>
                                        </div>

                                    </td>
                                    <td className="px-6 py-4 text-xs whitespace-nowrap">
                                        item.user.name
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        <button
                                            className='text-primary font-semibold text-xs'
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className='bg-muted'>
                            <tr>
                                <td className='py-3 px-5' colSpan={7}>Total Money (this page)</td>
                                <td className='py-3 text-center text-white bg-muted-foreground/40' colSpan={2}>
                                    00
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default Table
