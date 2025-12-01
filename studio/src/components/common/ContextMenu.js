/**
 * ContextMenu - Spotify-style dropdown menu
 * Usage:
 *   const menu = new ContextMenu([
 *     { id: 'mp3', label: 'Download MP3', icon: 'bi-file-earmark-music' },
 *     { id: 'wav', label: 'Download WAV', icon: 'bi-file-earmark-music' },
 *     { type: 'divider' },
 *     { id: 'stems', label: 'Download Stems', icon: 'bi-music-note-list' }
 *   ]);
 *   menu.show(anchorElement, (itemId) => { ... });
 */

const MENU_CLASS = 'context-menu';
const MENU_ITEM_CLASS = 'context-menu-item';
const MENU_DIVIDER_CLASS = 'context-menu-divider';

export class ContextMenu {
  constructor(items = []) {
    this.items = items;
    this.$menu = null;
    this.onSelect = null;
    this.boundClose = this.#handleOutsideClick.bind(this);
    this.boundKeydown = this.#handleKeydown.bind(this);
    this.listenerAttachTimeout = null;
  }

  show(anchor, onSelect) {
    this.hide();
    this.onSelect = onSelect;

    this.$menu = this.#createMenu();
    document.body.appendChild(this.$menu);

    this.#positionMenu(anchor);

    requestAnimationFrame(() => {
      this.$menu.classList.add('visible');
    });

    this.listenerAttachTimeout = setTimeout(() => {
      this.listenerAttachTimeout = null;
      document.addEventListener('click', this.boundClose);
      document.addEventListener('keydown', this.boundKeydown);
    }, 0);
  }

  hide() {
    if (this.listenerAttachTimeout) {
      clearTimeout(this.listenerAttachTimeout);
      this.listenerAttachTimeout = null;
    }

    document.removeEventListener('click', this.boundClose);
    document.removeEventListener('keydown', this.boundKeydown);

    if (this.$menu) {
      this.$menu.classList.remove('visible');

      setTimeout(() => {
        this.$menu?.remove();
        this.$menu = null;
      }, 150);
    }
  }

  #createMenu() {
    const $menu = document.createElement('div');
    $menu.className = MENU_CLASS;

    this.items.forEach(item => {
      if (item.type === 'divider') {
        const $divider = document.createElement('div');
        $divider.className = MENU_DIVIDER_CLASS;
        $menu.appendChild($divider);

        return;
      }

      const $item = document.createElement('button');
      $item.className = MENU_ITEM_CLASS;
      $item.dataset.id = item.id;

      if (item.disabled) {
        $item.disabled = true;
        $item.classList.add('disabled');
      }

      const iconHtml = item.icon ? `<i class="bi ${item.icon}"></i>` : '';
      const badgeHtml = item.badge ? `<span class="context-menu-badge">${item.badge}</span>` : '';

      $item.innerHTML = `${iconHtml}<span>${item.label}</span>${badgeHtml}`;

      $item.addEventListener('click', event => {
        event.stopPropagation();

        if (!item.disabled) {
          this.onSelect?.(item.id, item);
          this.hide();
        }
      });

      $menu.appendChild($item);
    });

    return $menu;
  }

  #positionMenu(anchor) {
    const rect = anchor.getBoundingClientRect();
    const menuRect = this.$menu.getBoundingClientRect();

    let top = rect.bottom + 4;
    let left = rect.left;

    if (left + menuRect.width > window.innerWidth - 8) {
      left = rect.right - menuRect.width;
    }

    if (top + menuRect.height > window.innerHeight - 8) {
      top = rect.top - menuRect.height - 4;
    }

    if (left < 8) {
      left = 8;
    }

    this.$menu.style.top = `${top}px`;
    this.$menu.style.left = `${left}px`;
  }

  #handleOutsideClick(event) {
    if (this.$menu && !this.$menu.contains(event.target)) {
      this.hide();
    }
  }

  #handleKeydown(event) {
    if (event.key === 'Escape') {
      this.hide();
    }
  }
}

export function createMenuButton(className = '') {
  const $btn = document.createElement('button');
  $btn.className = `btn btn-sm btn-menu-trigger ${className}`.trim();
  $btn.innerHTML = '<i class="bi bi-three-dots"></i>';
  $btn.title = 'More options';

  return $btn;
}
