import NotificationBody from '@/components/notification/NotificationBody'
import { NotificationProvider } from '@/components/notification/NotificationProvider'

const page = () => {
    return (
        <NotificationProvider>
            <NotificationBody />
        </NotificationProvider>
    )
}

export default page