// Notification sound utility using Web Audio API
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioContext
}

export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext()

    // Resume audio context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Create a pleasant notification sound
    oscillator.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
    oscillator.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.1) // C6 note

    oscillator.type = 'sine'

    // Envelope: quick attack, short decay
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.2)
  } catch (error) {
    // Silently fail if audio is not available
    console.debug('Could not play notification sound:', error)
  }
}

// Check if sound is enabled (stored in localStorage)
const SOUND_ENABLED_KEY = 'sleck_notification_sound_enabled'

export function isNotificationSoundEnabled(): boolean {
  const stored = localStorage.getItem(SOUND_ENABLED_KEY)
  return stored !== 'false' // Default to true
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled))
}

export function playNotificationSoundIfEnabled(): void {
  if (isNotificationSoundEnabled()) {
    playNotificationSound()
  }
}
