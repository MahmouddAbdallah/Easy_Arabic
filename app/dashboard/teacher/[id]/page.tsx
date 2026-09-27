import { TabsContent } from '@/components/ui/tabs'
import React from 'react'

const page = () => {
    return (
        <TabsContent value="lessons" className="space-y-4">
            <div className="p-8 border rounded-xl border-dashed text-center text-muted-foreground">
                Lessons component goes here.
            </div>
        </TabsContent>
    )
}

export default page