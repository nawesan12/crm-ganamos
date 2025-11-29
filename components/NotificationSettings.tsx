'use client';

import { useState } from 'react';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useNotificationSettings } from '@/stores/notification-settings-store';
import { soundManager, NotificationType } from '@/lib/sound-notifications';

export function NotificationSettings() {
  const {
    volume,
    soundEnabled,
    setVolume,
    toggleSoundType,
    enableAllSounds,
    disableAllSounds,
  } = useNotificationSettings();

  const [open, setOpen] = useState(false);

  const allEnabled = Object.values(soundEnabled).every(Boolean);
  const allDisabled = Object.values(soundEnabled).every((v) => !v);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const testSound = (type: NotificationType) => {
    if (soundEnabled[type]) {
      soundManager.playSound(type, volume);
    }
  };

  const notificationTypes: { type: NotificationType; label: string; color: string }[] = [
    { type: 'success', label: 'Success', color: 'text-green-600' },
    { type: 'error', label: 'Error', color: 'text-red-600' },
    { type: 'warning', label: 'Warning', color: 'text-yellow-600' },
    { type: 'info', label: 'Info', color: 'text-blue-600' },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label="Notification settings"
        >
          <Bell className="h-5 w-5" />
          {allDisabled && (
            <div className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Notification Sounds</h4>
            <p className="text-sm text-muted-foreground">
              Configure sound alerts for notifications
            </p>
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                {volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                Volume
              </label>
              <span className="text-sm text-muted-foreground">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={enableAllSounds}
              disabled={allEnabled}
              className="flex-1 text-xs"
            >
              Enable All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={disableAllSounds}
              disabled={allDisabled}
              className="flex-1 text-xs"
            >
              Disable All
            </Button>
          </div>

          {/* Per-type Controls */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notification Types</label>
            <div className="space-y-2">
              {notificationTypes.map(({ type, label, color }) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`sound-${type}`}
                      className="relative flex items-center cursor-pointer"
                    >
                      <input
                        id={`sound-${type}`}
                        type="checkbox"
                        checked={soundEnabled[type]}
                        onChange={() => toggleSoundType(type)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className={`text-sm font-medium ${color}`}>
                      {label}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => testSound(type)}
                    disabled={!soundEnabled[type]}
                    className="text-xs h-7 px-2"
                  >
                    Test
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground">
            Sound settings are saved in your browser
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
