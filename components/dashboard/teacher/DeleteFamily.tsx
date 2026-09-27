import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { userType } from '@/types/userTypes'
import { AlertTriangleIcon, Trash2Icon } from 'lucide-react'
import React, { useState } from 'react'

const DeleteFamily = ({ family }: { family: Partial<userType> }) => {
    const [Open, setOpen] = useState(false);
    const confirmRemoveStudent = () => {

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
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader className="flex flex-col items-center text-center pt-4">
                        <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-2">
                            <AlertTriangleIcon className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-lg">Remove Student?</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            Are you sure you want to remove <strong className="text-foreground">{Open ? family?.name : ''}</strong> from this list? This action will be staged until you save changes.
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
                            variant="destructive"
                            size="sm"
                            className="w-full sm:w-auto text-xs gap-1.5"
                            onClick={confirmRemoveStudent}
                        >
                            <Trash2Icon className="h-3.5 w-3.5" />
                            Confirm Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default DeleteFamily