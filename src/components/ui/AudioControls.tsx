import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { sounds } from '../../utils/audio';

export function AudioControls({ compact = false }: { compact?: boolean }) {
  const [settings, setSettings] = useState(() => ({ enabled: sounds.isEnabled(), volume: sounds.getVolume() }));
  useEffect(() => sounds.subscribe(() => setSettings({ enabled: sounds.isEnabled(), volume: sounds.getVolume() })), []);
  return <div className={compact ? 'audio-quick-control' : 'audio-settings'}>
    <button type="button" className="royal-icon" aria-label={settings.enabled ? 'Mute sound effects' : 'Unmute sound effects'}
      aria-pressed={!settings.enabled} onClick={() => sounds.setEnabled(!settings.enabled)} title={settings.enabled ? 'Mute sound effects' : 'Unmute sound effects'}>
      {settings.enabled ? <Volume2 /> : <VolumeX />}
    </button>
    {!compact && <label>Effects volume <span>{Math.round(settings.volume * 100)}%</span>
      <input aria-label="Effects volume" type="range" min="0" max="1" step="0.05" value={settings.volume}
        onChange={event => sounds.setVolume(Number(event.target.value))} />
    </label>}
  </div>;
}
