import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'

export function AudioBridge() {
  const ref = useRef<HTMLAudioElement>(null)
  const queue = usePlaybackStore((s) => s.queue)
  const currentIndex = usePlaybackStore((s) => s.currentIndex)
  const volume = usePlaybackStore((s) => s.volume)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const setProgress = usePlaybackStore((s) => s.setProgress)
  const setDuration = usePlaybackStore((s) => s.setDuration)
  const next = usePlaybackStore((s) => s.next)
  const pendingSeek = usePlaybackStore((s) => s.pendingSeek)
  const clearSeek = usePlaybackStore((s) => s.clearSeek)

  const track = queue[currentIndex] ?? null

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!track) {
      el.pause()
      el.removeAttribute('src')
      el.load()
      return
    }
    el.src = track.streamUrl
  }, [track?.id, track?.streamUrl, track])

  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    el.volume = volume
  }, [volume, track])

  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    if (isPlaying) void el.play().catch(() => {})
    else el.pause()
  }, [isPlaying, track])

  useEffect(() => {
    const el = ref.current
    if (!el || pendingSeek == null) return
    el.currentTime = pendingSeek
    clearSeek()
  }, [pendingSeek, clearSeek, track?.id])

  return (
    <audio
      ref={ref}
      className="hidden"
      preload="metadata"
      onTimeUpdate={() => setProgress(ref.current?.currentTime ?? 0)}
      onLoadedMetadata={() => setDuration(ref.current?.duration ?? 0)}
      onEnded={() => next()}
    />
  )
}
