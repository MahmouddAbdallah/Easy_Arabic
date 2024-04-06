import React from 'react'
import { LogoLoadingIcon } from './component/icons'

const Loading = () => {
    return (
        <div className='bg-gray-200 h-[calc(100svh-76px)] w-svw left-0 top-0 flex justify-center items-center z-50'>
            <LogoLoadingIcon className='w-32 h-32 animate-pulse' />
        </div>
    )
}

export default Loading