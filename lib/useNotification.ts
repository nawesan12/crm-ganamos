import { useCallback } from 'react';
import { toast } from 'sonner';
import { soundManager, NotificationType } from './sound-notifications';
import { useNotificationSettings } from '@/stores/notification-settings-store';

/**
 * Custom hook that combines toast notifications with sound
 * Replaces direct usage of toast.success, toast.error, etc.
 */
export function useNotification() {
  const { getEffectiveVolume } = useNotificationSettings();

  const playNotificationSound = useCallback(
    (type: NotificationType) => {
      const volume = getEffectiveVolume(type);
      if (volume > 0) {
        soundManager.playSound(type, volume);
      }
    },
    [getEffectiveVolume]
  );

  const success = useCallback(
    (message: string, data?: any) => {
      playNotificationSound('success');
      return toast.success(message, data);
    },
    [playNotificationSound]
  );

  const error = useCallback(
    (message: string, data?: any) => {
      playNotificationSound('error');
      return toast.error(message, data);
    },
    [playNotificationSound]
  );

  const warning = useCallback(
    (message: string, data?: any) => {
      playNotificationSound('warning');
      return toast.warning(message, data);
    },
    [playNotificationSound]
  );

  const info = useCallback(
    (message: string, data?: any) => {
      playNotificationSound('info');
      return toast.info(message, data);
    },
    [playNotificationSound]
  );

  // Loading doesn't play a sound
  const loading = useCallback((message: string, data?: any) => {
    return toast.loading(message, data);
  }, []);

  // Generic toast without sound
  const message = useCallback((message: string, data?: any) => {
    return toast(message, data);
  }, []);

  // Promise toast (useful for async operations)
  const promise = useCallback(
    <T,>(
      promise: Promise<T>,
      options: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      }
    ) => {
      const toastPromise = toast.promise(promise, options);

      // Play sounds when promise resolves/rejects
      promise
        .then(() => {
          playNotificationSound('success');
        })
        .catch(() => {
          playNotificationSound('error');
        });

      return toastPromise;
    },
    [playNotificationSound]
  );

  return {
    success,
    error,
    warning,
    info,
    loading,
    message,
    promise,
    // Expose dismiss for compatibility
    dismiss: toast.dismiss,
  };
}
