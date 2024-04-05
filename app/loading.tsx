import React from 'react'
import { LogoLoadingIcon } from './component/icons'

const Loading = () => {
    return (
        <div className='fixed bg-gray-200 h-full w-full left-0 top-0 flex justify-center items-center'>
            <LogoLoadingIcon className='w-32 h-32 animate-pulse' />
        </div>
    )
}

export default Loading