import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { APP_NAME, APP_TAGLINE } from '../app/config'
import { LogoMark } from './Logo'
import { cn } from './ui'

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark className="h-10 w-10 shrink-0 text-forest-600" />
      <div className="leading-tight">
        <div className="font-display text-xl font-semibold text-ink">{APP_NAME}</div>
        <div className="text-[11px] tracking-wide text-muted">{APP_TAGLINE}</div>
      </div>
    </div>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors',
    isActive ? 'bg-forest-50 text-forest-700 font-medium' : 'text-muted hover:bg-paper hover:text-ink',
  )

const items = [
  { to: '/today', label: 'Сегодня', end: true },
  { to: '/', label: 'Проекты', end: true },
  { to: '/install', label: 'На устройство', end: false },
]

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px]">
        <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-line px-5 py-7 lg:flex">
          <NavLink to="/" className="rounded-xl focus-visible:outline-none">
            <Logo />
          </NavLink>

          <nav className="mt-10 space-y-1">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-2 pt-8 text-xs leading-relaxed text-muted">
            <p>Проекты хранятся на этом устройстве. Ничего не отправляется в интернет.</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
            <NavLink to="/">
              <Logo />
            </NavLink>
            <div className="flex flex-wrap justify-end gap-1">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 lg:px-10 lg:py-10 xl:px-14">{children}</main>
        </div>
      </div>
    </div>
  )
}
