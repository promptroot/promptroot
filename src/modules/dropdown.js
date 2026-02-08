const openDropdowns = new Set();

const ITEM_SELECTOR = '[role="menuitem"], [role="option"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="button"]';

function getItems(menu) {
  // Prefer role-based items
  let items = Array.from(menu.querySelectorAll(ITEM_SELECTOR));
  if (items.length === 0) {
    // Fallback to interactive elements if no roles defined
    items = Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
  }
  // Filter out disabled items and hidden items (offsetParent is null for hidden elements)
  return items.filter(item => !item.hasAttribute('disabled') && item.offsetParent !== null);
}

function closeAllDropdowns() {
  for (const dropdown of openDropdowns) {
    closeDropdown(dropdown);
  }
}

function toggleDropdown(dropdown) {
  const isOpen = dropdown.menu.classList.contains('open');
  if (isOpen) {
    closeDropdown(dropdown);
    dropdown.btn.focus();
  } else {
    openDropdown(dropdown);
  }
}

function openDropdown(dropdown) {
  closeAllDropdowns();
  dropdown.menu.classList.add('open');
  dropdown.menu.style.display = '';
  dropdown.btn.setAttribute('aria-expanded', 'true');
  openDropdowns.add(dropdown);

  // Focus management
  requestAnimationFrame(() => {
    // Guard: Check if menu is still open before moving focus
    // This prevents race conditions where menu closes (e.g. Escape) before this callback runs
    if (!dropdown.menu.classList.contains('open')) return;

    // Check for search input first (e.g. branch selector)
    const input = dropdown.menu.querySelector('input[type="text"], input[type="search"]');
    if (input && input.offsetParent !== null) {
      input.focus();
    } else {
      const items = getItems(dropdown.menu);
      if (items.length > 0) {
        items[0].focus();
      } else if (dropdown.menu.getAttribute('tabindex') !== null) {
        dropdown.menu.focus();
      }
    }
  });
}

function closeDropdown(dropdown) {
  dropdown.menu.classList.remove('open');
  dropdown.menu.style.display = '';
  dropdown.btn.setAttribute('aria-expanded', 'false');
  openDropdowns.delete(dropdown);
}

// Centralized document click listener
document.addEventListener('click', (e) => {
  const toClose = [];
  for (const dropdown of openDropdowns) {
    const clickedInsideContainer = dropdown.container.contains(e.target);
    const clickedButton = dropdown.btn === e.target || dropdown.btn.contains(e.target);

    if (!clickedInsideContainer && !clickedButton) {
      toClose.push(dropdown);
    }
  }

  toClose.forEach(d => closeDropdown(d));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (openDropdowns.size > 0) {
      // Return focus to the button of the active dropdown
      const activeDropdown = [...openDropdowns].find(d =>
        d.menu.contains(document.activeElement) ||
        d.container.contains(document.activeElement)
      );

      closeAllDropdowns();

      if (activeDropdown) {
        activeDropdown.btn.focus();
      }
    }
  }
});

export function initDropdown(btn, menu, container = null) {
  if (!btn || !menu) return null;

  const dropdownContainer = container || menu.parentNode;
  const dropdown = { btn, menu, container: dropdownContainer };

  btn.setAttribute('aria-haspopup', 'true');
  if (!btn.hasAttribute('aria-expanded')) {
    btn.setAttribute('aria-expanded', 'false');
  }
  if (!menu.hasAttribute('role')) {
    menu.setAttribute('role', 'menu');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(dropdown);
  });

  // Keyboard support for button
  btn.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !menu.classList.contains('open')) {
      e.preventDefault();
      openDropdown(dropdown);
    }
  });

  // Keyboard support for menu
  menu.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('open')) return;

    // Allow typing in text inputs (e.g. search)
    if (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'search')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = getItems(menu);
        if (items.length > 0) items[0].focus();
      }
      // Don't prevent default for other keys in input
      return;
    }

    const items = getItems(menu);
    const currentIndex = items.indexOf(document.activeElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex === -1) {
          if (items.length > 0) items[0].focus();
        } else {
          const nextIndex = (currentIndex + 1) % items.length;
          items[nextIndex].focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex === -1) {
          if (items.length > 0) items[items.length - 1].focus();
        } else {
          const prevIndex = (currentIndex - 1 + items.length) % items.length;
          items[prevIndex].focus();
        }
        break;
      case 'Home':
        e.preventDefault();
        if (items.length > 0) items[0].focus();
        break;
      case 'End':
        e.preventDefault();
        if (items.length > 0) items[items.length - 1].focus();
        break;
      case 'Enter':
      case ' ': // Space
        if (currentIndex !== -1) {
          // Prevent default scrolling for space
          e.preventDefault();
          document.activeElement.click();
        }
        break;
      case 'Tab':
        // Let focus move naturally, but close dropdown if focus leaves
        // We handle this via focusout, but explicit close here ensures state is clean
        closeDropdown(dropdown);
        break;
    }
  });

  // Close when focus leaves the dropdown container
  dropdownContainer.addEventListener('focusout', (e) => {
    // relatedTarget is where focus is moving TO
    if (!dropdownContainer.contains(e.relatedTarget) && menu.classList.contains('open')) {
      closeDropdown(dropdown);
    }
  });

  return {
    open: () => openDropdown(dropdown),
    close: () => closeDropdown(dropdown),
    toggle: () => toggleDropdown(dropdown)
  };
}
