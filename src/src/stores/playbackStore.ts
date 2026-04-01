import { create } from 'zustand'
import type { ApiTrack } from '../lib/api'

export type QueueTrack = {
  id: number
  title: string
  artistName: string
  albumTitle: string
  albumId: number
  streamUrl: string
  durationSeconds: number | null
  coverUrl?: string | null
}

function toQueueTrack(t: ApiTrack, coverUrl?: string | null): QueueTrack {
  return {
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    albumTitle: t.albumTitle,
    albumId: t.albumId,
    streamUrl: t.streamUrl,
    durationSeconds: t.durationSeconds,
    coverUrl: t.albumCoverUrl ?? coverUrl ?? null,
  }
}

type PlaybackState = {
  queue: QueueTrack[]
  currentIndex: number
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  pendingSeek: number | null
  currentTrack: () => QueueTrack | null
  playQueueFromApi: (tracks: ApiTrack[], startIndex: number, coverUrl?: string | null) => void
  pause: () => void
  resume: () => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  setVolume: (v: number) => void
  setProgress: (t: number) => void
  setDuration: (d: number) => void
  clearSeek: () => void
  seek: (seconds: number) => void
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  volume: 0.85,
  currentTime: 0,
  duration: 0,
  pendingSeek: null,

  currentTrack: () => {
    const { queue, currentIndex } = get()
    return queue[currentIndex] ?? null
  },

  playQueueFromApi: (tracks, startIndex, coverUrl) => {
    const queue = tracks.map((t) => toQueueTrack(t, coverUrl))
    set({
      queue,
      currentIndex: startIndex,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
      pendingSeek: 0,
    })
  },

  pause: () => set({ isPlaying: false }),

  resume: () => set({ isPlaying: true }),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentIndex } = get()
    if (currentIndex < queue.length - 1) {
      set({
        currentIndex: currentIndex + 1,
        currentTime: 0,
        duration: 0,
        pendingSeek: 0,
      })
    } else {
      set({ isPlaying: false })
    }
  },

  prev: () => {
    const { currentIndex, currentTime } = get()
    if (currentTime > 3) {
      set({ currentTime: 0, pendingSeek: 0 })
      return
    }
    if (currentIndex > 0) {
      set({
        currentIndex: currentIndex - 1,
        currentTime: 0,
        duration: 0,
        pendingSeek: 0,
      })
    }
  },

  setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),

  setProgress: (t) => set({ currentTime: t }),

  setDuration: (d) => set({ duration: d }),

  clearSeek: () => set({ pendingSeek: null }),

  seek: (seconds) => set({ pendingSeek: seconds, currentTime: seconds }),
}))
