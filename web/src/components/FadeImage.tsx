import { useState, type ImgHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

// Só aparece quando a imagem terminou de carregar: nada de foto pintando de cima para baixo
export function FadeImage({ className, alt = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false)

  return (
    <img
      {...props}
      src={props.src || './favicon.svg'}
      alt={alt}
      ref={(el) => {
        if (el?.complete && el.naturalWidth) setLoaded(true)
      }}
      onLoad={() => setLoaded(true)}
      className={cn('transition-opacity duration-500 ease-out', loaded ? 'opacity-100' : 'opacity-0', className)}
    />
  )
}
