# Jules Session Tracking & Analytics

## Overview

This feature tracks Jules sessions in Firestore and provides comprehensive analytics about session performance, PR creation rates, prompt effectiveness, and failure patterns.

## Architecture

### Session Tracking
- **Automatic Tracking**: Sessions are automatically tracked when created via Cloud Functions
- **Firestore Storage**: Session metadata stored in `juleSessions/{userId}/sessions/{sessionId}`
- **Status Syncing**: Background sync updates session status from Jules API

### Data Collected
For each session:
- Session ID, name, and Jules URL
- Prompt path and content hash
- Source repository and branch
- Status (COMPLETED, FAILED, IN_PROGRESS, etc.)
- PR information (URL, title, description)
- Plan details (step count, plan generated)
- Failure details (reason, step where failed)
- Timestamps (created, completed, last synced)

## Files Created/Modified

### New Modules
- `src/modules/session-tracking.js` - Core tracking functionality
- `src/modules/analytics.js` - Analytics calculation and aggregation
- `src/pages/analytics-page.js` - Analytics page UI logic

### New Pages
- `pages/analytics/analytics.html` - Analytics dashboard
- `src/styles/pages/analytics.css` - Analytics styles

### Modified Files
- `functions/index.js` - Added session tracking to Cloud Functions
- `config/firestore/firestore.rules` - Added security rules for new collections
- `src/utils/constants.js` - Added tracking constants and cache keys
- `partials/header.html` - Added Analytics link to navigation

## Usage

### Viewing Analytics
1. Navigate to `/pages/analytics/analytics.html`
2. Select time period (7 days, 30 days, 90 days, year, or all time)
3. View metrics:
   - Total sessions, success rate, PRs created, failures
   - Status distribution chart
   - Sessions timeline
   - Top performing prompts
   - Failure analysis
   - Repository performance
   - Recent PRs

### Syncing Sessions
- Active sessions auto-sync every 5 minutes (configurable via `SESSION_TRACKING.SYNC_INTERVAL`)
- Manual refresh available via "Refresh" button on analytics page
- Syncing updates: status, PR URLs, completion times

### API Functions

**Track New Session**
```javascript
import { trackSessionCreation } from './modules/session-tracking.js';

await trackSessionCreation({
  sessionId: '123',
  sessionName: 'sessions/123',
  promptPath: 'prompts/bug-fix.md',
  promptContent: 'Fix the auth bug...',
  sourceId: 'sources/github/owner/repo',
  branch: 'main',
  title: 'Fix Authentication',
  status: 'IN_PROGRESS',
  queueItemId: 'abc123' // optional
});
```

**Sync Session Status**
```javascript
import { syncSessionFromAPI } from './modules/session-tracking.js';

await syncSessionFromAPI('sessionId123', apiKey);
```

**Get Analytics**
```javascript
import { calculateAnalytics } from './modules/analytics.js';

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const analytics = await calculateAnalytics(thirtyDaysAgo, new Date());
console.log(analytics.prCreationRate); // 0.78 (78%)
```

## Firestore Schema

### Sessions Collection
```
juleSessions/
  {userId}/
    sessions/
      {sessionId}/
        sessionId: string
        sessionName: string
        promptPath: string
        promptContent: string
        promptHash: string (SHA-256)
        sourceId: string
        branch: string
        title: string
        status: string (COMPLETED|FAILED|IN_PROGRESS|etc)
        hasPR: boolean
        prUrl: string|null
        prTitle: string|null
        prDescription: string|null
        hasPlan: boolean
        planStepCount: number
        failureStep: string|null
        failureReason: string|null
        createdAt: timestamp
        completedAt: timestamp|null
        lastSyncedAt: timestamp
        queueItemId: string|null
        userId: string
```

### Security Rules
Users can only access their own session data:
```javascript
match /juleSessions/{userId}/sessions/{sessionId} {
  allow read, write, delete: if request.auth != null && request.auth.uid == userId;
}
```

## Analytics Metrics

### Core Metrics
- Total sessions
- Completed sessions
- Failed sessions
- In-progress sessions
- Success rate (completed / total)

### PR Metrics
- Sessions with PRs
- PR creation rate
- Recent PR list

### Prompt Performance
- Uses per prompt
- Success rate per prompt
- PR rate per prompt
- Best performing prompts

### Failure Analysis
- Failure reasons (bash_error, timeout, etc.)
- Failed at step (which step in plan failed)
- Recent failures

### Repository Performance
- Sessions per repo
- PR rate per repo
- Average session duration per repo

### Timing
- Average session duration
- Completion times

## Future Enhancements

### Planned Features
1. **Email Notifications**: Notify when sessions complete/fail
2. **Activity History Storage**: Store full activity logs from Jules API
3. **Prompt Recommendations**: Suggest prompts based on historical success
4. **Team Analytics**: Aggregate analytics across team members
5. **Export to CSV**: Download analytics data
6. **Scheduled Reports**: Weekly/monthly email summaries

### Advanced Analytics
- Success rate by time of day
- Correlation between prompt length and success
- Repository complexity scoring
- Developer productivity metrics
- Cost analysis (API usage tracking)

## Configuration

### Sync Interval
Modify in `src/utils/constants.js`:
```javascript
export const SESSION_TRACKING = {
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
  // ...
};
```

### Cache Duration
Session analytics use session storage cache. Configure in `CACHE_KEYS` and `CACHE_POLICIES`.

## Deployment

### Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Cloud Functions
```bash
cd functions
npm run deploy
```

### Frontend
Static files - no build step required. Just deploy to hosting.

## Testing

Currently manual testing required. Open browser DevTools and:
1. Create a Jules session
2. Check Firestore console for new document in `juleSessions/{uid}/sessions/`
3. Navigate to analytics page
4. Verify charts and metrics display correctly

## Troubleshooting

**Sessions not appearing in analytics**
- Check Firestore console for data
- Verify Cloud Function logs for tracking errors
- Check browser console for JavaScript errors

**Charts not rendering**
- Verify Chart.js CDN is loading (check Network tab)
- Check for JavaScript errors in console
- Ensure canvas elements exist in DOM

**Sync not working**
- Verify Jules API key is valid
- Check Cloud Function logs
- Ensure Firestore rules allow writes

## Related Documentation
- [Jules API Documentation](https://developers.google.com/jules/api)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
