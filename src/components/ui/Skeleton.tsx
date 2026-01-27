'use client';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseStyles = 'bg-[var(--color-surface-sunken)] rounded-[var(--radius-sm)]';
  
  const variantStyles = {
    text: 'h-4 rounded-[var(--radius-sm)]',
    circular: 'rounded-full',
    rectangular: 'rounded-[var(--radius-sm)]',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={style}
      aria-busy="true"
      aria-live="polite"
    />
  );
}

// Pre-built skeleton components for common use cases
export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '75%' : '100%'}
          className="h-4"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`p-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] ${className}`}>
      <Skeleton variant="text" width="60%" height={24} className="mb-4" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonList({ items = 3, className = '' }: { items?: number; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" height={16} />
            <Skeleton variant="text" width="60%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-[var(--color-border)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${100 / cols}%`} height={20} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} variant="text" width={`${100 / cols}%`} height={16} />
          ))}
        </div>
      ))}
    </div>
  );
}
