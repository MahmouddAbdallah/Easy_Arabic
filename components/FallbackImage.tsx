
'use client'

import Image, { ImageProps } from 'next/image'
import { useState } from 'react'
import { CldImage } from 'next-cloudinary'
import clsx from 'clsx'

type FallbackImageProps = Omit<ImageProps, 'src'> & {
    src?: string | undefined
}

type FallbackImageTypesProps = FallbackImageProps & {
    icon?: boolean
};

const FallbackImage = (props: FallbackImageTypesProps) => {
    const { src, onError, alt, className, icon, ...rest } = props

    const [imgSrc, setImgSrc] = useState(!!src ? src : '/img/notfound.png')
    const [isLoading, setIsLoading] = useState(true)

    const handleError = () => {
        setImgSrc('/img/notfound.png')
        setIsLoading(false)
    }

    const handleLoad = () => {
        setIsLoading(false)
    }

    return imgSrc.includes('res.cloudinary.com') ? (
        <CldImage
            src={imgSrc}
            alt={alt ?? 'image'}
            onError={handleError}
            onLoad={handleLoad}
            className={clsx(
                'transition-all duration-500',
                className,
                { 'blur-md scale-105': isLoading },
                { 'blur-0 scale-100': !isLoading },
            )}
            {...rest}
        />
    ) : (
        (imgSrc == '/img/notfound.png' && icon) ?
            <div className='size-full bg-linear-to-r from-primary to-brand-teal flex justify-center items-center text-white font-semibold text-lg'>
                {alt?.split('')?.[0]?.toUpperCase() || ""}
            </div>
            :
            <Image
                src={imgSrc}
                alt={alt ?? 'image'}
                onError={handleError}
                onLoad={handleLoad}
                className={clsx(
                    'transition-all duration-500',
                    className,
                    { 'blur-md scale-105': isLoading },
                    { 'blur-0 scale-100': !isLoading },
                )}
                {...rest}
            />
    )
}

export default FallbackImage
