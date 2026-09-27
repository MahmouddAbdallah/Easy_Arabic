import React, { useEffect, useState } from 'react'
import { UsersIcon, Loader2, AlertCircle, Mail, Phone, Activity, UserIcon } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { useFamilyStore } from '@/stores/families'
import axios from 'axios'
import { useAppContext } from '../AppContext'
import ErrorMsg from '../ErrorMsg'
import { Input } from '../ui/input'

export interface Family {
    id: string
    name: string
    email: string
    phone: string
    status: string
}

const getInitials = (name: string) => {
    if (!name) return 'FA'
    const words = name.trim().split(' ')
    if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
}

const SelectFamilies = ({ isFilter }: { isFilter?: boolean }) => {
    const { user } = useAppContext()
    const { control, register, formState: { errors } } = useFormContext()

    const setFamilies = useFamilyStore((state) => state.setFamilies)
    const families = (useFamilyStore((state) => state.families) as Family[]) || []

    const [loading, setLoading] = useState<boolean>(false)

    useEffect(() => {
        if (!user?.id) return;
        if (families?.length) return;

        const fetchFamilies = async () => {
            setLoading(true)
            try {
                const { data } = await axios.get(`/api/teacher/${user.id}/families`)
                setFamilies(data.families || [])
            } catch (err) {
                console.error('Failed to fetch families:', err)
                setFamilies([])
            } finally {
                setLoading(false)
            }
        }

        fetchFamilies()
    }, [setFamilies, user?.id, families?.length])

    return (
        <div className="space-y-1.5">
            {!isFilter && <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Family
            </h3>
            }

            <div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                        <UsersIcon className="h-3.5 w-3.5 text-primary" />
                        <span>Family</span>
                    </label>

                    <Controller
                        name="familyId"
                        control={control}
                        rules={isFilter ? {} : { required: "Please select family" }}
                        render={({ field }) => {
                            const selectedFamily = families.find((f) => f.id === field.value)
                            return (
                                <div className="space-y-1">
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value || ''}
                                        disabled={loading}
                                    >
                                        <SelectTrigger className="w-full h-auto py-2">
                                            {loading ? (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    <span>Loading families...</span>
                                                </div>
                                            ) : (
                                                <SelectValue placeholder="Select a family">
                                                    {selectedFamily ? (
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-6 w-6 text-[10px]">
                                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                                    {getInitials(selectedFamily.name)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span>{selectedFamily.name}</span>
                                                        </div>
                                                    ) : (
                                                        'Select a family'
                                                    )}
                                                </SelectValue>
                                            )}
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Families List</SelectLabel>

                                                {!loading && families.length === 0 && (
                                                    <div className="p-3 text-center space-y-1">
                                                        <p className="text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5">
                                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                                            <span>No families assigned to you yet</span>
                                                        </p>
                                                    </div>
                                                )}

                                                {!loading && families.length > 0 && families.map((family) => (
                                                    <SelectItem key={family.id} value={family.id} className="py-2.5">
                                                        <div className="flex items-start gap-3 w-full text-left">
                                                            <Avatar className="h-8 w-8 text-xs shrink-0 mt-0.5">
                                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                                    {getInitials(family.name)}
                                                                </AvatarFallback>
                                                            </Avatar>

                                                            <div className="flex flex-col gap-1 grow">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="font-semibold text-sm text-foreground">
                                                                        {family.name}
                                                                    </span>
                                                                    {family.status && (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 capitalize">
                                                                            <Activity className="h-3 w-3" />
                                                                            {family.status}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                                    {family.email && (
                                                                        <div className="flex items-center gap-1">
                                                                            <Mail className="h-3 w-3 text-primary/70" />
                                                                            <span>{family.email}</span>
                                                                        </div>
                                                                    )}
                                                                    {family.phone && (
                                                                        <div className="flex items-center gap-1">
                                                                            <Phone className="h-3 w-3 text-primary/70" />
                                                                            <span>{family.phone}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>

                                </div>
                            )
                        }}
                    />
                    <ErrorMsg message={errors?.familyId?.message as string} />
                </div>
                {!isFilter &&
                    <div>
                        <label className="text-xs font-medium flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-primary" />
                            <span>Student Name</span>
                        </label>
                        <Input
                            type='text'
                            className="w-full h-auto text-sm"
                            placeholder='Mohamed Abdullah'
                            {...register('student', { required: "Student name is required!" })}
                        />
                        <ErrorMsg message={errors?.student?.message as string} />
                    </div>
                }
            </div>
        </div>
    )
}

export default SelectFamilies