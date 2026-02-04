'use client';

import { useEffect, useState } from 'react';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showLabel?: boolean;
  animated?: boolean;
}

const sizes = {
  sm: { width: 80, strokeWidth: 6, fontSize: '1rem', labelSize: '0.625rem' },
  md: { width: 120, strokeWidth: 8, fontSize: '1.5rem', labelSize: '0.75rem' },
  lg: { width: 160, strokeWidth: 10, fontSize: '2rem', labelSize: '0.875rem' },
};

function getScoreColor(score: number): string {
  if (score >= 75) return 'var(--color-success)';
  if (score >= 60) return 'var(--color-primary)';
  if (score >= 30) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function getScoreColorClass(score: number): string {
  if (score >= 75) return 'text-[var(--color-success)]';
  if (score >= 60) return 'text-[var(--color-primary)]';
  if (score >= 30) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-danger)]';
}

export function ScoreGauge({
  score,
  size = 'md',
  label,
  showLabel = true,
  animated = true,
}: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const config = sizes[size];

  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (displayScore / 100) * circumference;
  const offset = circumference - progress;

  // Animate score on mount
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    const duration = 1000; // 1 second
    const startTime = Date.now();
    const startScore = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentScore = Math.round(startScore + (score - startScore) * eased);

      setDisplayScore(currentScore);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score, animated]);

  const scoreColor = getScoreColor(displayScore);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={config.width}
        height={config.width}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth={config.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke={scoreColor}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: animated ? 'stroke-dashoffset 0.3s ease-out' : 'none',
          }}
        />
      </svg>

      {/* Score text in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-bold tabular-nums ${getScoreColorClass(displayScore)}`}
          style={{ fontSize: config.fontSize }}
        >
          {displayScore}
        </span>
        {showLabel && label && (
          <span
            className="text-[var(--color-text-muted)] font-medium"
            style={{ fontSize: config.labelSize }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
