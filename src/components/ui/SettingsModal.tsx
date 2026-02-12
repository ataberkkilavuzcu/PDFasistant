'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db';

const PREFERENCES_ID = 'user-preferences';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Preferences {
  fontSize: number; // PDF viewer font scale (percentage)
  contextWindowSize: number; // ±pages for AI context
}

const DEFAULT_PREFERENCES: Preferences = {
  fontSize: 100,
  contextWindowSize: 3,
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);

  // Load preferences on open
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const stored = await db.preferences.get(PREFERENCES_ID);
        if (stored) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const storedAny = stored as any;
          setPrefs({
            fontSize: storedAny.fontSize || DEFAULT_PREFERENCES.fontSize,
            contextWindowSize: stored.contextWindowSize || DEFAULT_PREFERENCES.contextWindowSize,
          });
        }
      } catch {
        // Use defaults
      }
    })();
  }, [isOpen]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const existing = await db.preferences.get(PREFERENCES_ID);
      const prefsToSave = {
        id: PREFERENCES_ID,
        theme: existing?.theme || 'system' as const,
        contextWindowSize: prefs.contextWindowSize,
        lastOpenedDocumentId: existing?.lastOpenedDocumentId,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prefsToSave as any).fontSize = prefs.fontSize;
      await db.preferences.put(prefsToSave);
      // Apply font size to CSS variable
      document.documentElement.style.setProperty('--pdf-font-scale', String(prefs.fontSize / 100));
      onClose();
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  }, [prefs, onClose]);

  // Apply font size on load
  useEffect(() => {
    document.documentElement.style.setProperty('--pdf-font-scale', String(prefs.fontSize / 100));
  }, [prefs.fontSize]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-[#0f1419] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* PDF Font Size */}
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">PDF Text Size</span>
              <span className="text-sm text-emerald-400 font-mono">{prefs.fontSize}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={prefs.fontSize}
              onChange={(e) => setPrefs((p) => ({ ...p, fontSize: Number(e.target.value) }))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>50%</span>
              <span>100%</span>
              <span>200%</span>
            </div>
          </div>

          {/* AI Context Window */}
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">AI Context Window</span>
              <span className="text-sm text-emerald-400 font-mono">±{prefs.contextWindowSize} pages</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={prefs.contextWindowSize}
              onChange={(e) => setPrefs((p) => ({ ...p, contextWindowSize: Number(e.target.value) }))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <p className="text-xs text-gray-500">
              Number of surrounding pages sent to AI for context. More pages = better answers but slower.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

