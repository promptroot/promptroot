export const testUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  githubToken: process.env.GITHUB_TEST_TOKEN || 'test-token',
  githubUsername: process.env.GITHUB_TEST_USERNAME || 'testuser'
};

export const testPrompts = [
  {
    name: 'test-prompt.md',
    path: 'prompts/test-prompt.md',
    content: '# Test Prompt\n\nThis is a comprehensive test prompt for E2E testing.',
    owner: 'jessewashburn',
    repo: 'prompt-sharing',
    branch: 'main'
  },
  {
    name: 'example-task.md',
    path: 'prompts/examples/example-task.md',
    content: '# Example Task\n\nStep-by-step instructions for testing.',
    owner: 'jessewashburn',
    repo: 'prompt-sharing',
    branch: 'main'
  },
  {
    name: 'tutorial-prompt.md',
    path: 'prompts/tutorial/tutorial-prompt.md',
    content: '# Tutorial Prompt\n\nThis is a tutorial example.',
    owner: 'jessewashburn',
    repo: 'prompt-sharing',
    branch: 'main'
  }
];

export const testRepos = [
  { 
    owner: 'jessewashburn', 
    repo: 'prompt-sharing', 
    branch: 'main',
    displayName: 'Main Repository'
  },
  { 
    owner: 'jessewashburn', 
    repo: 'test-prompts', 
    branch: 'main',
    displayName: 'Test Repository'
  }
];

export const testJulesConfig = {
  apiKey: 'test-jules-api-key',
  endpoint: 'https://api.jules.test/v1'
};

export const testQueueItems = [
  {
    id: 'queue-item-1',
    promptName: 'Test Prompt 1',
    status: 'pending',
    createdAt: new Date('2026-01-20T10:00:00Z')
  },
  {
    id: 'queue-item-2',
    promptName: 'Test Prompt 2',
    status: 'processing',
    createdAt: new Date('2026-01-20T11:00:00Z')
  },
  {
    id: 'queue-item-3',
    promptName: 'Test Prompt 3',
    status: 'completed',
    createdAt: new Date('2026-01-20T12:00:00Z')
  }
];
