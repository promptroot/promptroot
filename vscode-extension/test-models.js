// Quick test to verify models work correctly
const { isBatchQueueItem, isSingleQueueItem } = require('./out/models.js');

// Test data matching web app structure
const batchItem = {
  id: 'test-batch',
  type: 'subtasks',
  status: 'pending',
  sourceId: 'test',
  branch: 'main',
  remaining: [
    { fullContent: 'Test content 1' },
    { fullContent: 'Test content 2' }
  ],
  totalCount: 2,
  completedCount: 0,
  failedCount: 0,
  createdAt: new Date(),
  updatedAt: new Date()
};

const singleItem = {
  id: 'test-single',
  type: 'single',
  status: 'pending',
  prompt: 'Test prompt',
  sourceId: 'test',
  branch: 'main',
  createdAt: new Date(),
  updatedAt: new Date()
};

console.log('Testing batch item:', isBatchQueueItem(batchItem));
console.log('Testing single item:', isSingleQueueItem(singleItem));
console.log('Cross-testing batch as single:', isSingleQueueItem(batchItem));
console.log('Cross-testing single as batch:', isBatchQueueItem(singleItem));