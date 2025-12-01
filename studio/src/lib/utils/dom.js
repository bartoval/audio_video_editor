const SVG_TAGS = ['svg', 'path', 'line'];

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

export const createButton = ({ className, icon, title, onClick, parent }) => {
  return createElement('button', {
    className,
    html: icon ? `<i class="${icon}"></i>` : '',
    attributes: title ? { title } : {},
    listeners: onClick ? { click: onClick } : {},
    parent
  });
};

export const createIconButton = ({
  icon,
  title,
  onClick,
  variant = 'outline-info',
  size = 'sm',
  parent
}) => {
  return createButton({
    className: `btn btn-${variant}${size ? ' btn-' + size : ''}`,
    icon: `bi bi-${icon}`,
    title,
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
