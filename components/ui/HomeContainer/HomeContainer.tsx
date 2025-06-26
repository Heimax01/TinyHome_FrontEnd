import cn from 'clsx'
import React, { FC } from 'react'

interface HomeContainerProps {
  className?: string
  children?: any
  el?: HTMLElement
  clean?: boolean
}

const HomeContainer: FC<HomeContainerProps> = ({
  children,
  className,
  el = 'div',
  clean = false, // Full Width Screen
}) => {
  const rootClassName = cn(className, {
    'h-screen w-screen': !clean,
  })

  let Component: React.ComponentType<React.HTMLAttributes<HTMLDivElement>> =
    el as any

  return <Component className={rootClassName}>{children}</Component>
}

export default HomeContainer
