'use client';

import { useState, useEffect } from 'react';

type AppEnvironment = 'development' | 'preview' | 'production';

const CONFIG = {
  development: {
    label: 'DEV',
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
  },
  preview: {
    label: 'PREVIEW',
    bgColor: 'bg-amber-500',
    textColor: 'text-black',
  },
} as const;

/**
 * Environment Badge Component
 * 
 * Displays a visual indicator of the current environment.
 * Only shows in non-production environments to help developers
 * and testers identify which environment they're using.
 */
export function EnvironmentBadge() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until client-side to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  const environment = (process.env.NEXT_PUBLIC_APP_ENV || 'development') as AppEnvironment;

  // Don't show badge in production
  if (environment === 'production') {
    return null;
  }

  const config = CONFIG[environment];
  if (!config) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div
        className={`
          ${config.bgColor} ${config.textColor}
          px-3 py-1.5 rounded-full
          text-xs font-bold uppercase tracking-wider
          shadow-lg
          animate-pulse
        `}
      >
        {config.label}
      </div>
    </div>
  );
}
