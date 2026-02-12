// ===== All Constants, Regex Patterns, and Magic Strings =====

import { ICONS, createIconWithText } from './icon-helpers.js';

export const OWNER = "promptroot";
export const REPO = "promptroot";
export const BRANCH = "main";

// GitHub API
export const GIST_POINTER_REGEX = /^https:\/\/gist\.githubusercontent\.com\/\S+\/raw\/\S+$/i;
export const GIST_URL_REGEX = /^https:\/\/gist\.github\.com\/[\w-]+\/[a-f0-9]+\/?(?:#file-[\w.-]+)?(?:\?file=[\w.-]+)?$/i;
export const CODEX_URL_REGEX = /^https:\/\/chatgpt\.com\/s\/[a-f0-9_]+$/i;

// Variable Substitution
export const PLACEHOLDER_REGEX = /\{([A-Z0-9_-]+)\}/g;

// Jules API
export const JULES_API_BASE = "https://jules.googleapis.com/v1alpha";

export const WEB_CAPTURE_EXTENSION_URL = "https://chromewebstore.google.com/detail/promptroot-web-capture/fbhilkiaigdedegnjgecdggbeknnbacg?utm_campaign=pmaxusbrand&utm_content=br3&utm_medium=ga&utm_source=bgads1";

export const DEFAULT_FAVORITE_REPOS = [];

export const STORAGE_KEY_FAVORITE_REPOS = "jules_favorite_repos";

// Hardcoded favorite branches (always favorites for all users)
export const HARDCODED_FAVORITE_BRANCHES = ["main", "web-captures"];

export const STORAGE_KEY_FAVORITE_BRANCHES = "favorite_branches";

// Tag definitions
export const TAG_DEFINITIONS = {
  review: {
    label: "Review",
    className: "tag-review",
    keywords: ["review", "\\bpr\\b", "rubric", "audit", "inspect", "check", "analyze", "investigation"]
  },
  bug: {
    label: "Bug",
    className: "tag-bug",
    keywords: ["bug", "triage", "fix", "issue", "solve", "repair", "patch", "hotfix"]
  },
  design: {
    label: "Design",
    className: "tag-design",
    keywords: ["spec", "design", "plan", "explorer", "guide", "tutorial", "documentation", "readme", "onboard"]
  },
  refactor: {
    label: "Refactor",
    className: "tag-refactor",
    keywords: ["refactor", "cleanup", "sweep", "maintenance", "optimize", "improve", "reorganize", "deadcode"]
  }
};

// Session tracking
export const SESSION_TRACKING = {
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
  TERMINAL_STATES: ['COMPLETED', 'FAILED'],
  ACTIVE_STATES: ['IN_PROGRESS', 'PLANNING', 'AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK', 'PAUSED', 'QUEUED']
};

// Branch classification
export const FEATURE_PATTERNS = ["codex/", "feature/", "fix/", "bugfix/", "hotfix/"];

// SessionStorage keys
export const STORAGE_KEYS = {
  expandedState: (owner, repo, branch) => `sidebar:expanded:${owner}/${repo}@${branch}`,
  promptsCache: (owner, repo, branch) => `prompts:${owner}/${repo}@${branch}`,
  showFeatureBranches: "showFeatureBranches",
  showUserBranches: "showUserBranches",
  // Internal access log for cache LRU tracking
  cacheAccessLog: "cache_access_log"
};

// Error messages
export const ERRORS = {
  FIREBASE_NOT_READY: "Firebase not initialized. Please refresh.",
  GIST_FETCH_FAILED: "Failed to fetch gist content.",
  AUTH_REQUIRED: "Authentication required.",
  JULES_KEY_REQUIRED: "No Jules API key stored. Please save your API key first.",
  CLIPBOARD_BLOCKED: "Clipboard blocked. Select and copy manually."
};

// Jules UI text (loading, empty states, labels, confirmations)
export const JULES_UI_TEXT = {
  // Loading states
  LOADING_BRANCHES: 'Loading branches…',
  LOADING_QUEUE: 'Loading queue...',
  LOADING_SESSIONS: 'Loading sessions...',
  LOADING_PROFILE: 'Loading Jules profile...',
  LOADING_SOURCES: 'Loading sources...',
  
  // Empty states
  NO_BRANCHES: 'No branches found',
  NO_SOURCES: 'No connected repositories found.',
  NO_SOURCES_HINT: 'Connect repos in the Jules UI.',
  NO_SESSIONS: 'No recent sessions found.',
  NO_QUEUE_ITEMS: 'No queued items.',
  NO_SEARCH_RESULTS: 'No sessions match your search',
  NO_SUBTASKS_DETECTED: 'No subtasks detected. This prompt will be sent as a single task.',
  
  // Error states
  FETCH_SOURCES_ERROR: 'Failed to fetch sources',
  FETCH_SESSIONS_ERROR: 'Failed to load sessions',
  LOAD_QUEUE_ERROR: 'Failed to load queue',
  LOAD_PROFILE_ERROR: 'Failed to load Jules profile',
  
  // State labels (for session/queue status display)
  STATE_LABELS: {
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    IN_PROGRESS: 'IN PROGRESS',
    PLANNING: 'IN PROGRESS',
    QUEUED: 'QUEUED',
    AWAITING_USER_FEEDBACK: 'AWAITING USER FEEDBACK',
    CANCELLED: 'CANCELLED',
    UNKNOWN: 'UNKNOWN'
  },
  
  // State icons (Material Icons names)
  STATE_ICONS: {
    COMPLETED: 'check_circle',
    FAILED: 'cancel',
    IN_PROGRESS: 'schedule',
    PLANNING: 'schedule',
    QUEUED: 'pause_circle',
    AWAITING_USER_FEEDBACK: 'chat_bubble',
    CANCELLED: 'block',
    UNKNOWN: 'help'
  },
  
  // Button labels
  BTN_SCHEDULE: 'Schedule',
  BTN_UNSCHEDULE: 'Unschedule',
  BTN_SAVE_CONTINUE: 'Save & Continue',
  BTN_DELETE_KEY: 'Delete Jules API Key',
  BTN_SAVING: 'Saving...',
  BTN_DELETING: 'Deleting...',
  
  // Success messages
  KEY_SAVED_SUCCESS: 'Jules API key saved successfully',
  
  // Hints
  CLICK_VIEW_SESSION: 'Click to view session',
  VIEW_FULL_PROMPT: 'View full prompt',
  
  // Subtask UI
  SUBTASK_PREVIEW_TITLE: (partNum) => `Part ${partNum}`,
  
  // Confirmations
  DELETE_KEY_CONFIRM: `This will delete your stored Jules API key. You'll need to enter a new one next time.`,
  VALIDATION_WARNING: (warnings) => `Warnings:\n${warnings.join('\n')}\n\nQueue anyway?`,
  
  // Schedule display
  SCHEDULED_FOR: (dateStr, timeZone) => `Scheduled for ${dateStr} (${timeZone})`,
  
  // Branch summary
  BRANCH_COUNT: (count) => `(${count} ${count === 1 ? 'branch' : 'branches'})`,
  NO_BRANCHES_PARENS: '(no branches)',
  BRANCHES_HEADER: (count) => `Branches (${count}):`,
  
  // Queue item types
  SUBTASKS_BATCH: 'Subtasks Batch ',
  SINGLE_PROMPT: 'Single Prompt ',
  REMAINING_COUNT: (count) => `(${count} remaining)`
};

// Jules toast messages
export const JULES_MESSAGES = {
  // Success messages
  QUEUED: "Prompt queued successfully!",
  QUEUE_UPDATED: "Queue item updated successfully",
  COMPLETED_RUNNING: "Completed running selected items",
  
  // Warning messages
  SIGN_IN_REQUIRED: "Please sign in to queue prompts.",
  SIGN_IN_REQUIRED_SUBTASKS: "Please sign in to queue subtasks.",
  NOT_SIGNED_IN: "Not signed in",
  NO_ITEMS_SELECTED: "No items selected",
  SELECT_REPO_FIRST: "Please select a repository first.",
  SELECT_BRANCH_FIRST: "Please select a branch first.",
  LOGIN_REQUIRED: "Login required to use Jules.",
  NOT_LOGGED_IN: "Not logged in.",
  
  // Info messages
  QUEUE_NOT_FOUND: "Queue item not found",
  
  // Cancellation messages
  cancelled: (processed, total) => 
    `Cancelled. Processed ${processed} of ${total} ${processed === 1 ? 'task' : 'tasks'} before cancellation.`,
  
  // Skip messages
  SKIPPED_SUBTASK: "Skipped subtask. Continuing with remaining...",
  
  // Success with count messages
  deleted: (count) => `Deleted ${count} ${count === 1 ? 'item' : 'items'}`,
  completedWithSkipped: (successful, skipped) => 
    `Completed ${successful} ${successful === 1 ? 'task' : 'tasks'}, skipped ${skipped}`,
  subtasksQueued: (count) => `${count} ${count === 1 ? 'subtask' : 'subtasks'} queued successfully!`,
  remainingQueued: (count) => `Queued ${count} remaining ${count === 1 ? 'subtask' : 'subtasks'}`,
  subtasksCancelled: (successful, total) => 
    `Cancelled. Submitted ${successful} of ${total} ${successful === 1 ? 'subtask' : 'subtasks'} before cancellation.`,
  
  // Error messages
  QUEUE_FAILED: (error) => `Failed to queue prompt: ${error}`,
  QUEUE_UPDATE_FAILED: (error) => `Failed to update queue item: ${error}`,
  DELETE_FAILED: (error) => `Failed to delete selected items: ${error}`,
  UNEXPECTED_ERROR: (error) => `Unexpected error: ${error}`,
  GENERAL_ERROR: "An error occurred. Please try again.",
  ERROR_WITH_MESSAGE: (message) => `An error occurred: ${message}`,
  FINAL_RETRY_FAILED: "Failed to submit task after multiple retries. Please try again later."
};

// UI text
export const UI_TEXT = {
  LOADING: "Loading...",
  SIGN_IN: "Sign in with GitHub",
  SIGN_OUT: "Sign Out",
  COPY_PROMPT: createIconWithText(ICONS.COPY, 'Copy prompt'),
  COPIED: "Copied",
  COPY_LINK: createIconWithText(ICONS.LINK, 'Copy link'),
  LINK_COPIED: "Link copied",
  TRY_JULES: createIconWithText(ICONS.JULES, 'Try in Jules'),
  RUNNING: "Running...",
  SAVE_KEY: "Save & Continue"
};

// Jules Modal Text
export const JULES_MODAL_TEXT = {
  ENTER_KEY_WARNING: 'Please enter your Jules API key.',
  NOT_LOGGED_IN: 'Not logged in.',
  SAVING: 'Saving...',
  SAVE_BUTTON: 'Save & Continue',
  KEY_SAVED_SUCCESS: 'Jules API key saved successfully',
  KEY_SAVE_ERROR_PREFIX: 'Failed to save API key: ',
  NOTE_QUEUED_TRY: 'Queued from Try in Jules modal',
  NOTE_QUEUED_PARTIAL_RETRY: 'Queued from Try in Jules flow (partial retries)',
  NOTE_QUEUED_FINAL_FAILURE: 'Queued from Try in Jules flow (final failure)',
  SUBTASK_PROGRESS: (current, total) => `Task ${current} of ${total}`,
  CANCEL_BUTTON: 'Cancel',
  QUEUE_BUTTON: 'Queue',
  SUBMIT_BUTTON: 'Submit'
};

// Folder Submenu Text
export const FOLDER_SUBMENU_TEXT = {
  NEW_PROMPT: 'Prompt (blank)',
  NEW_CONVERSATION: 'Conversation (template)',
  CONVERSATION_TEMPLATE: `**Conversation Link (Codex, Jules, etc):** [https://chatgpt.com/s/...]

### Prompt
[paste your full prompt here]

### Output
[response(s), context, notes, or follow-up thoughts]
`,
  NEW_PROMPT_FILENAME_PREFIX: 'prompt-',
  NEW_CONVERSATION_FILENAME: 'new-conversation.md',
  ACTIONS: {
    CREATE_PROMPT: 'create-prompt',
    CREATE_CONVERSATION: 'create-conversation'
  }
};

// CSS class names for state management
export const CSS_CLASSES = {
  HIDDEN: 'hidden',
  SHOW: 'show',
  COLLAPSED: 'collapsed',
  EXPANDED: 'expanded',
  LOADING: 'loading',
  ERROR: 'error',
  // Source card states
  SOURCE_CARD_BRANCHES_HIDDEN: 'source-card__branches--hidden',
  SOURCE_CARD_ARROW_EXPANDED: 'source-card__arrow--expanded',
  // Queue card states
  QUEUE_CARD_SCHEDULED: 'queue-card--scheduled',
  QUEUE_CARD_PENDING: 'queue-card--pending',
  // Session states
  SESSION_CARD: 'session-card',
  // Modal visibility
  MODAL_VISIBLE: 'modal--visible'
};

/**
 * @typedef {object} RetryConfig
 * @property {number} maxRetries - The maximum number of retries.
 * @property {number} baseDelay - The base delay in milliseconds for exponential backoff.
 */

/**
 * Configuration for retry logic.
 * @type {RetryConfig}
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000
};

/**
 * @typedef {object} Timeouts
 * @property {number} statusBar - The duration in milliseconds to display a status bar message.
 * @property {number} fetch - The timeout in milliseconds for fetch requests.
 * @property {number} componentCheck - Interval for checking if components are loaded (50ms).
 * @property {number} windowClose - Delay before closing the window (2000ms).
 * @property {number} uiDelay - Standard delay for UI updates to avoid flicker (500ms).
 * @property {number} longDelay - Long delay for retries or significant pauses (5000ms).
 * @property {number} toast - Default duration for toast messages (3000ms).
 * @property {number} copyFeedback - Duration to show "Copied!" feedback (1000ms).
 * @property {number} queueDelay - Delay between queue processing items (800ms).
 * @property {number} firebaseRetry - Interval for retrying Firebase initialization (100ms).
 * @property {number} modalFocus - Delay to set focus in modals (100ms).
 */

/**
 * Timeouts for various UI and network operations.
 * @type {Timeouts}
 */
export const TIMEOUTS = {
  statusBar: 3000,
  fetch: 5000,
  componentCheck: 50,
  windowClose: 2000,
  uiDelay: 500,
  longDelay: 5000,
  toast: 3000,
  copyFeedback: 1000,
  queueDelay: 800,
  firebaseRetry: 100,
  modalFocus: 100,
  actionFeedback: 2000
};

/**
 * @typedef {object} Limits
 * @property {number} firebaseMaxAttempts - Maximum attempts to initialize Firebase (300).
 * @property {number} componentMaxAttempts - Maximum attempts to wait for components (100).
 */

/**
 * Limits for various operations.
 * @type {Limits}
 */
export const LIMITS = {
  firebaseMaxAttempts: 300,
  componentMaxAttempts: 100,
  // Maximum number of prompt cache entries stored in sessionStorage
  promptCacheMaxEntries: 20
};

/**
 * @typedef {object} PageSizes
 * @property {number} julesSessions - The number of Jules sessions to fetch per page.
 * @property {number} branches - The number of branches to fetch per page.
 */

/**
 * Page sizes for paginated API calls.
 * @type {PageSizes}
 */
export const PAGE_SIZES = {
  julesSessions: 10,
  branches: 100
};

/**
 * @typedef {object} CacheDurations
 * @property {number} short - The duration in milliseconds for short-lived cache items.
 * @property {number} session - A flag indicating that the cache item should last for the session.
 */

/**
 * Cache durations for various data types.
 * Note: A duration of 0 means cache persists for the browser session
 * (until page refresh or sessionStorage is cleared)
 * @type {CacheDurations}
 */
export const CACHE_DURATIONS = {
  short: 300000, // 5 minutes
  session: 0 // Never expires within the session
};

/**
 * Cache strategies enum
 */
export const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_ONLY: 'network-only',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

/**
 * Cache keys for session storage
 */
export const CACHE_KEYS = {
  JULES_ACCOUNT: 'jules_account_info',
  JULES_SESSIONS: 'jules_sessions',
  JULES_REPOS: 'jules_repos',
  QUEUE_ITEMS: 'queue_items',
  BRANCHES: 'branches_v2',
  CURRENT_BRANCH: 'current_branch',
  CURRENT_REPO: 'current_repo',
  USER_PROFILE: 'user_profile',
  USER_AVATAR: 'user_avatar',
  TRACKED_SESSIONS: 'tracked_sessions',
  ANALYTICS_DATA: 'analytics_data'
};

/**
 * Cache policies configuration
 * Maps CACHE_KEYS to specific configurations
 */
export const CACHE_POLICIES = {
  [CACHE_KEYS.JULES_ACCOUNT]: {
    ttl: CACHE_DURATIONS.session,
    strategy: CACHE_STRATEGIES.CACHE_FIRST
  },
  [CACHE_KEYS.QUEUE_ITEMS]: {
    ttl: CACHE_DURATIONS.session,
    strategy: CACHE_STRATEGIES.CACHE_FIRST
  },
  [CACHE_KEYS.BRANCHES]: {
    ttl: CACHE_DURATIONS.session,
    strategy: CACHE_STRATEGIES.CACHE_FIRST
  },
  [CACHE_KEYS.USER_AVATAR]: {
    ttl: CACHE_DURATIONS.session,
    strategy: CACHE_STRATEGIES.CACHE_FIRST
  },
  // Default policy for other keys
  DEFAULT: {
    ttl: CACHE_DURATIONS.short,
    strategy: CACHE_STRATEGIES.CACHE_FIRST
  }
};
