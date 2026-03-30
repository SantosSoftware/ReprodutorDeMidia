import { usePlaybackStore } from '../stores/playbackStore'
import { formatDuration } from '../lib/format'

export function PlayerBar() {
  const currentTrack = usePlaybackStore((s) => s.currentTrack())
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const togglePlay = usePlaybackStore((s) => s.togglePlay)
  const next = usePlaybackStore((s) => s.next)
  const prev = usePlaybackStore((s) => s.prev)
  const volume = usePlaybackStore((s) => s.volume)
  const setVolume = usePlaybackStore((s) => s.setVolume)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const duration = usePlaybackStore((s) => s.duration)
  const seek = usePlaybackStore((s) => s.seek)

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <footer className="flex h-[88px] shrink-0 items-center gap-4 border-t border-white/10 bg-[#1a1a1a]/95 px-4 shadow-[0_-4px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#2d2d2d] shadow-inner ring-1 ring-white/10">
          {currentTrack?.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl text-white/25">
              ♪
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {currentTrack?.title ?? 'Nada em reprodução'}
          </p>
          <p className="truncate text-xs text-gray-400">
            {currentTrack
              ? `${currentTrack.artistName} — ${currentTrack.albumTitle}`
              : 'Importe uma pasta de música para começar'}
          </p>
        </div>
      </div>

      <div className="flex max-w-xl flex-[2] flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => prev()}
            className="rounded-full p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Anterior"
          >
            <SkipBackIcon />
          </button>
          <button
            type="button"
            onClick={() => togglePlay()}
            disabled={!currentTrack}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#1c1c1c] shadow-md transition enabled:hover:bg-white disabled:opacity-40"
            aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={() => next()}
            className="rounded-full p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Seguinte"
          >
            <SkipForwardIcon />
          </button>
        </div>
        <div className="flex w-full items-center gap-2 text-xs text-gray-500">
          <span className="w-10 tabular-nums">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={(e) => {
              const p = Number(e.target.value) / 100
              seek(p * (duration || 0))
            }}
            disabled={!currentTrack || !duration}
            className="h-1 flex-1 cursor-pointer accent-[#60cdff] disabled:opacity-40"
          />
          <span className="w-10 tabular-nums text-right">{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="flex min-w-[120px] max-w-[180px] flex-1 items-center justify-end gap-2">
        <VolumeIcon />
        <input
          type="range"
          min={0}
          max={100}
          value={volume * 100}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="h-1 w-full cursor-pointer accent-[#60cdff]"
          aria-label="Volume"
        />
      </div>
    </footer>
  )
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function SkipBackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6l-8.5 6z" />
    </svg>
  )
}

function SkipForwardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 18l8.5-6L6 6v12zm9.5-12v12l8.5-6-8.5-6z" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0 text-gray-400"
      aria-hidden
    >
      <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  )
}
