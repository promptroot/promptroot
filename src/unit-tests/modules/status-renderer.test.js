import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STATUS_TYPES, renderStatus } from '../../modules/status-renderer.js';

// Mock dependencies
vi.mock('../../utils/dom-helpers.js', () => ({
  createIcon: vi.fn((iconName, classes) => {
    const icon = {
      tagName: 'SPAN',
      className: classes ? classes.join(' ') : '',
      dataset: { icon: iconName },
      textContent: '',
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn()
      }
    };
    return icon;
  }),
  clearElement: vi.fn()
}));

global.document = {
  createTextNode: vi.fn((text) => ({
    nodeType: 3,
    textContent: text,
    nodeValue: text
  }))
};

const createMockContainer = () => ({
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(),
    toggle: vi.fn()
  },
  appendChild: vi.fn(),
  textContent: '',
  innerHTML: ''
});

function mockReset() {
  vi.clearAllMocks();
}

describe('status-renderer', () => {
  beforeEach(() => {
    mockReset();
  });

  describe('STATUS_TYPES', () => {
    it('should export all status type constants', () => {
      expect(STATUS_TYPES).toBeDefined();
      expect(STATUS_TYPES.SAVED).toBe('saved');
      expect(STATUS_TYPES.NOT_SAVED).toBe('not-saved');
      expect(STATUS_TYPES.LOADING).toBe('loading');
      expect(STATUS_TYPES.ERROR).toBe('error');
      expect(STATUS_TYPES.SUCCESS).toBe('success');
      expect(STATUS_TYPES.DELETING).toBe('deleting');
      expect(STATUS_TYPES.RESET).toBe('reset');
    });

    it('should have 7 status types', () => {
      expect(Object.keys(STATUS_TYPES)).toHaveLength(7);
    });

    it('should have unique values', () => {
      const values = Object.values(STATUS_TYPES);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('renderStatus', () => {
    let container;

    beforeEach(async () => {
      container = createMockContainer();
      const { clearElement } = await import('../../utils/dom-helpers.js');
      clearElement.mockImplementation(() => {});
    });

    it('should do nothing if container is null', async () => {
      const { clearElement } = await import('../../utils/dom-helpers.js');
      
      renderStatus(null, STATUS_TYPES.SUCCESS);
      
      expect(clearElement).not.toHaveBeenCalled();
    });

    it('should do nothing if container is undefined', async () => {
      const { clearElement } = await import('../../utils/dom-helpers.js');
      
      renderStatus(undefined, STATUS_TYPES.SUCCESS);
      
      expect(clearElement).not.toHaveBeenCalled();
    });

    it('should clear existing container content', async () => {
      const { clearElement } = await import('../../utils/dom-helpers.js');
      
      renderStatus(container, STATUS_TYPES.SUCCESS);
      
      expect(clearElement).toHaveBeenCalledWith(container);
    });

    it('should remove all color classes before applying new ones', () => {
      renderStatus(container, STATUS_TYPES.SUCCESS);
      
      expect(container.classList.remove).toHaveBeenCalledWith(
        'color-accent', 'color-muted', 'color-error', 'color-success',
        'status-saved', 'status-not-saved', 'status-outdated',
        'status-error', 'status-success', 'status-info', 'status-loading'
      );
    });

    describe('SAVED status', () => {
      it('should render check_circle icon', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, STATUS_TYPES.SAVED);
        
        expect(createIcon).toHaveBeenCalledWith('check_circle', ['icon-inline']);
      });

      it('should add status-saved class', () => {
        renderStatus(container, STATUS_TYPES.SAVED);
        
        expect(container.classList.add).toHaveBeenCalledWith('status-saved');
      });

      it('should append icon to container', () => {
        renderStatus(container, STATUS_TYPES.SAVED);
        
        expect(container.appendChild).toHaveBeenCalled();
      });

      it('should display custom label if provided', () => {
        renderStatus(container, STATUS_TYPES.SAVED, 'Saved successfully');
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Saved successfully');
        expect(container.appendChild).toHaveBeenCalledTimes(2); // Icon + text
      });

      it('should not display label if not provided', () => {
        renderStatus(container, STATUS_TYPES.SAVED);
        
        expect(global.document.createTextNode).not.toHaveBeenCalled();
        expect(container.appendChild).toHaveBeenCalledTimes(1); // Icon only
      });
    });

    describe('NOT_SAVED status', () => {
      it('should render cancel icon', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, STATUS_TYPES.NOT_SAVED);
        
        expect(createIcon).toHaveBeenCalledWith('cancel', ['icon-inline']);
      });

      it('should add status-not-saved class', () => {
        renderStatus(container, STATUS_TYPES.NOT_SAVED);
        
        expect(container.classList.add).toHaveBeenCalledWith('status-not-saved');
      });
    });

    describe('LOADING status', () => {
      it('should render hourglass_top icon', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, STATUS_TYPES.LOADING);
        
        expect(createIcon).toHaveBeenCalledWith('hourglass_top', ['icon-inline']);
      });

      it('should not add any color class', () => {
        renderStatus(container, STATUS_TYPES.LOADING);
        
        // Should only remove classes, not add any
        expect(container.classList.add).not.toHaveBeenCalled();
      });

      it('should display loading message if provided', () => {
        renderStatus(container, STATUS_TYPES.LOADING, 'Loading data...');
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Loading data...');
      });
    });

    describe('ERROR status', () => {
      it('should render error icon', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, STATUS_TYPES.ERROR);
        
        expect(createIcon).toHaveBeenCalledWith('error', ['icon-inline']);
      });

      it('should add status-error class', () => {
        renderStatus(container, STATUS_TYPES.ERROR);
        
        expect(container.classList.add).toHaveBeenCalledWith('status-error');
      });

      it('should display error message if provided', () => {
        renderStatus(container, STATUS_TYPES.ERROR, 'Failed to load');
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Failed to load');
      });
    });

    describe('SUCCESS status', () => {
      it('should render check_circle icon', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, STATUS_TYPES.SUCCESS);
        
        expect(createIcon).toHaveBeenCalledWith('check_circle', ['icon-inline']);
      });

      it('should add status-success class', () => {
        renderStatus(container, STATUS_TYPES.SUCCESS);
        
        expect(container.classList.add).toHaveBeenCalledWith('status-success');
      });
    });

    describe('DELETING status', () => {
      it('should render hourglass_top icon', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, STATUS_TYPES.DELETING);
        
        expect(createIcon).toHaveBeenCalledWith('hourglass_top', ['icon-inline']);
      });

      it('should not add any color class', () => {
        renderStatus(container, STATUS_TYPES.DELETING);
        
        expect(container.classList.add).not.toHaveBeenCalled();
      });

      it('should display deleting message if provided', () => {
        renderStatus(container, STATUS_TYPES.DELETING, 'Deleting item...');
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Deleting item...');
      });
    });

    describe('RESET status', () => {
      it('should render refresh icon', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, STATUS_TYPES.RESET);
        
        expect(createIcon).toHaveBeenCalledWith('refresh', ['icon-inline']);
      });

      it('should not add any color class', () => {
        renderStatus(container, STATUS_TYPES.RESET);
        
        expect(container.classList.add).not.toHaveBeenCalled();
      });
    });

    describe('unknown status type', () => {
      it('should render info icon for unknown type', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, 'unknown-type');
        
        expect(createIcon).toHaveBeenCalledWith('info', ['icon-inline']);
      });

      it('should not add any color class for unknown type', () => {
        renderStatus(container, 'unknown-type');
        
        expect(container.classList.add).not.toHaveBeenCalled();
      });

      it('should still display label for unknown type', () => {
        renderStatus(container, 'unknown-type', 'Custom status');
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Custom status');
      });
    });

    describe('label handling', () => {
      it('should prepend space to label text', () => {
        renderStatus(container, STATUS_TYPES.SUCCESS, 'Operation complete');
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Operation complete');
      });

      it('should handle empty string label', () => {
        renderStatus(container, STATUS_TYPES.SUCCESS, '');
        
        // Empty string is falsy, so no label is displayed
        expect(global.document.createTextNode).not.toHaveBeenCalled();
      });

      it('should handle numeric label', () => {
        renderStatus(container, STATUS_TYPES.SUCCESS, 42);
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' 42');
      });

      it('should handle multiline label', () => {
        const multilineLabel = 'Line 1\nLine 2';
        renderStatus(container, STATUS_TYPES.ERROR, multilineLabel);
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' ' + multilineLabel);
      });

      it('should handle label with special characters', () => {
        renderStatus(container, STATUS_TYPES.SUCCESS, 'Status: 100% complete!');
        
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Status: 100% complete!');
      });
    });

    describe('multiple sequential calls', () => {
      it('should clear and re-render on each call', async () => {
        const { clearElement } = await import('../../utils/dom-helpers.js');
        
        renderStatus(container, STATUS_TYPES.LOADING);
        renderStatus(container, STATUS_TYPES.SUCCESS);
        renderStatus(container, STATUS_TYPES.ERROR);
        
        expect(clearElement).toHaveBeenCalledTimes(3);
        expect(container.classList.remove).toHaveBeenCalledTimes(3);
      });

      it('should update color classes correctly', () => {
        renderStatus(container, STATUS_TYPES.SAVED);
        expect(container.classList.add).toHaveBeenCalledWith('status-saved');
        
        vi.clearAllMocks();
        renderStatus(container, STATUS_TYPES.ERROR);
        expect(container.classList.add).toHaveBeenCalledWith('status-error');
      });

      it('should change labels correctly', () => {
        renderStatus(container, STATUS_TYPES.LOADING, 'Please wait');
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Please wait');
        
        vi.clearAllMocks();
        renderStatus(container, STATUS_TYPES.SUCCESS, 'Done');
        expect(global.document.createTextNode).toHaveBeenCalledWith(' Done');
      });
    });

    describe('integration scenarios', () => {
      it('should handle complete loading to success flow', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        // Start with loading
        renderStatus(container, STATUS_TYPES.LOADING, 'Fetching data...');
        expect(createIcon).toHaveBeenCalledWith('hourglass_top', ['icon-inline']);
        
        // Complete with success
        vi.clearAllMocks();
        renderStatus(container, STATUS_TYPES.SUCCESS, 'Data loaded');
        expect(createIcon).toHaveBeenCalledWith('check_circle', ['icon-inline']);
        expect(container.classList.add).toHaveBeenCalledWith('status-success');
      });

      it('should handle complete loading to error flow', async () => {
        const { createIcon } = await import('../../utils/dom-helpers.js');
        
        // Start with loading
        renderStatus(container, STATUS_TYPES.LOADING, 'Processing...');
        expect(createIcon).toHaveBeenCalledWith('hourglass_top', ['icon-inline']);
        
        // Fail with error
        vi.clearAllMocks();
        renderStatus(container, STATUS_TYPES.ERROR, 'Processing failed');
        expect(createIcon).toHaveBeenCalledWith('error', ['icon-inline']);
        expect(container.classList.add).toHaveBeenCalledWith('status-error');
      });

      it('should handle saved to not saved transition', async () => {
        renderStatus(container, STATUS_TYPES.SAVED);
        expect(container.classList.add).toHaveBeenCalledWith('status-saved');
        
        vi.clearAllMocks();
        renderStatus(container, STATUS_TYPES.NOT_SAVED);
        expect(container.classList.add).toHaveBeenCalledWith('status-not-saved');
      });
    });
  });
});