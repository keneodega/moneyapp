'use client';

import { useEffect, useState } from 'react';

type AppEnvironment = 'development' | 'preview' | 'production';

/**
 * Environment Badge Component
 * 
 * Displays a visual indicator of the current environment.
 * Only shows in non-production environments to help developers
 * and testers identify which environment they're using.
 */
export function EnvironmentBadge() {
  const [environment, setEnvironment] = useState<AppEnvironment | null>(null);

  useEffect(() => {
    // Read environment on client side
    const env = process.env.NEXT_PUBLIC_APP_ENV as AppEnvironment;
    setEnvironment(env || 'development');
  }, []);

  // Don't show badge in production or before hydration
  if ( !environment || environment === 'production') {
    return null;
  }

  const config = {
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
  }[environment];

  if ( !config) return null;

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
