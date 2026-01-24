/**
 * Environment Configuration
 * 
 * Provides type-safe access to environment variables and
 * environment-specific configuration.
 * 
 * Environment Types:
 * - development: Local development
 * - preview: Vercel preview deployments (PR branches)
 * - production: Vercel production (main branch)
 */

export type AppEnvironment = 'development' | 'preview' | 'production';

/**
 * Get the current application environment
 */
export function getAppEnvironment(): AppEnvironment {
  const env = process.env.NEXT_PUBLIC_APP_ENV;
  
  if (env === 'production') return 'production';
  if (env === 'preview') return 'preview';
  
  return 'development';
}

/**
 * Environment configuration object
 */
export const env = {
  /**
   * Current application environment
   */
  get appEnv(): AppEnvironment {
    return getAppEnvironment();
  },
  
  /**
   * Whether the app is running in production
   */
  get isProduction(): boolean {
    return this.appEnv === 'production';
  },
  
  /**
   * Whether the app is running in a preview deployment
   */
  get isPreview(): boolean {
    return this.appEnv === 'preview';
  },
  
  /**
   * Whether the app is running in development
   */
  get isDevelopment(): boolean {
    return this.appEnv === 'development';
  },
  
  /**
   * Whether the app is running on Vercel (preview or production)
   */
  get isVercel(): boolean {
    return this.isProduction || this.isPreview;
  },
  
  /**
   * Supabase configuration
   */
  supabase: {
    get url(): string {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if ( !url) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
      }
      return url;
    },
    
    get anonKey(): string {
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if ( !key) {
        throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
      }
      return key;
    },
  },

  /**
   * Sentry configuration
   */
  sentry: {
    get dsn(): string | undefined {
      return process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
    },
    
    get enabled(): boolean {
      return !!this.dsn;
    },
  },
} as const;

/**
 * Validate that all required environment variables are set
 * Call this at app startup to fail fast if config is missing
 */
export function validateEnv(): void {
  const errors: string[] = [];
  
  if ( !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  
  if ( !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }
  
  if (errors.length > 0) {
    console.error('Environment validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    
    // In production, throw to prevent the app from starting with bad config
    if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${errors.join(', ')}`);
    }
  }
}

/**
 * Get a human-readable environment label
 */
export function getEnvironmentLabel(): string {
  const appEnv = getAppEnvironment();
  
  switch (appEnv) {
    case 'production':
      return 'Production';
    case 'preview':
      return 'Preview';
    case 'development':
    default:
      return 'Development';
  }
}

/**
 * Get environment-specific colors for UI indicators
 */
export function getEnvironmentColor(): string {
  const appEnv = getAppEnvironment();
  
  switch (appEnv) {
    case 'production':
      return '#22c55e'; // Green
    case 'preview':
      return '#f59e0b'; // Amber
    case 'development':
    default:
      return '#3b82f6'; // Blue
  }
}
