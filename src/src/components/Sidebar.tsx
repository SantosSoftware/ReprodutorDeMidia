import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
    isActive
      ? 'bg-white/10 text-white shadow-sm'
      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
  ].join(' ')

export function Sidebar() {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#141414]/90 backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-5">
        <h1 className="text-base font-semibold tracking-tight text-white">Auralis</h1>
        <p className="mt-0.5 text-xs text-gray-500">Biblioteca local</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        <NavLink to="/" end className={linkClass}>
          <LibraryIcon />
          Biblioteca
        </NavLink>
        <NavLink to="/artists" className={linkClass}>
          <ArtistsIcon />
          Artistas
        </NavLink>
        <NavLink to="/albums" className={linkClass}>
          <AlbumsIcon />
          Álbuns
        </NavLink>
        <NavLink to="/songs" className={linkClass}>
          <SongsIcon />
          Músicas
        </NavLink>
        <NavLink to="/playlists" className={linkClass}>
          <PlaylistIcon />
          Playlists
        </NavLink>
      </nav>
    </aside>
  )
}

function LibraryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4h-4V9h4V5h2v4h4v2z" />
    </svg>
  )
}

function ArtistsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  )
}

function AlbumsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  )
}

function SongsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
      <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
    </svg>
  )
}

function PlaylistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-80">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </svg>
  )
}
