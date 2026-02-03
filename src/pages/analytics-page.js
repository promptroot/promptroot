// ===== Analytics Page =====
// Displays Jules session analytics with charts and metrics

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { calculateAnalytics } from '../modules/analytics.js';
import { syncActiveSessions, importJulesHistory } from '../modules/session-tracking.js';
import { handleError } from '../utils/error-handler.js';
import { TIMEOUTS } from '../utils/constants.js';
import { createElement, createIcon, toggleVisibility } from '../utils/dom-helpers.js';
import { showToast } from '../modules/toast.js';
import { showConfirm } from '../modules/confirm-modal.js';
import { showPromptViewer } from '../modules/prompt-viewer.js';
import statusBar from '../modules/status-bar.js';

let currentAnalytics = null;
let statusChartInstance = null;
let timelineChartInstance = null;

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function initApp() {
  try {
    await waitForFirebase();
    
    // Initialize status bar
    statusBar.init();

    const auth = getAuth();
    
    auth.onAuthStateChanged(user => {
      if (user) {
        loadAnalytics();
      } else {
        showNotSignedIn();
      }
    });

    // Date range selector
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    if (dateRangeSelect) {
      dateRangeSelect.addEventListener('change', () => {
        loadAnalytics();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshAnalyticsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.querySelector('.icon').textContent = 'hourglass_empty';
        
        try {
          // Show status bar and sync with progress updates
          statusBar.showMessage('Syncing sessions...', { timeout: 0 });
          
          await syncActiveSessions((synced, total) => {
            statusBar.setProgress(`${synced} / ${total}`, (synced / total) * 100);
          });
          
          statusBar.clearProgress();
          statusBar.showMessage('Loading analytics...', { timeout: 0 });
          
          await loadAnalytics();
          
          statusBar.showMessage('Refresh complete!', { timeout: 3000 });
        } catch (error) {
          handleError(error, { source: 'refreshAnalytics' });
          statusBar.showMessage('Refresh failed', { timeout: 3000 });
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.querySelector('.icon').textContent = 'refresh';
        }
      });
    }

    // Import history button
    const importBtn = document.getElementById('importHistoryBtn');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          'This will import all your Jules sessions from history. This may take a few minutes. Continue?',
          {
            title: 'Import Jules History',
            confirmText: 'Import',
            confirmStyle: 'primary',
            cancelText: 'Cancel'
          }
        );
        
        if (!confirmed) {
          return;
        }

        importBtn.disabled = true;
        importBtn.querySelector('.icon').textContent = 'hourglass_empty';
        const originalText = importBtn.childNodes[2].textContent;
        importBtn.childNodes[2].textContent = ' Importing...';
        
        try {
          // Show status bar with progress
          statusBar.showMessage('Importing Jules history...', { timeout: 0 });
          
          const stats = await importJulesHistory((processed, total) => {
            statusBar.setProgress(`${processed} / ${total}`, (processed / total) * 100);
          });
          
          statusBar.clearProgress();
          statusBar.showMessage('Loading analytics...', { timeout: 0 });
          
          showToast(`Import complete: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`, 'success');
          await loadAnalytics();
          
          statusBar.showMessage('Import complete!', { timeout: 3000 });
        } catch (error) {
          handleError(error, { source: 'importHistory' });
          showToast('Failed to import history. Check console for details.', 'error');
          statusBar.showMessage('Import failed', { timeout: 3000 });
        } finally {
          importBtn.disabled = false;
          importBtn.querySelector('.icon').textContent = 'download';
          importBtn.childNodes[2].textContent = originalText;
        }
      });
    }
  } catch (error) {
    handleError(error, { source: 'analyticsInit' });
  }
}

function showNotSignedIn() {
  toggleVisibility(document.getElementById('analyticsLoading'), false);
  toggleVisibility(document.getElementById('analyticsContent'), false);
  toggleVisibility(document.getElementById('analyticsNotSignedIn'), true);
}

async function loadAnalytics() {
  const loadingDiv = document.getElementById('analyticsLoading');
  const contentDiv = document.getElementById('analyticsContent');
  const notSignedInDiv = document.getElementById('analyticsNotSignedIn');

  try {
    console.log('[Analytics UI] Loading analytics...');
    toggleVisibility(loadingDiv, true);
    toggleVisibility(contentDiv, false);
    toggleVisibility(notSignedInDiv, false);

    // Get date range
    const dateRange = getSelectedDateRange();
    console.log('[Analytics UI] Date range:', dateRange);
    
    // Calculate analytics
    currentAnalytics = await calculateAnalytics(dateRange.start, dateRange.end);

    // Render all sections
    renderKeyMetrics(currentAnalytics);
    await renderStatusChart(currentAnalytics); // Wait for Chart.js to load
    await renderTimelineChart(currentAnalytics); // Now Chart.js is available
    renderTopPrompts(currentAnalytics);
    renderFailureAnalysis(currentAnalytics);
    renderRepoPerformance(currentAnalytics);
    renderRecentPRs(currentAnalytics);

    toggleVisibility(loadingDiv, false);
    toggleVisibility(contentDiv, true);
  } catch (error) {
    handleError(error, { source: 'loadAnalytics' });
    loadingDiv?.classList.add('hidden');
  }
}

function getSelectedDateRange() {
  const select = document.getElementById('dateRangeSelect');
  const value = select?.value || '30';
  
  // Handle "all time" case
  if (value === 'all') {
    return { start: null, end: null };
  }
  
  const days = parseInt(value);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return { start, end };
}

function renderKeyMetrics(analytics) {
  document.getElementById('totalSessionsValue').textContent = analytics.totalSessions;
  
  const successRate = (analytics.successRate * 100).toFixed(1);
  document.getElementById('successRateValue').textContent = `${successRate}%`;
  
  document.getElementById('prsCreatedValue').textContent = analytics.sessionsWithPRs;
  
  const prRate = (analytics.prCreationRate * 100).toFixed(1);
  document.getElementById('prRateValue').textContent = `${prRate}% of sessions`;
  
  document.getElementById('failedSessionsValue').textContent = analytics.failedSessions;
}

async function renderStatusChart(analytics) {
  // Lazy load Chart.js
  if (!window.Chart) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    document.head.appendChild(script);
    
    await new Promise((resolve) => {
      script.onload = resolve;
    });
  }

  const ctx = document.getElementById('statusChart');
  if (!ctx) return;

  // Destroy existing chart
  if (statusChartInstance) {
    statusChartInstance.destroy();
  }

  const chartData = [
    analytics.statusDistribution.COMPLETED,
    analytics.statusDistribution.FAILED,
    analytics.statusDistribution.IN_PROGRESS + analytics.statusDistribution.PLANNING,
    analytics.statusDistribution.PAUSED,
    analytics.statusDistribution.AWAITING_USER_FEEDBACK + analytics.statusDistribution.AWAITING_PLAN_APPROVAL,
    analytics.statusDistribution.QUEUED,
    analytics.statusDistribution.STATE_UNSPECIFIED
  ];

  console.log('[Analytics UI] Rendering status chart with data:', {
    completed: chartData[0],
    failed: chartData[1],
    inProgress: chartData[2],
    paused: chartData[3],
    awaiting: chartData[4],
    queued: chartData[5],
    unspecified: chartData[6],
    total: chartData.reduce((sum, val) => sum + val, 0)
  });

  const data = {
    labels: ['Completed', 'Failed', 'In Progress', 'Paused', 'Awaiting', 'Queued', 'Unspecified'],
    datasets: [{
      data: chartData,
      backgroundColor: [
        'rgba(40, 167, 69, 0.8)',
        'rgba(220, 53, 69, 0.8)',
        'rgba(255, 193, 7, 0.8)',
        'rgba(156, 39, 176, 0.8)',
        'rgba(255, 152, 0, 0.8)',
        'rgba(0, 123, 255, 0.8)',
        'rgba(108, 117, 125, 0.8)'
      ],
      borderColor: [
        'rgb(40, 167, 69)',
        'rgb(220, 53, 69)',
        'rgb(255, 193, 7)',
        'rgb(156, 39, 176)',
        'rgb(255, 152, 0)',
        'rgb(0, 123, 255)',
        'rgb(108, 117, 125)'
      ],
      borderWidth: 2
    }]
  };

  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: false
        }
      }
    }
  });
}

async function renderTimelineChart(analytics) {
  if (!window.Chart) return; // Already loaded in renderStatusChart

  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  const container = ctx.parentElement;
  
  // Remove any existing "no data" message
  const existingMessage = container.querySelector('.muted-text');
  if (existingMessage) {
    existingMessage.remove();
  }

  // Destroy existing chart
  if (timelineChartInstance) {
    timelineChartInstance.destroy();
    timelineChartInstance = null;
  }

  // Check if there's any data
  if (!analytics.sessionsOverTime || analytics.sessionsOverTime.length === 0) {
    // Hide canvas and show "No data" message
    ctx.style.display = 'none';
    const messageDiv = document.createElement('div');
    messageDiv.className = 'muted-text small-text';
    messageDiv.style.padding = '24px';
    messageDiv.style.textAlign = 'center';
    messageDiv.textContent = 'No session data available for the selected time period';
    container.appendChild(messageDiv);
    return;
  }

  // Show canvas
  ctx.style.display = '';
  
  // Group sessions by day
  const sessionsByDay = {};
  const prsByDay = {};

  analytics.sessionsOverTime.forEach(session => {
    const dateKey = session.date.toISOString().split('T')[0];
    sessionsByDay[dateKey] = (sessionsByDay[dateKey] || 0) + 1;
    if (session.hasPR) {
      prsByDay[dateKey] = (prsByDay[dateKey] || 0) + 1;
    }
  });

  // Sort dates
  const dates = Object.keys(sessionsByDay).sort();
  const sessionCounts = dates.map(d => sessionsByDay[d]);
  const prCounts = dates.map(d => prsByDay[d] || 0);

  const data = {
    labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Total Sessions',
        data: sessionCounts,
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.1
      },
      {
        label: 'PRs Created',
        data: prCounts,
        borderColor: 'rgb(40, 167, 69)',
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        tension: 0.1
      }
    ]
  };

  timelineChartInstance = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function renderTopPrompts(analytics) {
  const container = document.getElementById('topPromptsContainer');
  if (!container) return;

  container.textContent = '';

  const prompts = Object.entries(analytics.promptMetrics)
    .map(([path, metric]) => ({ path, ...metric }))
    .filter(p => p.total > 0)
    .sort((a, b) => {
      if (Math.abs(b.successRate - a.successRate) > 0.01) {
        return b.successRate - a.successRate;
      }
      return b.total - a.total;
    })
    .slice(0, 10);

  if (prompts.length === 0) {
    const emptyMsg = createElement('p', 'muted small-text text-center pad-lg', 'No prompts used yet');
    container.appendChild(emptyMsg);
    return;
  }

  prompts.forEach((prompt, index) => {
    const successRate = (prompt.successRate * 100).toFixed(0);
    const prRate = (prompt.prRate * 100).toFixed(0);
    const displayPath = prompt.path.replace(/^prompts\//, '');
    const badgeClass = prompt.successRate >= 0.8 ? 'success' : prompt.successRate >= 0.5 ? 'warn' : 'danger';
    
    const item = createElement('div', 'item');
    
    const content = createElement('div', 'prompt-item__content');
    
    const rank = createElement('span', 'pill prompt-item__rank', String(index + 1));
    
    const details = createElement('div', 'prompt-item__details');
    const title = createElement('div', 'item-title', displayPath);
    const meta = createElement('div', 'item-meta');
    meta.textContent = `${prompt.total} use${prompt.total !== 1 ? 's' : ''} • ${successRate}% success • ${prRate}% with PRs`;
    
    details.appendChild(title);
    details.appendChild(meta);
    content.appendChild(rank);
    content.appendChild(details);
    
    const badge = createElement('span', `status-badge status-badge--${badgeClass}`, `${successRate}%`);
    
    item.appendChild(content);
    item.appendChild(badge);
    container.appendChild(item);
  });
}

function renderFailureAnalysis(analytics) {
  const container = document.getElementById('failureAnalysisContainer');
  if (!container) return;

  container.textContent = '';

  const recentFailures = analytics.recentFailures || [];

  if (recentFailures.length === 0) {
    const emptyMsg = createElement('p', 'muted small-text text-center pad-lg', 'No failures recorded');
    container.appendChild(emptyMsg);
    return;
  }

  recentFailures.forEach(failure => {
    const item = createElement('div', 'item');
    
    const content = createElement('div', 'failure-item__content');
    const title = createElement('div', 'pr-title', failure.title || 'Failed Session');
    
    const meta = createElement('div', 'item-meta');
    
    // Failure reason if available
    if (failure.reason) {
      const reason = failure.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const reasonSpan = createElement('span', 'failure-reason', reason);
      meta.appendChild(reasonSpan);
      
      // Separator
      const sep = createElement('span', 'muted', ' • ');
      meta.appendChild(sep);
    }
    
    // Session link
    const sessionLink = document.createElement('a');
    sessionLink.href = failure.sessionUrl;
    sessionLink.target = '_blank';
    sessionLink.rel = 'noopener';
    sessionLink.className = 'pr-link';
    const sessionIcon = createIcon('smart_toy', 'icon-inline');
    sessionLink.appendChild(sessionIcon);
    sessionLink.appendChild(document.createTextNode(' View Session'));
    meta.appendChild(sessionLink);
    
    // Separator and Prompt button
    if (failure.promptContent) {
      const sep2 = createElement('span', 'muted', ' • ');
      meta.appendChild(sep2);
      
      // Prompt viewer button
      const promptBtn = document.createElement('button');
      promptBtn.className = 'pr-link pr-link--btn';
      promptBtn.title = 'View prompt content';
      const promptIcon = createIcon('visibility', 'icon-inline');
      promptBtn.appendChild(promptIcon);
      promptBtn.appendChild(document.createTextNode(' View Prompt'));
      
      promptBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPromptViewer(failure.promptContent, failure.sessionId);
      });
      
      meta.appendChild(promptBtn);
    }
    
    content.appendChild(title);
    content.appendChild(meta);
    item.appendChild(content);
    container.appendChild(item);
  });
}

function renderRepoPerformance(analytics) {
  const container = document.getElementById('repoPerformanceContainer');
  if (!container) return;

  container.textContent = '';

  const repos = Object.entries(analytics.repoMetrics)
    .map(([id, metric]) => ({ id, ...metric }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (repos.length === 0) {
    const emptyMsg = createElement('p', 'muted small-text text-center pad-lg', 'No repository data');
    container.appendChild(emptyMsg);
    return;
  }

  repos.forEach(repo => {
    const prRate = (repo.prRate * 100).toFixed(0);
    const displayName = repo.id.replace('sources/github/', '');
    const badgeClass = repo.prRate >= 0.7 ? 'success' : repo.prRate >= 0.4 ? 'warn' : 'danger';
    
    const item = createElement('div', 'item');
    
    const content = createElement('div', 'repo-item__content');
    const title = createElement('div', 'item-title', displayName);
    const meta = createElement('div', 'item-meta');
    meta.textContent = `${repo.total} session${repo.total !== 1 ? 's' : ''} • ${repo.withPRs} PR${repo.withPRs !== 1 ? 's' : ''}`;
    
    content.appendChild(title);
    content.appendChild(meta);
    
    const badge = createElement('span', `status-badge status-badge--${badgeClass}`, `${prRate}% PRs`);
    
    item.appendChild(content);
    item.appendChild(badge);
    container.appendChild(item);
  });
}

function renderRecentPRs(analytics) {
  const container = document.getElementById('recentPRsContainer');
  if (!container) return;

  container.textContent = '';

  const recentPRs = analytics.prUrls.slice(0, 10);

  if (recentPRs.length === 0) {
    const emptyMsg = createElement('p', 'muted small-text text-center pad-lg', 'No PRs created yet');
    container.appendChild(emptyMsg);
    return;
  }

  recentPRs.forEach(pr => {
    const item = createElement('div', 'item');
    
    const content = createElement('div', 'pr-item__content');
    const title = createElement('div', 'pr-title', pr.title || 'Pull Request');
    
    const meta = createElement('div', 'item-meta');
    
    // Jules session link
    const julesLink = document.createElement('a');
    julesLink.href = pr.sessionUrl;
    julesLink.target = '_blank';
    julesLink.rel = 'noopener';
    julesLink.className = 'pr-link';
    const julesIcon = createIcon('smart_toy', 'icon-inline');
    julesLink.appendChild(julesIcon);
    julesLink.appendChild(document.createTextNode(' View Session'));
    meta.appendChild(julesLink);
    
    // Separator
    const sep1 = createElement('span', 'muted', ' • ');
    meta.appendChild(sep1);
    
    // PR link
    const prLink = document.createElement('a');
    prLink.href = pr.url;
    prLink.target = '_blank';
    prLink.rel = 'noopener';
    prLink.className = 'pr-link';
    const prIcon = createIcon('open_in_new', 'icon-inline');
    prLink.appendChild(prIcon);
    prLink.appendChild(document.createTextNode(' View PR'));
    meta.appendChild(prLink);
    
    // Separator
    const sep2 = createElement('span', 'muted', ' • ');
    meta.appendChild(sep2);
    
    // Prompt viewer button (eye icon)
    const promptBtn = document.createElement('button');
    promptBtn.className = pr.promptContent ? 'pr-link pr-link--btn' : 'pr-link pr-link--disabled';
    promptBtn.title = pr.promptContent ? 'View prompt content' : 'No prompt content available';
    if (!pr.promptContent) {
      promptBtn.disabled = true;
    }
    const promptIcon = createIcon('visibility', 'icon-inline');
    promptBtn.appendChild(promptIcon);
    promptBtn.appendChild(document.createTextNode(' View Prompt'));
    
    if (pr.promptContent) {
      promptBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPromptViewer(pr.promptContent, pr.sessionId);
      });
    }
    
    meta.appendChild(promptBtn);
    
    content.appendChild(title);
    content.appendChild(meta);
    item.appendChild(content);
    container.appendChild(item);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
