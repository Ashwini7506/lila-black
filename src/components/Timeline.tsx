'use client'

function fmt(secs: number) {
  const s = Math.floor(secs)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  currentTime: number
  isPlaying: boolean
  speed: number
  minTime: number
  maxTime: number
  duration: number
  matchCount: number
  onTogglePlay: () => void
  onSeek: (t: number) => void
  onSetSpeed: (s: number) => void
}

export default function Timeline({
  currentTime, isPlaying, speed, minTime, maxTime, duration,
  matchCount, onTogglePlay, onSeek, onSetSpeed,
}: Props) {
  const progress = duration > 0 ? (currentTime - minTime) / duration : 0
  const multi = matchCount > 1

  if (multi) {
    return (
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-3 flex items-center justify-center">
        <span className="text-xs text-gray-500">
          Timeline disabled — showing all events across {matchCount} matches
        </span>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border-t border-gray-700 px-4 py-3 flex items-center gap-4">
      {/* Rewind */}
      <button
        onClick={() => onSeek(minTime)}
        className="text-gray-400 hover:text-white transition-colors text-lg"
        title="Rewind"
      >
        ⏮
      </button>

      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        disabled={duration === 0}
        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-sm transition-colors"
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Timestamp */}
      <span className="text-gray-400 text-xs font-mono w-24 shrink-0">
        {fmt(currentTime - minTime)} / {fmt(duration)}
      </span>

      {/* Scrubber */}
      <div className="flex-1 relative h-6 flex items-center">
        <div className="w-full h-1 bg-gray-700 rounded-full relative">
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <input
          type="range"
          min={minTime}
          max={maxTime}
          step={100}
          value={currentTime}
          disabled={duration === 0}
          onChange={e => onSeek(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      {/* Speed selector */}
      <div className="flex gap-1 shrink-0">
        {[0.5, 1, 2, 4, 10].map(s => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              speed === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
