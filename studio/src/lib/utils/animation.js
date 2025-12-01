export const applyTransform3d = (element, x = 0, y = 0, z = 0) => {
  if (!element) {
    return;
  }

  const transform = `translate3d(${x}px, ${y}px, ${z}px)`;
  element.style.transform = transform;
};

export const applyTransformMultiple = (elements, x = 0, y = 0, z = 0) => {
  const transform = `translate3d(${x}px, ${y}px, ${z}px)`;

  elements.forEach(element => {
    if (element) {
      element.style.transform = transform;
    }
  });
};

export const setTransition = (element, enabled = true, transitionClass = 'event-transition') => {
  if (!element) {
    return;
  }

  if (enabled) {
    element.classList.add(transitionClass);
  } else {
    element.classList.remove(transitionClass);
  }
};

export const lerp = (start, end, factor) => {
  return start + (end - start) * factor;
};

export const clamp = (value, min, max) => {
  return value <= min ? min : value >= max ? max : value;
};

export const normalize = (value, min, max) => {
  return (value - min) / (max - min);
};

export const denormalize = (normalized, min, max) => {
  return normalized * (max - min) + min;
};
