import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  escapeHtml,
  getRelativeX,
  getRelativeY,
  getRelativePos,
  createElement,
  createFileInput,
  addListeners,
  removeListeners,
  show,
  hide,
  toggleVisibility,
  toggleClass,
  setEnabled,
  createButton,
  createIconButton,
  togglePair,
  createVisibilityMixin
} from '../dom.js';

describe('DOM utilities', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    element?.remove();
  });

  // ============================================================================
  // HTML escaping
  // ============================================================================

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes less than', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes greater than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
      expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes all special characters together', () => {
      expect(escapeHtml('<a href="x" onclick=\'alert(1)\'>&')).toBe(
        '&lt;a href=&quot;x&quot; onclick=&#39;alert(1)&#39;&gt;&amp;'
      );
    });

    it('returns empty string for null', () => {
      expect(escapeHtml(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(escapeHtml(undefined)).toBe('');
    });

    it('returns original for non-string types', () => {
      expect(escapeHtml(123)).toBe(123);
    });

    it('returns empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('returns safe string unchanged', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  // ============================================================================
  // Position utilities
  // ============================================================================

  describe('getRelativeX', () => {
    it('returns X position relative to element', () => {
      element.getBoundingClientRect = vi.fn(() => ({ left: 100 }));

      const event = { clientX: 150 };
      const result = getRelativeX(event, element);

      expect(result).toBe(50);
    });
  });

  describe('getRelativeY', () => {
    it('returns Y position relative to element', () => {
      element.getBoundingClientRect = vi.fn(() => ({ top: 200 }));

      const event = { clientY: 250 };
      const result = getRelativeY(event, element);

      expect(result).toBe(50);
    });
  });

  describe('getRelativePos', () => {
    it('returns X, Y and rect', () => {
      const mockRect = { left: 100, top: 200 };
      element.getBoundingClientRect = vi.fn(() => mockRect);

      const event = { clientX: 150, clientY: 280 };
      const result = getRelativePos(event, element);

      expect(result).toEqual({
        x: 50,
        y: 80,
        rect: mockRect
      });
    });
  });

  // ============================================================================
  // createElement
  // ============================================================================

  describe('createElement', () => {
    it('creates element with tag', () => {
      const el = createElement('div');

      expect(el.tagName).toBe('DIV');
    });

    it('sets className', () => {
      const el = createElement('div', { className: 'test-class' });

      expect(el.className).toBe('test-class');
    });

    it('sets id', () => {
      const el = createElement('div', { id: 'test-id' });

      expect(el.id).toBe('test-id');
    });

    it('sets text content', () => {
      const el = createElement('span', { text: 'Hello' });

      expect(el.textContent).toBe('Hello');
    });

    it('sets innerHTML', () => {
      const el = createElement('div', { html: '<span>Test</span>' });

      expect(el.innerHTML).toBe('<span>Test</span>');
    });

    it('sets attributes', () => {
      const el = createElement('input', {
        attributes: { type: 'text', placeholder: 'Enter text' }
      });

      expect(el.getAttribute('type')).toBe('text');
      expect(el.getAttribute('placeholder')).toBe('Enter text');
    });

    it('sets styles', () => {
      const el = createElement('div', {
        styles: { color: 'red', fontSize: '16px' }
      });

      expect(el.style.color).toBe('red');
      expect(el.style.fontSize).toBe('16px');
    });

    it('adds event listeners', () => {
      const onClick = vi.fn();
      const el = createElement('button', {
        listeners: { click: onClick }
      });

      el.click();

      expect(onClick).toHaveBeenCalled();
    });

    it('appends to parent', () => {
      const parent = document.createElement('div');
      const el = createElement('span', { parent });

      expect(parent.contains(el)).toBe(true);
    });

    it('creates SVG elements', () => {
      const svg = createElement('svg');

      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect(svg.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    });

    it('creates SVG path elements', () => {
      const path = createElement('path', {
        attributes: { d: 'M0 0 L10 10' }
      });

      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });
  });

  // ============================================================================
  // createFileInput
  // ============================================================================

  describe('createFileInput', () => {
    it('creates hidden file input', () => {
      const input = createFileInput({ accept: '.mp3,.wav' });

      expect(input.type).toBe('file');
      expect(input.accept).toBe('.mp3,.wav');
      expect(input.style.display).toBe('none');
    });

    it('sets multiple attribute', () => {
      const input = createFileInput({ accept: '*', multiple: true });

      expect(input.multiple).toBe(true);
    });

    it('attaches onChange listener', () => {
      const onChange = vi.fn();
      const input = createFileInput({ accept: '*', onChange });

      input.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalled();
    });

    it('appends to parent', () => {
      const parent = document.createElement('div');
      createFileInput({ accept: '*', parent });

      expect(parent.querySelector('input[type="file"]')).not.toBeNull();
    });
  });

  // ============================================================================
  // addListeners / removeListeners
  // ============================================================================

  describe('addListeners', () => {
    it('adds multiple listeners', () => {
      const onClick = vi.fn();
      const onMouseOver = vi.fn();

      addListeners(element, { click: onClick, mouseover: onMouseOver });

      element.click();
      element.dispatchEvent(new Event('mouseover'));

      expect(onClick).toHaveBeenCalled();
      expect(onMouseOver).toHaveBeenCalled();
    });

    it('handles null element', () => {
      expect(() => addListeners(null, { click: vi.fn() })).not.toThrow();
    });

    it('handles null listeners', () => {
      expect(() => addListeners(element, null)).not.toThrow();
    });

    it('handles non-object listeners', () => {
      expect(() => addListeners(element, 'not-an-object')).not.toThrow();
    });
  });

  describe('removeListeners', () => {
    it('removes listeners', () => {
      const onClick = vi.fn();
      element.addEventListener('click', onClick);

      removeListeners(element, { click: onClick });
      element.click();

      expect(onClick).not.toHaveBeenCalled();
    });

    it('handles null element', () => {
      expect(() => removeListeners(null, { click: vi.fn() })).not.toThrow();
    });

    it('handles null listeners', () => {
      expect(() => removeListeners(element, null)).not.toThrow();
    });
  });

  // ============================================================================
  // Visibility utilities
  // ============================================================================

  describe('show', () => {
    it('removes hide class from element', () => {
      element.classList.add('hide-animated');
      show(element);

      expect(element.classList.contains('hide-animated')).toBe(false);
    });

    it('removes custom hide class', () => {
      element.classList.add('custom-hide');
      show(element, 'custom-hide');

      expect(element.classList.contains('custom-hide')).toBe(false);
    });

    it('handles array of elements', () => {
      const el2 = document.createElement('div');
      element.classList.add('hide-animated');
      el2.classList.add('hide-animated');

      show([element, el2]);

      expect(element.classList.contains('hide-animated')).toBe(false);
      expect(el2.classList.contains('hide-animated')).toBe(false);
    });

    it('handles null elements in array', () => {
      expect(() => show([element, null])).not.toThrow();
    });

    it('returns true', () => {
      expect(show(element)).toBe(true);
    });
  });

  describe('hide', () => {
    it('adds hide class to element', () => {
      hide(element);

      expect(element.classList.contains('hide-animated')).toBe(true);
    });

    it('adds custom hide class', () => {
      hide(element, 'custom-hide');

      expect(element.classList.contains('custom-hide')).toBe(true);
    });

    it('handles array of elements', () => {
      const el2 = document.createElement('div');
      hide([element, el2]);

      expect(element.classList.contains('hide-animated')).toBe(true);
      expect(el2.classList.contains('hide-animated')).toBe(true);
    });

    it('returns true', () => {
      expect(hide(element)).toBe(true);
    });
  });

  describe('toggleVisibility', () => {
    it('shows element when isVisible is true', () => {
      element.classList.add('hide-animated');
      toggleVisibility(element, true);

      expect(element.classList.contains('hide-animated')).toBe(false);
    });

    it('hides element when isVisible is false', () => {
      toggleVisibility(element, false);

      expect(element.classList.contains('hide-animated')).toBe(true);
    });

    it('toggles when no boolean provided', () => {
      toggleVisibility(element);
      expect(element.classList.contains('hide-animated')).toBe(true);

      toggleVisibility(element);
      expect(element.classList.contains('hide-animated')).toBe(false);
    });

    it('returns false for null element', () => {
      expect(toggleVisibility(null, true)).toBe(false);
    });

    it('returns true for valid element', () => {
      expect(toggleVisibility(element, true)).toBe(true);
    });

    it('uses custom hide class', () => {
      toggleVisibility(element, false, 'my-hide');

      expect(element.classList.contains('my-hide')).toBe(true);
    });
  });

  describe('toggleClass', () => {
    it('adds class when condition is true', () => {
      toggleClass(element, 'active', true);

      expect(element.classList.contains('active')).toBe(true);
    });

    it('removes class when condition is false', () => {
      element.classList.add('active');
      toggleClass(element, 'active', false);

      expect(element.classList.contains('active')).toBe(false);
    });

    it('handles null element', () => {
      expect(() => toggleClass(null, 'active', true)).not.toThrow();
    });
  });

  describe('setEnabled', () => {
    it('adds enabled class when enabled', () => {
      setEnabled(element, true);

      expect(element.classList.contains('enabled')).toBe(true);
    });

    it('removes enabled class when disabled', () => {
      element.classList.add('enabled');
      setEnabled(element, false);

      expect(element.classList.contains('enabled')).toBe(false);
    });

    it('uses custom enabled class', () => {
      setEnabled(element, true, 'is-active');

      expect(element.classList.contains('is-active')).toBe(true);
    });
  });

  // ============================================================================
  // Button utilities
  // ============================================================================

  describe('createButton', () => {
    it('creates button with class and icon', () => {
      const btn = createButton({
        className: 'my-btn',
        icon: 'bi bi-play'
      });

      expect(btn.tagName).toBe('BUTTON');
      expect(btn.className).toBe('my-btn');
      expect(btn.querySelector('i.bi.bi-play')).not.toBeNull();
    });

    it('sets title attribute', () => {
      const btn = createButton({ title: 'Click me' });

      expect(btn.getAttribute('title')).toBe('Click me');
    });

    it('adds click handler', () => {
      const onClick = vi.fn();
      const btn = createButton({ onClick });

      btn.click();

      expect(onClick).toHaveBeenCalled();
    });

    it('sets custom attributes', () => {
      const btn = createButton({
        attrs: { 'data-action': 'save', disabled: 'true' }
      });

      expect(btn.getAttribute('data-action')).toBe('save');
      expect(btn.getAttribute('disabled')).toBe('true');
    });

    it('appends to parent', () => {
      const parent = document.createElement('div');
      createButton({ parent });

      expect(parent.querySelector('button')).not.toBeNull();
    });
  });

  describe('createIconButton', () => {
    it('creates bootstrap styled button', () => {
      const btn = createIconButton({
        icon: 'play',
        title: 'Play'
      });

      expect(btn.className).toBe('btn btn-outline-info btn-sm');
      expect(btn.querySelector('i.bi.bi-play')).not.toBeNull();
    });

    it('uses custom variant and size', () => {
      const btn = createIconButton({
        icon: 'stop',
        variant: 'primary',
        size: 'lg'
      });

      expect(btn.className).toBe('btn btn-primary btn-lg');
    });

    it('handles no size', () => {
      const btn = createIconButton({
        icon: 'stop',
        size: ''
      });

      expect(btn.className).toBe('btn btn-outline-info');
    });
  });

  // ============================================================================
  // togglePair / createVisibilityMixin
  // ============================================================================

  describe('togglePair', () => {
    it('shows first and hides second', () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      el1.classList.add('d-none');

      togglePair(el1, el2);

      expect(el1.classList.contains('d-none')).toBe(false);
      expect(el2.classList.contains('d-none')).toBe(true);
    });

    it('handles null elements', () => {
      expect(() => togglePair(null, null)).not.toThrow();
    });

    it('uses custom hide class', () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      el1.classList.add('hidden');

      togglePair(el1, el2, 'hidden');

      expect(el1.classList.contains('hidden')).toBe(false);
      expect(el2.classList.contains('hidden')).toBe(true);
    });
  });

  describe('createVisibilityMixin', () => {
    it('creates show/hide methods', () => {
      const mixin = createVisibilityMixin(element);

      expect(typeof mixin.show).toBe('function');
      expect(typeof mixin.hide).toBe('function');
    });

    it('show removes hide class', () => {
      element.classList.add('hide');
      const mixin = createVisibilityMixin(element);

      mixin.show();

      expect(element.classList.contains('hide')).toBe(false);
    });

    it('hide adds hide class', () => {
      const mixin = createVisibilityMixin(element);

      mixin.hide();

      expect(element.classList.contains('hide')).toBe(true);
    });

    it('uses custom hide class', () => {
      const mixin = createVisibilityMixin(element, 'invisible');

      mixin.hide();

      expect(element.classList.contains('invisible')).toBe(true);
    });
  });
});
