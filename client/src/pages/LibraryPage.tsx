import { useCallback, useState } from 'react'
import { AlbumGrid } from '../components/AlbumGrid'
import { ImportSection } from '../components/ImportSection'

export function LibraryPage() {
  const [gridKey, setGridKey] = useState(0)
  const refresh = useCallback(() => setGridKey((k) => k + 1), [])

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-white">Biblioteca</h2>
      <ImportSection onImported={refresh} />
      <h3 className="mb-4 text-lg font-medium text-gray-300">Álbuns</h3>
      <AlbumGrid key={gridKey} />
    </div>
  )
}
