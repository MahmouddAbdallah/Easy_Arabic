'use client'
import axios from 'axios';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { FieldValues, UseFormSetValue } from 'react-hook-form';
import toast from 'react-hot-toast';
interface props {
    className: string,
    placeholder: string,
    setValue: UseFormSetValue<FieldValues>,
    keyword: string;
    setKeyword: React.Dispatch<React.SetStateAction<string>>;
}
const SearchFamily: React.FC<props> = ({ className, placeholder, setValue, keyword, setKeyword }) => {
    const [family, setFamily] = useState<string[] | null>([])
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [open, setOpen] = useState(false)
    const handleSearchFamily = useCallback(
        async () => {
            try {
                if (keyword) {
                    const { data } = await axios.get(`/api/family/keyword/${keyword}`)
                    setFamily(data?.data);
                } else {
                    setFamily([])
                    setOpen(false)
                }
            } catch (error: any) {
                toast.error(error?.response?.data?.message || 'There is an error');
                console.error(error);
            }
        }, [keyword]
    )
    useEffect(() => {
        handleSearchFamily()
    }, [handleSearchFamily])

    return (
        <div className='w-full relative'>
            <input
                type="text"
                value={keyword}
                ref={inputRef}
                placeholder={placeholder}
                className={`${className}`}
                onChange={(e) => {
                    setKeyword(e.target.value)
                    setOpen(true)
                }}
            />
            {
                open &&
                <ul className='absolute bg-white space-y-1 w-full rounded-md border-b border-black/50'>
                    {family?.map((item: any, i) => (
                        <li key={item.id}>
                            <button
                                onClick={() => {
                                    setKeyword(item.name)
                                    setOpen(false)
                                    setValue('familyId', item.id)
                                }}
                                className='flex gap-2 py-2 px-2 w-full bg-blue-50'>
                                <div className='text-xs font-semibold bg-teal-500 text-white w-6 h-6 flex justify-center items-center rounded-full'>
                                    {item?.name?.split("")[0]}
                                </div>
                                <div>
                                    <span>{item?.name}</span>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            }
        </div>
    )
}

export default memo(SearchFamily)