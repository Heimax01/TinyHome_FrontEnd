import { FC } from 'react'
import Link from 'next/link'
import NavbarRoot from './NavbarRoot'
import { Logo, Container } from '@components/ui'
import { Searchbar, UserNav } from '@components/common'

interface Link {
  href: string
  label: string
}

interface NavbarProps {
  links?: Link[]
}

const Navbar: FC<NavbarProps> = ({ links }) => {
  return (
    <NavbarRoot>
      {/* Transparent Container - Positioned at top */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Container clean className="mx-auto max-w-8xl px-4">
          {/* Compact Centered Navigation Container */}
          <div className="flex justify-center items-center py-2">
            {/* Logo with glassmorphism - no border, smaller */}
            <div className="absolute left-4">
              <Link
                href="/"
                className="flex items-center px-3 py-2 bg-white/[0.08] backdrop-blur-xl rounded-xl transition-all duration-300 hover:bg-white/[0.18] hover:-translate-y-1 hover:scale-105 hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
                aria-label="Logo"
              >
                <Logo />
              </Link>
            </div>

            {/* Centered Navigation Links - no borders, smaller */}
            <nav className="flex items-center gap-2 bg-white/[0.08] backdrop-blur-xl rounded-xl px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
              <Link
                href="/search"
                className="relative px-3 py-2 bg-white/[0.04] rounded-lg font-semibold text-white/90 text-sm transition-all duration-300 hover:bg-white/15 hover:-translate-y-1 hover:scale-105 hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:text-white group overflow-hidden"
              >
                <span className="relative z-10">All</span>
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              </Link>
              {links?.map((l) => (
                <Link
                  href={l.href}
                  key={l.href}
                  className="relative px-3 py-2 bg-white/[0.04] rounded-lg font-semibold text-white/90 text-sm transition-all duration-300 hover:bg-white/15 hover:-translate-y-1 hover:scale-105 hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:text-white group overflow-hidden"
                >
                  <span className="relative z-10">{l.label}</span>
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                </Link>
              ))}
            </nav>

            {/* Search container - no border, smaller */}
            {process.env.COMMERCE_SEARCH_ENABLED && (
              <div className="absolute right-16 hidden lg:block">
                <div className="bg-white/[0.08] backdrop-blur-md rounded-xl p-1 transition-all duration-300 focus-within:bg-white/15 focus-within:shadow-[0_0_0_4px_rgba(255,255,255,0.1)] focus-within:scale-105">
                  <Searchbar />
                </div>
              </div>
            )}

            {/* User navigation - no border, smaller */}
            <div className="absolute right-4">
              <div className="p-1.5 bg-white/[0.05] backdrop-blur-md rounded-lg transition-all duration-300 hover:bg-white/[0.12] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.1)]">
                <UserNav />
              </div>
            </div>
          </div>

          {/* Mobile search - no border, smaller */}
          {process.env.COMMERCE_SEARCH_ENABLED && (
            <div className="flex justify-center pb-2 lg:hidden">
              <div className="w-full max-w-sm bg-white/[0.08] backdrop-blur-md rounded-xl p-1 transition-all duration-300 focus-within:bg-white/15 focus-within:shadow-[0_0_0_4px_rgba(255,255,255,0.1)]">
                <Searchbar id="mobile-search" />
              </div>
            </div>
          )}
        </Container>
      </div>
    </NavbarRoot>
  )
}

export default Navbar
