/**
 * Sound notification utility using Web Audio API
 * Generates beep sounds for different notification types
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface BeepConfig {
  frequency: number;  // Hz
  duration: number;   // seconds
  type: OscillatorType;
}

// Different beep configurations for each notification type
const BEEP_CONFIGS: Record<NotificationType, BeepConfig> = {
  success: {
    frequency: 800,   // Higher, pleasant tone
    duration: 0.15,
    type: 'sine'
  },
  error: {
    frequency: 200,   // Lower, alert tone
    duration: 0.3,
    type: 'sawtooth'
  },
  warning: {
    frequency: 500,   // Medium tone
    duration: 0.2,
    type: 'square'
  },
  info: {
    frequency: 600,   // Gentle notification
    duration: 0.12,
    type: 'sine'
  }
};

class SoundNotificationManager {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  /**
   * Initialize the audio context
   * Must be called after user interaction due to browser autoplay policies
   */
  public initialize(): void {
    if (this.isInitialized) return;

    try {
      // Create audio context (works in all modern browsers)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  /**
   * Play a notification sound
   */
  public playSound(type: NotificationType, volume: number = 0.3): void {
    // Ensure audio context is initialized
    if (!this.isInitialized) {
      this.initialize();
    }

    if (!this.audioContext) {
      console.warn('Audio context not available');
      return;
    }

    // Ensure volume is between 0 and 1
    const normalizedVolume = Math.max(0, Math.min(1, volume));

    if (normalizedVolume === 0) {
      return; // Don't play if volume is 0
    }

    try {
      const config = BEEP_CONFIGS[type];
      const currentTime = this.audioContext.currentTime;

      // Create oscillator (tone generator)
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.frequency, currentTime);

      // Create gain node (volume control)
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(normalizedVolume, currentTime);

      // Add fade out to prevent clicking sound
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        currentTime + config.duration
      );

      // Connect nodes: oscillator -> gain -> destination (speakers)
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Play the sound
      oscillator.start(currentTime);
      oscillator.stop(currentTime + config.duration);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  /**
   * Play a double beep for success (more celebratory)
   */
  public playSuccessDouble(volume: number = 0.3): void {
    this.playSound('success', volume);
    setTimeout(() => {
      this.playSound('success', volume * 0.8);
    }, 100);
  }

  /**
   * Resume audio context if suspended (iOS Safari workaround)
   */
  public async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }
  }

  /**
   * Check if audio is supported
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' &&
           (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');
  }
}

// Export singleton instance
export const soundManager = new SoundNotificationManager();

// Auto-initialize on first user interaction
if (typeof window !== 'undefined') {
  const initOnInteraction = () => {
    soundManager.initialize();
    // Remove listeners after first interaction
    document.removeEventListener('click', initOnInteraction);
    document.removeEventListener('keydown', initOnInteraction);
    document.removeEventListener('touchstart', initOnInteraction);
  };

  document.addEventListener('click', initOnInteraction, { once: true });
  document.addEventListener('keydown', initOnInteraction, { once: true });
  document.addEventListener('touchstart', initOnInteraction, { once: true });
}
