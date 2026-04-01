import { useEffect, useRef } from 'react'
import { registerTrackPlay } from '../lib/api'
import { usePlaybackStore } from '../stores/playbackStore'

const PLAY_THRESHOLD_SEC = 15

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
  const playCountedRef = useRef(false)
  const lastTimeRef = useRef(0)

  useEffect(() => {
    playCountedRef.current = false
    lastTimeRef.current = 0
  }, [track?.id])

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

  function tryRegisterPlay(trackId: number) {
    if (playCountedRef.current) return
    playCountedRef.current = true
    void registerTrackPlay(trackId).catch(() => {})
  }

  function handleTimeUpdate() {
    const el = ref.current
    const t = el?.currentTime ?? 0
    const dur = el?.duration
    setProgress(t)

    if (!track) return

    if (t < 0.5 && lastTimeRef.current > 5) {
      playCountedRef.current = false
    }
    lastTimeRef.current = t

    if (playCountedRef.current) return
    if (typeof dur !== 'number' || !Number.isFinite(dur) || dur <= 0) return

    if (dur >= PLAY_THRESHOLD_SEC && t >= PLAY_THRESHOLD_SEC) {
      tryRegisterPlay(track.id)
    }
  }

  function handleEnded() {
    const el = ref.current
    const d = el?.duration ?? 0
    if (track && !playCountedRef.current && Number.isFinite(d) && d > 0 && d < PLAY_THRESHOLD_SEC) {
      tryRegisterPlay(track.id)
    }
    next()
  }

  return (
    <audio
      ref={ref}
      className="hidden"
      preload="metadata"
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={() => setDuration(ref.current?.duration ?? 0)}
      onEnded={handleEnded}
    />
  )
}
