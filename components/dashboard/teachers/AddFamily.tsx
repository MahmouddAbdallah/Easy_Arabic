import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import axios from 'axios'
import { Loader2Icon, LoaderIcon, SearchIcon, UserPlusIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useParams } from 'next/navigation'
import { useTeacherFamilyStore } from '@/stores/admin/teacherFamilies'

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string;
}

const AddFamily = () => {
    const [search, setSearch] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [count, setCount] = useState<number>(0);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const addTeacherFamily = useTeacherFamilyStore((state) => state.addTeacherFamily);
    const teacherFamilies = useTeacherFamilyStore((state) => state.teacherFamilies);

    const { id } = useParams()

    useEffect(() => {
        if (!search.trim()) {
            setUsers([]);
            setCount(0);
            setIsSearchLoading(false);
            return;
        }

        setIsSearchLoading(true);

        const timer = setTimeout(async () => {
            try {
                const { data } = await axios.get(`/api/users?keyword=${search}&role=family`);
                setUsers(data?.users?.data || []);
                setCount(data?.users?.count || 0);
            } catch (error) {
                console.error(error);
                setUsers([]);
                setCount(0);
            } finally {
                setIsSearchLoading(false);
            }
        }, 700);

        return () => clearTimeout(timer);
    }, [search]);



    const handleDone = async () => {
        try {
            setLoading(true)
            const { data } = await axios.post(`/api/teacher/${id}/family`, {
                familiesIds: selectedUserIds,
                teacherId: id,
            })
            data.teacherFamilies.forEach((teacherFamily: any) => {
                addTeacherFamily(teacherFamily);
            });

            setIsAddDialogOpen(false);
            setUsers([]);
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || 'Something went wrong');
        }
        finally {
            setLoading(false)
        }
    };

    // filter out already linked families from the search results
    const filteredUsers = users.filter(user => !teacherFamilies.some(tf => tf.family.id === user.id));
    return (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger >
                <Button size="sm" className="h-9 gap-2 shrink-0 font-medium">
                    <UserPlusIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Student</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-120 p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 bg-muted/20 border-b">
                    <DialogTitle className="text-base font-semibold">Add Students to Class</DialogTitle>
                    <DialogDescription className="text-xs">
                        Search by student name or email address to add them.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Type name or email address..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-10 text-sm"
                            autoFocus
                        />
                    </div>

                    {!isSearchLoading && filteredUsers.length > 0 && (
                        <div className="flex justify-between items-center px-1 text-xs text-muted-foreground font-medium">
                            <span>Found {count} student{count !== 1 ? 's' : ''}</span>
                            <span>{selectedUserIds.length} selected</span>
                        </div>
                    )}

                    <div className="min-h-45 max-h-70 overflow-y-auto rounded-lg border bg-muted/10 p-2 space-y-1">
                        {isSearchLoading ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-2">
                                <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">Searching...</p>
                            </div>
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => {
                                const isChecked = selectedUserIds.includes(user.id);
                                return (
                                    <label
                                        key={user.id}
                                        className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 border bg-background text-xs cursor-pointer transition-colors"
                                    >
                                        <div className="space-y-0.5">
                                            <p className="font-semibold text-foreground">{user.name}</p>
                                            <p className="text-muted-foreground">{user.email} • {user.phone}</p>
                                        </div>

                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => {
                                                setSelectedUserIds((prev) =>
                                                    prev.includes(user.id)
                                                        ? prev.filter((id) => id !== user.id)
                                                        : [...prev, user.id]
                                                );
                                            }}
                                            className="h-4 w-4 border-black dark:border-white"
                                        />
                                    </label>
                                );
                            })
                        ) : search.trim() ? (
                            <div className="text-center py-8 space-y-1">
                                <p className="text-xs font-medium text-foreground">
                                    No results found for {search}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Try searching with a different name or email.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                                <div className="p-3 rounded-full bg-muted/50 text-muted-foreground/60">
                                    <SearchIcon className="h-5 w-5" />
                                </div>
                                <p className="text-xs text-muted-foreground max-w-55">
                                    Start typing to search available students from the system.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 pb-7 bg-muted/20 border-t flex flex-row items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAddDialogOpen(false)}
                        className="h-9 px-4 text-xs font-medium hover:bg-muted"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleDone}
                        disabled={selectedUserIds.length === 0 || loading}
                        className="h-9 px-4 text-xs font-medium"
                    >
                        {loading && <LoaderIcon className='size-5 animate-spin' />}
                        {selectedUserIds.length > 0 ? `Add (${selectedUserIds.length})` : 'Done'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default AddFamily