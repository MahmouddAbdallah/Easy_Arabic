import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import axios from 'axios'
import { AlertTriangleIcon, Loader2Icon, Trash2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useParams } from 'next/navigation'
import { TeacherFamilyType, useTeacherFamilyStore } from '@/stores/admin/teacherFamilies'

const DeleteFamily = ({ teacherFamily }: { teacherFamily: TeacherFamilyType }) => {
    const [Open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { id } = useParams();
    const removeFamily = useTeacherFamilyStore((state) => state.removeTeacherFamily);

    const confirmRemoveStudent = async () => {
        try {
            setLoading(true);
            await axios.delete(`/api/teacher/${id}/family/${teacherFamily?.family?.id}`);
            toast.success('Family removed successfully');
            removeFamily(teacherFamily?.id);
            setOpen(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || 'Something went wrong');
        }
        finally {
            setLoading(false)
        }
    };
    return (
        <div>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setOpen(true)}
            >
                <Trash2Icon className="h-4 w-4" />
            </Button>
            <Dialog open={!!Open} onOpenChange={setOpen}>
                <DialogContent className="">
                    <DialogHeader className="flex flex-col items-center text-center pt-4">
                        <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-2">
                            <AlertTriangleIcon className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-lg">Remove Student?</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            Are you sure you want to remove <strong className="text-foreground">
                                {Open ? teacherFamily?.family?.name : ''}</strong>
                            from this list? This action will be staged until you save changes.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex sm:justify-center gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto text-xs"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={loading}
                            variant="destructive"
                            size="sm"
                            className="w-full sm:w-auto text-xs gap-1.5"
                            onClick={confirmRemoveStudent}
                        >
                            {loading ? (
                                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Trash2Icon className="h-3.5 w-3.5" />
                            )}
                            Confirm Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default DeleteFamily