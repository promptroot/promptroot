/**
 * Profile Page Initialization
 * Handles user profile page functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { TIMEOUTS } from '../utils/constants.js';
import { getUserCopens, addCustomCopen, updateCustomCopen, deleteCustomCopen, toggleDefaultCopen, getCustomCopenIcon } from '../modules/copen-manager.js';
import { showToast } from '../modules/toast.js';
import { showConfirm } from '../modules/confirm-modal.js';
import { clearCopenCache } from '../modules/copen.js';
import { showJulesKeyModal } from '../modules/jules-modal.js';
import { deleteStoredJulesKey, checkJulesKey } from '../modules/jules-keys.js';
import { renderStatus, STATUS_TYPES } from '../modules/status-renderer.js';

let currentUser = null;
let editingCopenId = null;

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function loadProfile(user) {
  const profileUserName = document.getElementById('profileUserName');
  
  if (!user) {
    if (profileUserName) {
      profileUserName.textContent = 'Not signed in';
    }
    return;
  }

  if (profileUserName) {
    profileUserName.textContent = user.displayName || user.email || 'User';
  }

  await loadJulesKeyStatus(user);
  await loadCopens(user);
}

async function loadJulesKeyStatus(user) {
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const noJulesKeySection = document.getElementById('noJulesKeySection');
  const julesKeyDangerZone = document.getElementById('julesKeyDangerZone');
  
  if (!julesKeyStatus) return;
  
  try {
    const hasKey = await checkJulesKey(user.uid);
    
    renderStatus(
      julesKeyStatus,
      hasKey ? STATUS_TYPES.SAVED : STATUS_TYPES.NOT_SAVED,
      hasKey ? 'Saved' : 'Not saved'
    );
    
    if (noJulesKeySection) {
      if (hasKey) {
        noJulesKeySection.classList.add('hidden');
      } else {
        noJulesKeySection.classList.remove('hidden');
      }
    }
    
    if (julesKeyDangerZone) {
      if (hasKey) {
        julesKeyDangerZone.classList.remove('hidden');
      } else {
        julesKeyDangerZone.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Error loading Jules key status:', error);
    renderStatus(julesKeyStatus, STATUS_TYPES.NOT_SAVED, 'Error');
  }
}

async function loadCopens(user) {
  const copenList = document.getElementById('copenList');
  if (!copenList) return;

  copenList.innerHTML = '<div class="muted-text text-center pad-md">Loading...</div>';

  try {
    const copens = await getUserCopens(user.uid);
    renderCopenList(copens);
  } catch (error) {
    console.error('Error loading copens:', error);
    copenList.innerHTML = '<div class="muted-text text-center pad-md">Error loading copens</div>';
  }
}

function renderCopenList(copens) {
  const copenList = document.getElementById('copenList');
  if (!copenList) return;

  if (copens.length === 0) {
    copenList.innerHTML = '<div class="muted-text text-center pad-md">No copens available</div>';
    return;
  }

  copenList.innerHTML = copens.map((copen, index) => createCopenItem(copen, index, copens.length)).join('');

  // Attach drag event listeners
  let draggedElement = null;

  copenList.querySelectorAll('.copen-drag-handle').forEach(handle => {
    handle.addEventListener('dragstart', (e) => {
      draggedElement = handle.closest('.copen-item');
      draggedElement.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    handle.addEventListener('dragend', (e) => {
      if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
      }
    });
  });

  copenList.querySelectorAll('.copen-item').forEach(item => {
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(copenList, e.clientY);
      if (draggedElement && afterElement == null) {
        copenList.appendChild(draggedElement);
      } else if (draggedElement) {
        copenList.insertBefore(draggedElement, afterElement);
      }
    });

    item.addEventListener('drop', async (e) => {
      e.preventDefault();
    });
  });

  // Final drop handler on container
  const dropHandler = async (e) => {
    e.preventDefault();
    if (draggedElement) {
      // Get new order from DOM
      const items = Array.from(copenList.querySelectorAll('.copen-item'));
      const newOrder = items.map(item => item.dataset.copenId);
      
      // Reorder copens array to match DOM
      const reordered = newOrder.map(id => copens.find(c => c.id === id)).filter(Boolean);
      
      // Update the copens array
      copens.length = 0;
      copens.push(...reordered);
      
      clearCopenCache();
      showToast('Copen order updated');
    }
  };
  
  copenList.removeEventListener('drop', dropHandler);
  copenList.addEventListener('drop', dropHandler);

  // Attach click event listeners
  copenList.querySelectorAll('[data-action="edit-copen"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditCopen(btn.dataset.copenId));
  });

  copenList.querySelectorAll('[data-action="delete-copen"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteCopen(btn.dataset.copenId));
  });

  copenList.querySelectorAll('[data-action="toggle-copen"]').forEach(btn => {
    btn.addEventListener('click', () => handleToggleCopen(btn.dataset.copenId, btn.dataset.enabled === 'true'));
  });
}

function createCopenItem(copen, index, totalCount) {
  const isDisabled = copen.disabled || false;
  const defaultBadge = copen.isDefault ? '<span class="copen-item-default-badge">Default</span>' : '';
  
  // Edit/delete buttons
  const editButtons = `
    <button class="btn-icon" data-action="edit-copen" data-copen-id="${copen.id}" title="Edit">
      <span class="icon" aria-hidden="true">edit</span>
    </button>
    <button class="btn-icon" data-action="delete-copen" data-copen-id="${copen.id}" title="${copen.isDefault ? 'Disable' : 'Delete'}">
      <span class="icon" aria-hidden="true">delete</span>
    </button>
  `;

  return `
    <div class="copen-item ${isDisabled ? 'disabled' : ''}" data-copen-id="${copen.id}">
      <div class="copen-drag-handle" draggable="true">
        <span class="icon" aria-hidden="true">drag_indicator</span>
      </div>
      <div class="copen-item-left">
        <div class="copen-item-icon">
          <span class="icon" aria-hidden="true">${copen.icon}</span>
        </div>
        <div class="copen-item-info">
          <div class="copen-item-label">
            ${copen.label}
            ${defaultBadge}
          </div>
          <div class="copen-item-url">${copen.url}</div>
        </div>
      </div>
      <div class="copen-item-actions">
        ${editButtons}
      </div>
    </div>
  `;
}

function showCopenEditor(copenId = null, existingData = null) {
  const modal = document.getElementById('copenEditorModal');
  const title = document.getElementById('copenEditorTitle');
  const labelInput = document.getElementById('copenLabel');
  const urlInput = document.getElementById('copenUrl');
  const iconInput = document.getElementById('copenIcon');

  if (!modal) return;

  editingCopenId = copenId;

  if (existingData) {
    title.textContent = 'Edit Copen Link';
    labelInput.value = existingData.label;
    urlInput.value = existingData.url;
    iconInput.value = existingData.icon || getCustomCopenIcon();
  } else {
    title.textContent = 'Add Copen Link';
    labelInput.value = '';
    urlInput.value = '';
    iconInput.value = getCustomCopenIcon();
  }

  modal.style.display = 'flex';
  labelInput.focus();
}

function hideCopenEditor() {
  const modal = document.getElementById('copenEditorModal');
  if (modal) {
    modal.style.display = 'none';
  }
  editingCopenId = null;
}

async function handleSaveCopen() {
  const labelInput = document.getElementById('copenLabel');
  const urlInput = document.getElementById('copenUrl');
  const iconInput = document.getElementById('copenIcon');

  const label = labelInput.value.trim();
  const url = urlInput.value.trim();
  const icon = iconInput.value.trim() || getCustomCopenIcon();

  if (!label || !url) {
    showToast('Label and URL are required', 'warn');
    return;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    showToast('Invalid URL format', 'warn');
    return;
  }

  if (!currentUser) {
    showToast('Not signed in', 'warn');
    return;
  }

  try {
    if (editingCopenId) {
      await updateCustomCopen(currentUser.uid, editingCopenId, { label, url, icon });
      showToast('Copen updated', 'success');
    } else {
      await addCustomCopen(currentUser.uid, { label, url, icon });
      showToast('Copen added', 'success');
    }

    clearCopenCache();
    hideCopenEditor();
    await loadCopens(currentUser);
  } catch (error) {
    console.error('Error saving copen:', error);
    showToast('Failed to save copen', 'error');
  }
}

async function handleEditCopen(copenId) {
  if (!currentUser) return;

  try {
    const copens = await getUserCopens(currentUser.uid);
    const copen = copens.find(c => c.id === copenId);
    if (copen && !copen.isDefault) {
      showCopenEditor(copenId, copen);
    }
  } catch (error) {
    console.error('Error loading copen for edit:', error);
    showToast('Failed to load copen', 'error');
  }
}

async function handleDeleteCopen(copenId) {
  if (!currentUser) return;

  const confirmed = await showConfirm('Are you sure you want to delete this custom copen?', {
    title: 'Delete Custom Copen',
    confirmText: 'Delete',
    confirmClass: 'danger'
  });

  if (!confirmed) return;

  try {
    clearCopenCache();
    await deleteCustomCopen(currentUser.uid, copenId);
    showToast('Copen deleted', 'success');
    await loadCopens(currentUser);
  } catch (error) {
    console.error('Error deleting copen:', error);
    showToast('Failed to delete copen', 'error');
  }
}

async function handleToggleCopen(copenId, currentlyEnabled) {
  if (!currentUser) return;

  try {
    await toggleDefaultCopen(currentUser.uid, copenId, !currentlyEnabled);
    clearCopenCache();
    showToast(currentlyEnabled ? 'Copen disabled' : 'Copen enabled', 'success');
    await loadCopens(currentUser);
  } catch (error) {
    console.error('Error toggling copen:', error);
    showToast('Failed to toggle copen', 'error');
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.copen-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function handleToggleCopen_UNUSED(copenId) {
  if (!currentUser) return;
  
  try {
    const copens = await getUserCopens(currentUser.uid);
    const currentIndex = copens.findIndex(c => c.id === copenId);
    
    if (currentIndex < 0 || currentIndex >= copens.length - 1) return; // Already at bottom
    
    // Swap with item below
    [copens[currentIndex], copens[currentIndex + 1]] = [copens[currentIndex + 1], copens[currentIndex]];
    
    // Save new order (this will need a new function in copen-manager)
    clearCopenCache();
    showToast('Copen moved down', 'success');
    renderCopenList(copens);
  } catch (error) {
    console.error('Error moving copen:', error);
    showToast('Failed to move copen', 'error');
  }
}

async function initApp() {
  try {
    await waitForFirebase();
    const auth = getAuth();
    
    // Set up event listeners
    const addCopenBtn = document.getElementById('addCopenBtn');
    const copenEditorSave = document.getElementById('copenEditorSave');
    const copenEditorCancel = document.getElementById('copenEditorCancel');
    const copenEditorClose = document.getElementById('copenEditorClose');
    const addJulesKeyBtn = document.getElementById('addJulesKeyBtn');
    const resetJulesKeyBtn = document.getElementById('resetJulesKeyBtn');

    if (addCopenBtn) {
      addCopenBtn.addEventListener('click', () => showCopenEditor());
    }

    if (copenEditorSave) {
      copenEditorSave.addEventListener('click', handleSaveCopen);
    }

    if (copenEditorCancel) {
      copenEditorCancel.addEventListener('click', hideCopenEditor);
    }

    if (copenEditorClose) {
      copenEditorClose.addEventListener('click', hideCopenEditor);
    }
    
    // Jules API key handlers
    if (addJulesKeyBtn) {
      addJulesKeyBtn.addEventListener('click', () => {
        showJulesKeyModal(() => {
          // Reload Jules key status after saving
          if (currentUser) {
            loadJulesKeyStatus(currentUser);
            showToast('Jules API key saved successfully', 'success');
          }
        });
      });
    }
    
    if (resetJulesKeyBtn) {
      resetJulesKeyBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm('This will delete your stored Jules API key. You\'ll need to enter a new one next time.', {
          title: 'Delete API Key',
          confirmText: 'Delete',
          confirmClass: 'danger'
        });
        if (!confirmed) return;
        
        try {
          if (!currentUser) return;
          
          resetJulesKeyBtn.disabled = true;
          resetJulesKeyBtn.textContent = 'Deleting...';
          
          const deleted = await deleteStoredJulesKey(currentUser.uid);
          if (deleted) {
            // Restore button
            resetJulesKeyBtn.innerHTML = '<span class=\"icon icon-inline\" aria-hidden=\"true\">delete</span> Delete Jules API Key';
            resetJulesKeyBtn.disabled = false;
            
            await loadJulesKeyStatus(currentUser);
            showToast('Jules API key has been deleted', 'success');
          } else {
            throw new Error('Failed to delete key');
          }
        } catch (error) {
          showToast('Failed to delete API key: ' + error.message, 'error');
          resetJulesKeyBtn.innerHTML = '<span class=\"icon icon-inline\" aria-hidden=\"true\">delete</span> Delete Jules API Key';
          resetJulesKeyBtn.disabled = false;
        }
      });
    }

    // Close modal on outside click
    const modal = document.getElementById('copenEditorModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-overlay')) {
          hideCopenEditor();
        }
      });
    }

    auth.onAuthStateChanged((user) => {
      currentUser = user;
      if (user) {
        loadProfile(user);
      } else {
        const profileUserName = document.getElementById('profileUserName');
        if (profileUserName) {
          profileUserName.innerHTML = '<div class="muted-text text-center pad-xl">Please sign in to view your profile.</div>';
        }
        const copenManagementSection = document.getElementById('copenManagementSection');
        if (copenManagementSection) {
          copenManagementSection.style.display = 'none';
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
