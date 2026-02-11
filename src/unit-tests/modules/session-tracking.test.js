import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncActiveSessions } from '../../modules/session-tracking.js';
import * as firebaseService from '../../modules/firebase-service.js';
import * as julesApi from '../../modules/jules-api.js';
import * as firestoreHelpers from '../../utils/firestore-helpers.js';

// Mock dependencies
vi.mock('../../modules/firebase-service.js');
vi.mock('../../modules/jules-api.js');
vi.mock('../../utils/firestore-helpers.js');
vi.mock('../../utils/error-handler.js');

describe('Session Tracking Module', () => {
  let mockUser;
  let mockDb;
  let mockCollection;
  let mockDoc;
  let mockSessionsCollection;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock User
    mockUser = { uid: 'test-user-123' };
    vi.spyOn(firebaseService, 'getAuth').mockReturnValue({ currentUser: mockUser });

    // Mock Firestore
    mockSessionsCollection = {
      doc: vi.fn(),
      get: vi.fn() // For getting all local sessions
    };

    mockDoc = {
        set: vi.fn().mockResolvedValue(true),
        update: vi.fn().mockResolvedValue(true),
        get: vi.fn()
    };

    // Chain: db.collection('juleSessions').doc(uid).collection('sessions')
    mockCollection = {
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue(mockSessionsCollection)
      })
    };

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    };

    vi.spyOn(firebaseService, 'getDb').mockReturnValue(mockDb);

    // Mock API Key
    vi.spyOn(julesApi, 'getDecryptedJulesKey').mockResolvedValue('fake-api-key');

    // Mock Server Timestamp
    vi.spyOn(firestoreHelpers, 'getServerTimestamp').mockReturnValue('SERVER_TIMESTAMP');
  });

  describe('syncActiveSessions', () => {
    it('should update sessions when local data is missing (new session)', async () => {
        // Setup API response
        const apiSession = {
            id: 'session-1',
            name: 'sessions/session-1',
            updateTime: '2023-01-02T12:00:00Z',
            state: 'COMPLETED'
        };
        vi.spyOn(julesApi, 'listJulesSessions').mockResolvedValue({
            sessions: [apiSession],
            nextPageToken: null
        });

        // Setup Local DB (empty)
        mockSessionsCollection.get.mockResolvedValue({
            docs: [] // No local sessions
        });

        // Setup set/doc mocks
        mockSessionsCollection.doc.mockReturnValue(mockDoc);

        await syncActiveSessions();

        // Should have called set
        expect(mockSessionsCollection.doc).toHaveBeenCalledWith('session-1');
        expect(mockDoc.set).toHaveBeenCalledTimes(1);
        expect(mockDoc.set).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'session-1',
            status: 'COMPLETED'
        }), { merge: true });
    });

    it('should update sessions when API has newer timestamp', async () => {
        // API: newer
        const apiUpdateTimeStr = '2023-01-02T12:00:00Z';
        const apiSession = {
            id: 'session-1',
            updateTime: apiUpdateTimeStr,
            state: 'COMPLETED'
        };
        vi.spyOn(julesApi, 'listJulesSessions').mockResolvedValue({
            sessions: [apiSession],
            nextPageToken: null
        });

        // Local: older
        const localUpdateTimeDate = new Date('2023-01-01T12:00:00Z');
        // Mock Firestore Timestamp behavior if needed, or just use Date
        // The code uses .toDate() if available, else new Date()
        const localDocData = {
            apiUpdateTime: {
                toDate: () => localUpdateTimeDate
            },
            status: 'IN_PROGRESS'
        };

        mockSessionsCollection.get.mockResolvedValue({
            docs: [{
                id: 'session-1',
                ref: {},
                data: () => localDocData
            }]
        });

        mockSessionsCollection.doc.mockReturnValue(mockDoc);

        await syncActiveSessions();

        // Should update because API is newer
        expect(mockDoc.set).toHaveBeenCalledTimes(1);
    });

    it('should NOT update sessions when API timestamp is same as local', async () => {
         // API: same
         const timeStr = '2023-01-01T12:00:00Z';
         const apiSession = {
             id: 'session-1',
             updateTime: timeStr,
             state: 'COMPLETED'
         };
         vi.spyOn(julesApi, 'listJulesSessions').mockResolvedValue({
             sessions: [apiSession],
             nextPageToken: null
         });

         // Local: same
         const localDocData = {
             apiUpdateTime: {
                 toDate: () => new Date(timeStr)
             },
             status: 'COMPLETED'
         };

         mockSessionsCollection.get.mockResolvedValue({
             docs: [{
                 id: 'session-1',
                 ref: {},
                 data: () => localDocData
             }]
         });

         mockSessionsCollection.doc.mockReturnValue(mockDoc);

         await syncActiveSessions();

         // Should NOT update
         // NOTE: This assertion will FAIL until we implement the fix
         expect(mockDoc.set).not.toHaveBeenCalled();
    });

    it('should update sessions when local timestamp is missing/corrupt', async () => {
         // API: valid
         const timeStr = '2023-01-01T12:00:00Z';
         const apiSession = {
             id: 'session-1',
             updateTime: timeStr,
             state: 'COMPLETED'
         };
         vi.spyOn(julesApi, 'listJulesSessions').mockResolvedValue({
             sessions: [apiSession],
             nextPageToken: null
         });

         // Local: missing apiUpdateTime
         const localDocData = {
             // apiUpdateTime is undefined
             status: 'COMPLETED'
         };

         mockSessionsCollection.get.mockResolvedValue({
             docs: [{
                 id: 'session-1',
                 ref: {},
                 data: () => localDocData
             }]
         });

         mockSessionsCollection.doc.mockReturnValue(mockDoc);

         await syncActiveSessions();

         // Should update to fix the data
         expect(mockDoc.set).toHaveBeenCalledTimes(1);
    });
  });
});
