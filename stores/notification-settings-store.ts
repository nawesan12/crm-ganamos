import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NotificationType } from '@/lib/sound-notifications';

interface NotificationSettings {
  // Global volume (0 to 1)
  volume: number;

  // Per-type sound enable/disable
  soundEnabled: {
    success: boolean;
    error: boolean;
    warning: boolean;
    info: boolean;
  };
}

interface NotificationSettingsStore extends NotificationSettings {
  // Actions
  setVolume: (volume: number) => void;
  toggleSoundType: (type: NotificationType) => void;
  setSoundType: (type: NotificationType, enabled: boolean) => void;
  enableAllSounds: () => void;
  disableAllSounds: () => void;
  resetToDefaults: () => void;

  // Getters
  isSoundEnabled: (type: NotificationType) => boolean;
  getEffectiveVolume: (type: NotificationType) => number;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  volume: 0.5,
  soundEnabled: {
    success: true,
    error: true,
    warning: true,
    info: true,
  },
};

export const useNotificationSettings = create<NotificationSettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...DEFAULT_SETTINGS,

      // Set global volume (0 to 1)
      setVolume: (volume: number) => {
        const normalizedVolume = Math.max(0, Math.min(1, volume));
        set({ volume: normalizedVolume });
      },

      // Toggle a specific notification type sound
      toggleSoundType: (type: NotificationType) => {
        set((state) => ({
          soundEnabled: {
            ...state.soundEnabled,
            [type]: !state.soundEnabled[type],
          },
        }));
      },

      // Set a specific notification type sound
      setSoundType: (type: NotificationType, enabled: boolean) => {
        set((state) => ({
          soundEnabled: {
            ...state.soundEnabled,
            [type]: enabled,
          },
        }));
      },

      // Enable all notification sounds
      enableAllSounds: () => {
        set({
          soundEnabled: {
            success: true,
            error: true,
            warning: true,
            info: true,
          },
        });
      },

      // Disable all notification sounds
      disableAllSounds: () => {
        set({
          soundEnabled: {
            success: false,
            error: false,
            warning: false,
            info: false,
          },
        });
      },

      // Reset to default settings
      resetToDefaults: () => {
        set(DEFAULT_SETTINGS);
      },

      // Check if a specific notification type sound is enabled
      isSoundEnabled: (type: NotificationType) => {
        return get().soundEnabled[type];
      },

      // Get the effective volume for a notification type
      // Returns 0 if disabled, otherwise returns the global volume
      getEffectiveVolume: (type: NotificationType) => {
        const state = get();
        return state.soundEnabled[type] ? state.volume : 0;
      },
    }),
    {
      name: 'notification-settings',
      // Only persist the settings, not the functions
      partialize: (state) => ({
        volume: state.volume,
        soundEnabled: state.soundEnabled,
      }),
    }
  )
);
