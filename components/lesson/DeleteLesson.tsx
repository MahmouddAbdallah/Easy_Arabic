import { Dispatch, SetStateAction, useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useAppContext } from "../AppContext";
import toast from "react-hot-toast";
import { useLessonStore } from "@/stores/lessons";

interface DeleteLessonProps {
    title?: string;
    description?: string;
    lessonId?: string;
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>
}

export function DeleteLesson({
    title = "Are you sure?",
    description = "This action cannot be undone. This will permanently delete the item.",
    lessonId,
    open,
    setOpen

}: DeleteLessonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAppContext();
    const removeLesson = useLessonStore(state => state.removeLesson);

    const handleDelete = async () => {
        try {
            setIsLoading(true);
            await axios.delete(`/api/teacher/${user?.id}/lesson/${lessonId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            removeLesson(lessonId as any)
            toast.success('Deleted the lesson Successfully!!');
            setOpen(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger >
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="max-w-100">
                <AlertDialogHeader className="flex flex-col items-center text-center sm:text-center gap-2">
                    {/* Danger Warning Icon */}
                    <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-1">
                        <AlertTriangle className="h-6 w-6" />
                    </div>

                    <AlertDialogTitle className="text-lg font-semibold">
                        {title}
                    </AlertDialogTitle>

                    <AlertDialogDescription className="text-sm text-muted-foreground">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter className="sm:justify-center gap-2 mt-2">
                    <AlertDialogCancel disabled={isLoading} className="w-full sm:w-auto mt-0">
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={isLoading}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground w-full sm:w-auto"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Deleting...
                            </>
                        ) : (
                            "Delete"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}