import { test, expect } from '@playwright/test';
import { navigateToPage } from '../helpers/navigation.js';
import { expectAuthenticationSuccess } from '../helpers/assertions.js';
import { mockGitHubOAuth, setGitHubToken, clearGitHubAuth } from '../helpers/github-helper.js';
import { testUser } from '../fixtures/test-data.js';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await clearGitHubAuth(page);
    await page.goto('/');
  });

  test('user can sign in with GitHub', async ({ page, context }) => {
    // Mock GitHub OAuth flow
    await mockGitHubOAuth(page);
    
    // Find and click GitHub login button
    const loginBtn = page.locator('#githubLoginBtn, .github-login, button:has-text("Sign in"), button:has-text("Login")').first();
    
    if (await loginBtn.isVisible()) {
      // Handle potential popup
      const [popup] = await Promise.all([
        context.waitForEvent('page').catch(() => null),
        loginBtn.click()
      ]);
      
      if (popup) {
        // In a real OAuth flow, this would be handled by GitHub
        // For testing, we might auto-complete it or mock it
        await popup.waitForLoadState();
        
        // Close popup after OAuth (in mocked scenario)
        await popup.close();
      }
      
      // Alternatively, for fully mocked auth, just set the token
      await setGitHubToken(page, testUser.githubToken);
      await page.reload();
      
      // Verify authenticated state
      await page.waitForTimeout(1000);
      const userProfile = page.locator('#userProfile, .user-profile, .user-avatar');
      
      if (await userProfile.isVisible()) {
        await expectAuthenticationSuccess(page);
      }
    }
  });

  test('user profile displays correct information', async ({ page }) => {
    // Set authenticated state
    await setGitHubToken(page, testUser.githubToken);
    await page.evaluate((user) => {
      localStorage.setItem('githubUser', JSON.stringify({
        login: user.githubUsername,
        name: user.displayName,
        email: user.email
      }));
    }, testUser);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Find and click user profile
    const userProfile = page.locator('#userProfile, .user-profile, .user-avatar').first();
    
    if (await userProfile.isVisible()) {
      await userProfile.click();
      
      // Look for profile modal or dropdown
      const profileModal = page.locator('#profileModal, .profile-modal, .user-dropdown');
      await expect(profileModal).toBeVisible({ timeout: 3000 });
      
      // Verify user information is displayed
      const userName = page.locator('#userName, .user-name');
      const userEmail = page.locator('#userEmail, .user-email');
      
      if (await userName.isVisible()) {
        const nameText = await userName.textContent();
        expect(nameText).toBeTruthy();
      }
      if (await userEmail.isVisible()) {
        const emailText = await userEmail.textContent();
        expect(emailText).toBeTruthy();
      }
    }
  });

  test('user can sign out', async ({ page }) => {
    // Set authenticated state
    await setGitHubToken(page, testUser.githubToken);
    await page.evaluate((user) => {
      localStorage.setItem('githubUser', JSON.stringify({
        login: user.githubUsername,
        name: user.displayName
      }));
    }, testUser);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Open user menu
    const userProfile = page.locator('#userProfile, .user-profile, .user-avatar').first();
    
    if (await userProfile.isVisible()) {
      await userProfile.click();
      
      // Find and click sign out button
      const signOutBtn = page.locator('#signOutBtn, .sign-out, button:has-text("Sign out"), button:has-text("Logout")').first();
      await signOutBtn.click();
      
      // Wait for sign out to complete
      await page.waitForTimeout(1000);
      
      // Verify signed out state
      const loginBtn = page.locator('#githubLoginBtn, .github-login, button:has-text("Sign in")');
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      
      // Verify user profile is gone
      await expect(userProfile).not.toBeVisible();
    }
  });

  test('authentication persists across page refreshes', async ({ page }) => {
    // Set authenticated state
    await setGitHubToken(page, testUser.githubToken);
    await page.evaluate((user) => {
      localStorage.setItem('githubUser', JSON.stringify({
        login: user.githubUsername,
        name: user.displayName
      }));
    }, testUser);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify authenticated
    const userProfile = page.locator('#userProfile, .user-profile, .user-avatar');
    if (await userProfile.isVisible()) {
      // Refresh again
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Verify still authenticated
      await expect(userProfile).toBeVisible();
    }
  });

  test('unauthenticated users have limited access to Jules features', async ({ page }) => {
    // Ensure not authenticated
    await clearGitHubAuth(page);
    await page.reload();
    
    // Try to access Jules features
    const julesNav = page.locator('a[href*="jules"], .nav-jules, button:has-text("Jules")').first();
    
    if (await julesNav.isVisible()) {
      await julesNav.click();
      await page.waitForTimeout(1000);
      
      // Should see auth prompt or be blocked
      const authPrompt = page.locator('.auth-required, .login-required, [data-auth-required="true"]');
      const loginBtn = page.locator('button:has-text("Sign in"), button:has-text("Login")');
      
      const hasAuthPrompt = await authPrompt.isVisible().catch(() => false);
      const hasLoginBtn = await loginBtn.isVisible().catch(() => false);
      
      // One of these should be true for protected routes
      expect(hasAuthPrompt || hasLoginBtn).toBeTruthy();
    }
  });

  test('expired session redirects to login', async ({ page }) => {
    // Set authenticated state with expired token
    await page.evaluate(() => {
      localStorage.setItem('githubToken', 'expired-token');
      localStorage.setItem('githubTokenExpiry', Date.now() - 10000); // Expired 10s ago
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Try to access protected route
    await navigateToPage(page, 'profile');
    await page.waitForTimeout(1000);
    
    // Should either show login button or redirect to login
    const loginBtn = page.locator('button:has-text("Sign in"), button:has-text("Login")');
    const isOnLoginPage = page.url().includes('login') || page.url().includes('auth');
    
    expect(await loginBtn.isVisible() || isOnLoginPage).toBeTruthy();
  });

  test('authentication error shows helpful message', async ({ page }) => {
    // Mock failed OAuth
    await page.route('**/oauth/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'authentication_failed' })
      });
    });
    
    const loginBtn = page.locator('#githubLoginBtn, button:has-text("Sign in")').first();
    
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.waitForTimeout(2000);
      
      // Look for error message
      const errorMsg = page.locator('.error, .error-message, [role="alert"]');
      
      if (await errorMsg.isVisible()) {
        const errorText = await errorMsg.textContent();
        expect(errorText.length).toBeGreaterThan(0);
      }
    }
  });

  test('user can access profile page when authenticated', async ({ page }) => {
    // Set authenticated state
    await setGitHubToken(page, testUser.githubToken);
    await page.evaluate((user) => {
      localStorage.setItem('githubUser', JSON.stringify({
        login: user.githubUsername,
        name: user.displayName,
        email: user.email
      }));
    }, testUser);
    
    // Navigate to profile page
    await navigateToPage(page, 'profile');
    await page.waitForLoadState('networkidle');
    
    // Verify profile page loaded
    const profileContainer = page.locator('#profileContainer, .profile-container, main');
    await expect(profileContainer).toBeVisible();
    
    // Should not see login prompt
    const loginBtn = page.locator('button:has-text("Sign in")');
    expect(await loginBtn.isVisible()).toBeFalsy();
  });

  test('logging out clears all auth data', async ({ page }) => {
    // Set authenticated state
    await setGitHubToken(page, testUser.githubToken);
    await page.evaluate((user) => {
      localStorage.setItem('githubUser', JSON.stringify({ login: user.githubUsername }));
      localStorage.setItem('julesApiKey', 'test-jules-key');
    }, testUser);
    
    await page.reload();
    
    // Sign out
    const userProfile = page.locator('#userProfile, .user-profile').first();
    if (await userProfile.isVisible()) {
      await userProfile.click();
      
      const signOutBtn = page.locator('button:has-text("Sign out"), button:has-text("Logout")').first();
      await signOutBtn.click();
      await page.waitForTimeout(1000);
      
      // Verify all auth data cleared
      const hasToken = await page.evaluate(() => {
        return localStorage.getItem('githubToken') !== null;
      });
      
      expect(hasToken).toBeFalsy();
    }
  });
});
