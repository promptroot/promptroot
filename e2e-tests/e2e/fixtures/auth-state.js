/**
 * Store and retrieve authentication states for testing
 * This allows tests to skip the login flow by using saved auth state
 */
export const authStates = {
  authenticated: {
    uid: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token'
  },
  
  unauthenticated: null
};
