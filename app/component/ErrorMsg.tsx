import React from 'react'

const ErrorMsg = ({ message }: { message: string }) => {
    return (
        <>
            {
                message &&
                <span className='text-red-500 text-sm'>
                    {message}
                </span>
            }
        </>
    )
}

export default ErrorMsg