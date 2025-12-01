import { SLIDER_THUMB_WIDTH } from '../../config/ui';

const SVG_TAGS = ['svg', 'path', 'line'];

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for innerHTML
 */
export const escapeHtml = str => {
  if (typeof str !== 'string') {
    return str ?? '';
  }

  return str.replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char]);
};

/**
 * Get X position relative to an element
 * @param {MouseEvent} event
 * @param {Element} element
 * @returns {number}
 */
export const getRelativeX = (event, element) =>
  event.clientX - element.getBoundingClientRect().left;

/**
 * Get Y position relative to an element
 * @param {MouseEvent} event
 * @param {Element} element
 * @returns {number}
 */
export const getRelativeY = (event, element) => event.clientY - element.getBoundingClientRect().top;

/**
 * Get X and Y position relative to an element
 * @param {MouseEvent} event
 * @param {Element} element
 * @returns {{ x: number, y: number, rect: DOMRect }}
 */
export const getRelativePos = (event, element) => {
  const rect = element.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    rect
  };
};

/**
 * Get X position relative to navigator container (with slider offset)
 * @param {MouseEvent} event
 * @param {Element} navigatorEl
 * @returns {number}
 */
export const getNavigatorX = (event, navigatorEl) =>
  event.clientX - navigatorEl.getBoundingClientRect().left - SLIDER_THUMB_WIDTH / 2;

/**
 * Get X position relative to navigator container from a raw clientX
 * @param {number} clientX
 * @param {Element} navigatorEl
 * @returns {number}
 */
export const getNavigatorXFromClientX = (clientX, navigatorEl) =>
  clientX - navigatorEl.getBoundingClientRect().left - SLIDER_THUMB_WIDTH / 2;

/**
 * Get timeline posX from clientX using a reference element and current scroll
 * @param {number} clientX
 * @param {Element} element
 * @param {number} scrollOffset
 * @returns {number}
 */
export const getTimelinePosXFromClientX = (clientX, element, scrollOffset = 0) =>
  clientX - element.getBoundingClientRect().left + scrollOffset;

/**
 * Get absolute timeline X position (accounts for scroll)
 * @param {MouseEvent} event
 * @param {Element} navigatorEl
 * @param {number} scrollOffset - current scroll position
 * @returns {number}
 */
export const getTimelineX = (event, navigatorEl, scrollOffset) =>
  getNavigatorX(event, navigatorEl) + scrollOffset;

export const createElement = (tag, config = {}) => {
  const {
    className,
    id,
    text,
    html,
    attributes = {},
    styles = {},
    listeners = {},
    parent
  } = config;

  const isSvg = SVG_TAGS.includes(tag);
  const element = isSvg
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);

  if (tag === 'svg') {
    element.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  if (className) {
    element.className = className;
  }

  if (id) {
    element.id = id;
  }

  if (text) {
    element.textContent = text;
  }

  if (html) {
    element.innerHTML = html;
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (isSvg) {
      element.setAttributeNS(null, key, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  Object.entries(styles).forEach(([key, value]) => {
    element.style[key] = value;
  });

  Object.entries(listeners).forEach(([event, handler]) => {
    element.addEventListener(event, handler, false);
  });

  if (parent) {
    parent.appendChild(element);
  }

  return element;
};

export const createFileInput = ({ accept, multiple = false, onChange, parent }) => {
  return createElement('input', {
    attributes: {
      type: 'file',
      accept,
      ...(multiple && { multiple: 'multiple' })
    },
    styles: { display: 'none' },
    listeners: onChange ? { change: onChange } : {},
    parent
  });
};

export const addListeners = (element, listeners) => {
  if (!element || typeof listeners !== 'object' || listeners === null) {
    return;
  }

  Object.entries(listeners).forEach(([event, handler]) => {
    element.addEventListener(event, handler, false);
  });
};

export const removeListeners = (element, listeners) => {
  if (!element || typeof listeners !== 'object' || listeners === null) {
    return;
  }

  Object.entries(listeners).forEach(([event, handler]) => {
    element.removeEventListener(event, handler, false);
  });
};

export const show = (elements, hideClass = 'hide-animated') => {
  const nodes = Array.isArray(elements) ? elements : [elements];

  nodes.forEach(node => {
    if (node) {
      node.classList.remove(hideClass);
    }
  });

  return true;
};

export const hide = (elements, hideClass = 'hide-animated') => {
  const nodes = Array.isArray(elements) ? elements : [elements];

  nodes.forEach(node => {
    if (node) {
      node.classList.add(hideClass);
    }
  });

  return true;
};

export const toggleVisibility = (element, isVisible, hideClass = 'hide-animated') => {
  if (!element) {
    return false;
  }

  if (typeof isVisible === 'boolean') {
    element.classList.toggle(hideClass, !isVisible);
  } else {
    element.classList.toggle(hideClass);
  }

  return true;
};

export const toggleClass = (element, className, condition) => {
  if (!element) {
    return;
  }

  if (condition) {
    element.classList.add(className);
  } else {
    element.classList.remove(className);
  }
};

export const setEnabled = (element, enabled, enabledClass = 'enabled') => {
  toggleClass(element, enabledClass, enabled);
};

export const createButton = ({ className, icon, title, attrs = {}, onClick, parent }) => {
  return createElement('button', {
    className,
    html: icon ? `<i class="${icon}"></i>` : '',
    attributes: { ...(title ? { title } : {}), ...attrs },
    listeners: onClick ? { click: onClick } : {},
    parent
  });
};

export const createIconButton = ({
  icon,
  title,
  attrs = {},
  onClick,
  variant = 'outline-info',
  size = 'sm',
  parent
}) => {
  return createButton({
    className: `btn btn-${variant}${size ? ' btn-' + size : ''}`,
    icon: `bi bi-${icon}`,
    title,
    attrs,
    onClick,
    parent
  });
};

export const togglePair = ($show, $hide, hideClass = 'd-none') => {
  if ($show) {
    $show.classList.remove(hideClass);
  }

  if ($hide) {
    $hide.classList.add(hideClass);
  }
};

export const createVisibilityMixin = ($el, hideClass = 'hide') => ({
  show() {
    $el.classList.remove(hideClass);
  },
  hide() {
    $el.classList.add(hideClass);
  }
});
