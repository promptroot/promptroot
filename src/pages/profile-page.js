/**
 * Profile Page Initialization
 * Handles user profile page functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { TIMEOUTS } from '../utils/constants.js';
import { getUserCopens, addCustomCopen, updateCustomCopen, deleteCustomCopen, toggleDefaultCopen, getCustomCopenIcon, saveCopenOrder, resetToDefaultCopens } from '../modules/copen-manager.js';
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

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'muted-text text-center pad-md';
  loadingDiv.textContent = 'Loading...';
  copenList.replaceChildren(loadingDiv);

  try {
    const copens = await getUserCopens(user.uid);
    console.log('Loaded copens:', copens);
    renderCopenList(copens);
  } catch (error) {
    console.error('Error loading copens:', error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'muted-text text-center pad-md';
    errorDiv.textContent = 'Error loading copens';
    copenList.replaceChildren(errorDiv);
  }
}

function renderCopenList(copens) {
  const copenList = document.getElementById('copenList');
  if (!copenList) return;

  if (copens.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'muted-text text-center pad-md';
    emptyDiv.textContent = 'No copens available';
    copenList.replaceChildren(emptyDiv);
    return;
  }

  const copenItems = copens.map((copen, index) => createCopenItem(copen, index, copens.length));
  copenList.replaceChildren(...copenItems);

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
    if (draggedElement && currentUser) {
      // Get new order from DOM
      const items = Array.from(copenList.querySelectorAll('.copen-item'));
      const newOrder = items.map(item => item.dataset.copenId);
      
      // Reorder copens array to match DOM
      const reordered = newOrder.map(id => copens.find(c => c.id === id)).filter(Boolean);
      
      // Update the copens array
      copens.length = 0;
      copens.push(...reordered);
      
      // Save order to Firestore
      try {
        await saveCopenOrder(currentUser.uid, reordered);
        clearCopenCache();
        window.dispatchEvent(new CustomEvent('copensChanged'));
        showToast('Copen order saved');
      } catch (error) {
        console.error('Error saving copen order:', error);
        showToast('Failed to save order', 'error');
      }
    }
  };
  
  copenList.removeEventListener('drop', dropHandler);
  copenList.addEventListener('drop', dropHandler);

  // Attach click event listeners
  copenList.querySelectorAll('[data-action="edit-copen"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditCopen(btn.dataset.copenId));
  });

  copenList.querySelectorAll('[data-action="toggle-copen"]').forEach(btn => {
    btn.addEventListener('click', () => handleToggleCopen(btn.dataset.copenId, btn.dataset.enabled === 'true'));
  });
}

function createCopenItem(copen, index, totalCount) {
  const isDisabled = copen.disabled || false;
  
  const itemDiv = document.createElement('div');
  itemDiv.className = `copen-item ${isDisabled ? 'disabled' : ''}`;
  itemDiv.dataset.copenId = copen.id;

  const dragHandleDiv = document.createElement('div');
  dragHandleDiv.className = 'copen-drag-handle';
  dragHandleDiv.setAttribute('draggable', 'true');

  const dragIcon = document.createElement('span');
  dragIcon.className = 'icon';
  dragIcon.setAttribute('aria-hidden', 'true');
  dragIcon.textContent = 'drag_indicator';
  dragHandleDiv.appendChild(dragIcon);

  const leftDiv = document.createElement('div');
  leftDiv.className = 'copen-item-left';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'copen-item-icon';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = copen.icon;
  iconDiv.appendChild(iconSpan);

  const infoDiv = document.createElement('div');
  infoDiv.className = 'copen-item-info';

  const labelDiv = document.createElement('div');
  labelDiv.className = 'copen-item-label';

  const labelText = document.createTextNode(copen.label + (copen.isDefault ? ' ' : ''));
  labelDiv.appendChild(labelText);

  if (copen.isDefault) {
    const defaultBadge = document.createElement('span');
    defaultBadge.className = 'copen-item-default-badge';
    defaultBadge.textContent = 'Default';
    labelDiv.appendChild(defaultBadge);
  }

  const urlDiv = document.createElement('div');
  urlDiv.className = 'copen-item-url';
  urlDiv.textContent = copen.url;

  infoDiv.appendChild(labelDiv);
  infoDiv.appendChild(urlDiv);

  leftDiv.appendChild(iconDiv);
  leftDiv.appendChild(infoDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'copen-item-actions';

  const checkboxColDiv = document.createElement('div');
  checkboxColDiv.className = 'copen-checkbox-col';

  const checkboxInput = document.createElement('input');
  checkboxInput.type = 'checkbox';
  checkboxInput.className = 'copen-checkbox';
  checkboxInput.dataset.copenId = copen.id;
  checkboxColDiv.appendChild(checkboxInput);

  const editButton = document.createElement('button');
  editButton.className = 'btn-icon';
  editButton.dataset.action = 'edit-copen';
  editButton.dataset.copenId = copen.id;
  editButton.title = 'Edit';

  const editIcon = document.createElement('span');
  editIcon.className = 'icon';
  editIcon.setAttribute('aria-hidden', 'true');
  editIcon.textContent = 'edit';
  editButton.appendChild(editIcon);

  actionsDiv.appendChild(checkboxColDiv);
  actionsDiv.appendChild(editButton);

  itemDiv.appendChild(dragHandleDiv);
  itemDiv.appendChild(leftDiv);
  itemDiv.appendChild(actionsDiv);

  return itemDiv;
}

function showCopenEditor(copenId = null, existingData = null) {
  const modal = document.getElementById('copenEditorModal');
  const title = document.getElementById('copenEditorTitle');
  const labelInput = document.getElementById('copenLabel');
  const urlInput = document.getElementById('copenUrl');

  if (!modal) return;

  editingCopenId = copenId;

  if (existingData) {
    title.textContent = 'Edit Copen Link';
    labelInput.value = existingData.label;
    urlInput.value = existingData.url;
  } else {
    title.textContent = 'Add Copen Link';
    labelInput.value = '';
    urlInput.value = '';
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

  const label = labelInput.value.trim();
  const url = urlInput.value.trim();
  const icon = getCustomCopenIcon();

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
    window.dispatchEvent(new CustomEvent('copensChanged'));
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

async function handleDeleteSelectedCopens() {
  if (!currentUser) return;

  const selectedCheckboxes = document.querySelectorAll('.copen-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    showToast('No copens selected', 'warn');
    return;
  }

  const confirmed = await showConfirm(`Delete ${selectedCheckboxes.length} selected copen${selectedCheckboxes.length > 1 ? 's' : ''}?`, {
    title: 'Delete Selected Copens',
    confirmText: 'Delete',
    confirmClass: 'danger'
  });

  if (!confirmed) return;

  try {
    const deletePromises = Array.from(selectedCheckboxes).map(cb => 
      deleteCustomCopen(currentUser.uid, cb.dataset.copenId)
    );
    
    await Promise.all(deletePromises);
    clearCopenCache();
    window.dispatchEvent(new CustomEvent('copensChanged'));
    showToast(`${selectedCheckboxes.length} copen${selectedCheckboxes.length > 1 ? 's' : ''} deleted`, 'success');
    await loadCopens(currentUser);
  } catch (error) {
    console.error('Error deleting copens:', error);
    showToast('Failed to delete some copens', 'error');
  }
}

function handleSelectAllCopens(checked) {
  const checkboxes = document.querySelectorAll('.copen-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
  });
}

async function handleResetToDefaultCopens() {
  if (!currentUser) return;

  const confirmed = await showConfirm(
    'This will remove all custom copen links and re-enable all default copens. This action cannot be undone.',
    {
      title: 'Reset to Default Copens',
      confirmText: 'Reset',
      confirmClass: 'warn'
    }
  );

  if (!confirmed) return;

  try {
    await resetToDefaultCopens(currentUser.uid);
    clearCopenCache();
    window.dispatchEvent(new CustomEvent('copensChanged'));
    showToast('Reset to default copens', 'success');
    await loadCopens(currentUser);
  } catch (error) {
    console.error('Error resetting to defaults:', error);
    showToast('Failed to reset copens', 'error');
  }
}

async function handleToggleCopen(copenId, currentlyEnabled) {
  if (!currentUser) return;

  try {
    await toggleDefaultCopen(currentUser.uid, copenId, !currentlyEnabled);
    clearCopenCache();
    window.dispatchEvent(new CustomEvent('copensChanged'));
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

async function initApp() {
  try {
    await waitForFirebase();
    const auth = getAuth();
    
    // Set up event listeners
    const addCopenBtn = document.getElementById('addCopenBtn');
    const copenSelectAll = document.getElementById('copenSelectAll');
    const copenDeleteBtn = document.getElementById('copenDeleteBtn');
    const copenEditorSave = document.getElementById('copenEditorSave');
    const copenEditorCancel = document.getElementById('copenEditorCancel');
    const copenEditorClose = document.getElementById('copenEditorClose');
    const addJulesKeyBtn = document.getElementById('addJulesKeyBtn');
    const resetJulesKeyBtn = document.getElementById('resetJulesKeyBtn');

    if (addCopenBtn) {
      addCopenBtn.addEventListener('click', () => showCopenEditor());
    }

    if (copenSelectAll) {
      copenSelectAll.addEventListener('change', (e) => handleSelectAllCopens(e.target.checked));
    }

    if (copenDeleteBtn) {
      copenDeleteBtn.addEventListener('click', handleDeleteSelectedCopens);
    }
    
    const copenResetBtn = document.getElementById('copenResetBtn');
    if (copenResetBtn) {
      copenResetBtn.addEventListener('click', handleResetToDefaultCopens);
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
          // Note: showToast is already called by jules-modal.js
          if (currentUser) {
            loadJulesKeyStatus(currentUser);
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
            resetJulesKeyBtn.replaceChildren();
            resetJulesKeyBtn.insertAdjacentHTML('afterbegin', '<span class="icon icon-inline" aria-hidden="true">delete</span>');
            resetJulesKeyBtn.appendChild(document.createTextNode(' Delete Jules API Key'));
            resetJulesKeyBtn.disabled = false;
            
            await loadJulesKeyStatus(currentUser);
            showToast('Jules API key has been deleted', 'success');
          } else {
            throw new Error('Failed to delete key');
          }
        } catch (error) {
          showToast('Failed to delete API key: ' + error.message, 'error');
          resetJulesKeyBtn.replaceChildren();
          resetJulesKeyBtn.insertAdjacentHTML('afterbegin', '<span class="icon icon-inline" aria-hidden="true">delete</span>');
          resetJulesKeyBtn.appendChild(document.createTextNode(' Delete Jules API Key'));
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
          const signInMessage = document.createElement('div');
          signInMessage.className = 'muted-text text-center pad-xl';
          signInMessage.textContent = 'Please sign in to view your profile.';
          profileUserName.replaceChildren(signInMessage);
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
