'use client'

import Link from 'next/link'
import {
  LogOut,
  Shield,
  LayoutDashboard,
  Target,
  ClipboardList,
  Inbox,
  Users,
  Settings,
  ScrollText,
  Building2,
  Gavel,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

interface DashboardSidebarUser {
  username: string
  role: string
}

interface DashboardSidebarProps {
  user: DashboardSidebarUser
  remainingBudget: number
  isSidebarOpen: boolean
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  onLogout: () => Promise<void> | void
}

const formatUsername = (name: string) => {
  if (!name) return ''
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export default function DashboardSidebar({
  user,
  remainingBudget,
  isSidebarOpen,
  setIsSidebarOpen,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  onLogout,
}: DashboardSidebarProps) {
  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-slate-900/95 md:bg-slate-900/95
          border-r border-slate-800
          shadow-xl
          transition-all duration-300 ease-in-out
          flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
          ${isSidebarOpen ? 'md:w-64' : 'md:w-[76px]'}
        `}
      >
        <div className="relative p-3 md:p-4">
          <div
            className={`relative flex items-center ${
              isSidebarOpen ? 'justify-between' : 'md:justify-center'
            } justify-between min-h-10`}
          >
            <div
              className={`flex items-center ${
                isSidebarOpen ? 'gap-3' : 'md:justify-center'
              } gap-3 min-w-0`}
            >
              <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Gavel className="w-5 h-5" />
              </div>

              {(isSidebarOpen || isMobileMenuOpen) && (
                <div className="min-w-0">
                  <h1 className="font-extrabold text-base tracking-tight text-white leading-tight">
                    FantAsta
                  </h1>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Aste Live
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            {isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                aria-label="Comprimi barra laterale"
                className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {!isSidebarOpen && (
            <div className="hidden md:flex justify-center mt-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                aria-label="Espandi barra laterale"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-800"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <nav className="space-y-1.5">
            <Link
              href="/"
              title={!isSidebarOpen ? 'Dashboard' : undefined}
              className={`
                flex items-center
                ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                h-11
                rounded-xl
                text-sm font-semibold
                text-white
                bg-blue-600
                shadow-md shadow-blue-600/20
                transition-all
              `}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />

              {(isSidebarOpen || isMobileMenuOpen) && (
                <span className="truncate">Dashboard</span>
              )}
            </Link>

            <Link
              href="/rosa"
              title={!isSidebarOpen ? 'La Mia Squadra' : undefined}
              className={`
                flex items-center
                ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                h-11
                rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
              `}
            >
              <Shield className="w-4 h-4 shrink-0 text-emerald-400" />

              {(isSidebarOpen || isMobileMenuOpen) && (
                <span className="truncate">La Mia Squadra</span>
              )}
            </Link>

            <Link
              href="/obiettivi"
              title={!isSidebarOpen ? 'I Miei Obiettivi' : undefined}
              className={`
                flex items-center
                ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                h-11
                rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
              `}
            >
              <Target className="w-4 h-4 shrink-0 text-amber-400" />

              {(isSidebarOpen || isMobileMenuOpen) && (
                <span className="truncate">I Miei Obiettivi</span>
              )}
            </Link>

            <Link
              href="/listone"
              title={!isSidebarOpen ? 'Listone' : undefined}
              className={`
                flex items-center
                ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                h-11
                rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
              `}
            >
              <ClipboardList className="w-4 h-4 shrink-0" />

              {(isSidebarOpen || isMobileMenuOpen) && (
                <span className="truncate">Listone</span>
              )}
            </Link>

            {user.role === 'admin' && (
              <div className="pt-4 mt-4 border-t border-slate-800">
                {(isSidebarOpen || isMobileMenuOpen) && (
                  <span className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Pannello Admin
                  </span>
                )}

                <Link
                  href="/admin/import-listone"
                  title={!isSidebarOpen ? 'Importa Listone' : undefined}
                  className={`
                    flex items-center
                    ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                    h-10
                    rounded-xl
                    text-sm font-semibold
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                  `}
                >
                  <Inbox className="w-4 h-4 shrink-0" />

                  {(isSidebarOpen || isMobileMenuOpen) && (
                    <span className="truncate">Importa Listone</span>
                  )}
                </Link>

                <Link
                  href="/admin/users"
                  title={!isSidebarOpen ? 'Gestione Partecipanti' : undefined}
                  className={`
                    flex items-center
                    ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                    h-10
                    rounded-xl
                    text-sm font-semibold
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                  `}
                >
                  <Users className="w-4 h-4 shrink-0" />

                  {(isSidebarOpen || isMobileMenuOpen) && (
                    <span className="truncate">Gestione Partecipanti</span>
                  )}
                </Link>

                <Link
                  href="/admin/settings"
                  title={!isSidebarOpen ? 'Configurazione Lega' : undefined}
                  className={`
                    flex items-center
                    ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                    h-10
                    rounded-xl
                    text-sm font-semibold
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                  `}
                >
                  <Settings className="w-4 h-4 shrink-0" />

                  {(isSidebarOpen || isMobileMenuOpen) && (
                    <span className="truncate">Configurazione Lega</span>
                  )}
                </Link>

                {(isSidebarOpen || isMobileMenuOpen) && (
                  <span className="px-2 pt-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Anagrafiche
                  </span>
                )}

                <Link
                  href="/admin/anagrafiche/serie-a"
                  title={!isSidebarOpen ? 'Squadre Serie A' : undefined}
                  className={`
                    flex items-center
                    ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                    h-9
                    rounded-xl
                    text-xs font-semibold
                    text-slate-400
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                  `}
                >
                  <ScrollText className="w-4 h-4 shrink-0" />

                  {(isSidebarOpen || isMobileMenuOpen) && (
                    <span className="truncate">Squadre Serie A</span>
                  )}
                </Link>

                <Link
                  href="/admin/anagrafiche/squadre_lega"
                  title={!isSidebarOpen ? 'Squadre Lega' : undefined}
                  className={`
                    flex items-center
                    ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
                    h-9
                    rounded-xl
                    text-xs font-semibold
                    text-slate-400
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                  `}
                >
                  <Building2 className="w-4 h-4 shrink-0" />

                  {(isSidebarOpen || isMobileMenuOpen) && (
                    <span className="truncate">Squadre Lega</span>
                  )}
                </Link>
              </div>
            )}
          </nav>
        </div>

        <div className="mt-auto p-3 md:p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            type="button"
            title={!isSidebarOpen ? 'Esci' : undefined}
            className={`
              w-full
              flex items-center
              ${isSidebarOpen || isMobileMenuOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
              h-11
              rounded-xl
              text-sm font-semibold
              text-red-400
              hover:text-red-300
              hover:bg-red-500/10
              transition-all
              cursor-pointer
            `}
          >
            <LogOut className="w-4 h-4 shrink-0" />

            {(isSidebarOpen || isMobileMenuOpen) && <span>Esci</span>}
          </button>
        </div>
      </aside>

      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white"
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>
          <span className="font-extrabold text-sm text-white">FantAsta</span>
        </div>
        <span className="text-xs font-bold text-blue-400">{formatUsername(user.username)}</span>
      </div>
    </>
  )
}
