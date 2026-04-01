import { Link } from 'react-router-dom'

export function PlaylistsPage() {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-white">Playlists</h2>
      <p className="mb-6 max-w-lg text-sm leading-relaxed text-gray-500">
        Playlists automáticas e, no futuro, as suas listas personalizadas.
      </p>
      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#252525]/80">
        <li>
          <Link
            to="/playlists/top-50"
            className="flex items-center justify-between px-4 py-4 text-sm text-white transition hover:bg-white/5"
          >
            <span className="font-medium">Top 50 reproduções</span>
            <span className="text-xs text-gray-500">Automática</span>
          </Link>
        </li>
        <li>
          <Link
            to="/playlists/recent"
            className="flex items-center justify-between px-4 py-4 text-sm text-white transition hover:bg-white/5"
          >
            <span className="font-medium">Últimas reproduções</span>
            <span className="text-xs text-gray-500">Automática · até 50</span>
          </Link>
        </li>
      </ul>
    </div>
  )
}
