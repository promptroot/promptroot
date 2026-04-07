import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importJulesHistory } from '../../modules/session-tracking.js';
import * as firebaseService from '../../modules/firebase-service.js';
import * as julesApi from '../../modules/jules-api.js';
import * as firestoreHelpers from '../../utils/firestore-helpers.js';

// Mock dependencies
vi.mock('../../modules/firebase-service.js');
vi.mock('../../modules/jules-api.js');
vi.mock('../../utils/firestore-helpers.js');
vi.mock('../../utils/error-handler.js');

const LATENCY_MS = 50;
const SESSION_COUNT = 100;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('importJulesHistory Benchmark', () => {
  let mockUser;
  let mockDb;
  let mockSessionsCollection;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'test-user-123' };
    vi.spyOn(firebaseService, 'getAuth').mockReturnValue({ currentUser: mockUser });

    mockSessionsCollection = {
      doc: vi.fn((id) => ({
        get: async () => {
          await delay(LATENCY_MS);
          return { exists: false };
        },
        set: async () => {
          await delay(LATENCY_MS);
          return true;
        }
      })),
      get: async () => {
          await delay(LATENCY_MS);
          return { docs: [] };
      }
    };

    mockDb = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue(mockSessionsCollection)
        })
      })
    };

    vi.spyOn(firebaseService, 'getDb').mockReturnValue(mockDb);
    vi.spyOn(julesApi, 'getDecryptedJulesKey').mockResolvedValue('fake-api-key');
    vi.spyOn(firestoreHelpers, 'getServerTimestamp').mockReturnValue('SERVER_TIMESTAMP');
  });

  it(`measures performance of importing ${SESSION_COUNT} sessions`, async () => {
    const sessions = Array.from({ length: SESSION_COUNT }, (_, i) => ({
      id: `session-${i}`,
      name: `sessions/session-${i}`,
      state: 'COMPLETED',
      updateTime: new Date().toISOString()
    }));

    vi.spyOn(julesApi, 'listJulesSessions').mockResolvedValue({
      sessions: sessions,
      nextPageToken: null
    });

    const startTime = Date.now();
    await importJulesHistory();
    const endTime = Date.now();

    console.log(`Benchmark Results:`);
    console.log(`- Sessions: ${SESSION_COUNT}`);
    console.log(`- Simulated Latency: ${LATENCY_MS}ms`);
    console.log(`- Total Time: ${endTime - startTime}ms`);
  });
});
