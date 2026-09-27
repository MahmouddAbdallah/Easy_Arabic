import React from 'react'

const ErrorMsg = ({ message }: { message: string | undefined | null }) => {
    return (
        <>
            {
                message &&
                <span className='text-destructive text-xs font-semibold -mt-2'>
                    {message}
                </span>
            }
        </>
    )
}

export default ErrorMsg