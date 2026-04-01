import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AlbumPage } from './pages/AlbumPage'
import { AlbumsPage } from './pages/AlbumsPage'
import { ArtistPage } from './pages/ArtistPage'
import { ArtistsPage } from './pages/ArtistsPage'
import { LibraryPage } from './pages/LibraryPage'
import { PlaylistsPage } from './pages/PlaylistsPage'
import { SongsPage } from './pages/SongsPage'
import { RecentTracksPage } from './pages/RecentTracksPage'
import { TopTracksPage } from './pages/TopTracksPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LibraryPage />} />
          <Route path="albums" element={<AlbumsPage />} />
          <Route path="album/:id" element={<AlbumPage />} />
          <Route path="songs" element={<SongsPage />} />
          <Route path="artists" element={<ArtistsPage />} />
          <Route path="artist/:id" element={<ArtistPage />} />
          <Route path="playlists" element={<PlaylistsPage />} />
          <Route path="playlists/top-50" element={<TopTracksPage />} />
          <Route path="playlists/recent" element={<RecentTracksPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
