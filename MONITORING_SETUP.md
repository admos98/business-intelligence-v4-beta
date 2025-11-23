# Monitoring and Error Tracking Setup Guide

This guide explains how to set up error tracking and monitoring for the Business Intelligence application.

## Overview

For a production-ready application, it's recommended to implement:
1. **Error Tracking** - Capture and report runtime errors
2. **Performance Monitoring** - Track app performance metrics
3. **User Analytics** - Understand user behavior (privacy-compliant)

## Recommended Tools

### 1. Sentry (Error Tracking)

Sentry is the most popular error tracking solution for React applications.

#### Setup Steps

1. **Install Sentry SDK:**
   ```bash
   npm install @sentry/react
   ```

2. **Configure Sentry in `src/index.tsx`:**
   ```typescript
   import * as Sentry from "@sentry/react";

   Sentry.init({
     dsn: import.meta.env.VITE_SENTRY_DSN,
     integrations: [
       new Sentry.BrowserTracing(),
       new Sentry.Replay(),
     ],
     // Performance Monitoring
     tracesSampleRate: 1.0, // Adjust in production
     // Session Replay
     replaysSessionSampleRate: 0.1,
     replaysOnErrorSampleRate: 1.0,
     environment: import.meta.env.MODE,
   });
   ```

3. **Wrap App with Error Boundary:**
   ```typescript
   root.render(
     <React.StrictMode>
       <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog>
         <App />
       </Sentry.ErrorBoundary>
     </React.StrictMode>
   );
   ```

4. **Set Environment Variable in Vercel:**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add: `VITE_SENTRY_DSN=your_sentry_dsn_here`
   - Get your DSN from https://sentry.io

#### Benefits
- Automatic error capture
- Source map support for readable stack traces
- Performance monitoring
- Session replay for debugging
- Release tracking
- Issue grouping and filtering

### 2. LogRocket (Session Replay + Error Tracking)

Alternative to Sentry with focus on session replay.

#### Setup Steps

1. **Install LogRocket:**
   ```bash
   npm install logrocket
   ```

2. **Initialize in `src/index.tsx`:**
   ```typescript
   import LogRocket from 'logrocket';

   LogRocket.init(import.meta.env.VITE_LOGROCKET_APP_ID);
   ```

3. **Set Environment Variable:**
   - `VITE_LOGROCKET_APP_ID=your_app_id`

### 3. Google Analytics (User Analytics)

For understanding user behavior and usage patterns.

#### Setup Steps

1. **Install GA4:**
   ```bash
   npm install react-ga4
   ```

2. **Initialize in `src/index.tsx`:**
   ```typescript
   import ReactGA from 'react-ga4';

   if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
     ReactGA.initialize(import.meta.env.VITE_GA_MEASUREMENT_ID);
   }
   ```

3. **Track Page Views in App.tsx:**
   ```typescript
   useEffect(() => {
     if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
       ReactGA.send({ hitType: 'pageview', page: view });
     }
   }, [view]);
   ```

### 4. Custom Analytics Events

Track custom business events:

```typescript
// In your components
import { logger } from '../utils/logger';

// Track events
logger.info('purchase_completed', {
  listId: list.id,
  itemCount: list.items.length,
  totalAmount: totalAmount,
});
```

## Implementation Checklist

- [ ] Set up Sentry account
- [ ] Install Sentry SDK
- [ ] Configure Sentry in index.tsx
- [ ] Add environment variable to Vercel
- [ ] Test error reporting
- [ ] Set up release tracking
- [ ] Configure alerts/notifications
- [ ] (Optional) Set up Google Analytics
- [ ] (Optional) Set up custom event tracking

## Privacy Considerations

1. **GDPR Compliance**: Ensure user consent for analytics
2. **Data Masking**: Don't log sensitive information (passwords, tokens)
3. **IP Anonymization**: Configure Sentry/GA to anonymize IPs
4. **Consent Management**: Add cookie consent banner if needed

## Cost Estimates

- **Sentry**: Free tier (5,000 events/month), then $26/month
- **LogRocket**: Free tier (1,000 sessions/month), then $99/month
- **Google Analytics**: Free

## Recommended Setup for This Project

For a cafe management app, we recommend:

1. **Sentry** for error tracking (free tier is sufficient)
2. **Google Analytics** for user analytics (free)
3. **Custom logging** for business events (already implemented)

This combination provides comprehensive monitoring without additional costs for small-scale deployments.

## Example Error Tracking Integration

See `src/utils/logger.ts` for the current logging implementation. To integrate Sentry:

```typescript
import * as Sentry from "@sentry/react";

export const logger = {
  error: (message: string, error?: Error, context?: Record<string, unknown>) => {
    console.error(message, error, context);
    Sentry.captureException(error || new Error(message), {
      extra: context,
    });
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(message, context);
    Sentry.captureMessage(message, 'warning', { extra: context });
  },
  info: (message: string, context?: Record<string, unknown>) => {
    console.log(message, context);
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data: context,
    });
  },
};
```

## Next Steps

1. Choose your monitoring solution(s)
2. Follow setup steps above
3. Test error reporting in staging
4. Monitor production errors
5. Set up alerts for critical errors
6. Review and fix issues regularly
