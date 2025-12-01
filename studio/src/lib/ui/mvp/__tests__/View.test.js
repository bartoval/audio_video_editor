import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import View from '../View.js';

describe('View', () => {
  let $container;
  let view;

  beforeEach(() => {
    $container = document.createElement('div');
    document.body.appendChild($container);
  });

  afterEach(() => {
    if (view) {
      view.destroy();
    }
    $container.remove();
  });

  describe('constructor', () => {
    it('initializes with parent element', () => {
      view = new View($container);

      expect(view.$parent).toBe($container);
      expect(view.$node).toBe(null);
      expect(view.isMounted).toBe(false);
      expect(view.isReady).toBe(false);
    });

    it('initializes internal collections', () => {
      view = new View($container);

      expect(view._children).toEqual([]);
      expect(view._eventHandlers).toBeInstanceOf(Map);
      expect(view._delegatedEvents).toBeInstanceOf(Map);
      expect(view._presenter).toBe(null);
    });

    it('provides $root alias for $node', () => {
      view = new View($container);
      const $elem = document.createElement('div');

      view.$root = $elem;

      expect(view.$node).toBe($elem);
      expect(view.$root).toBe($elem);
    });
  });

  describe('lifecycle - mount', () => {
    it('calls render on mount', () => {
      view = new View($container);
      const renderSpy = vi.spyOn(view, 'render');

      view.mount();

      expect(renderSpy).toHaveBeenCalledOnce();
    });

    it('calls onMount after render', () => {
      view = new View($container);
      const onMountSpy = vi.spyOn(view, 'onMount');

      view.mount();

      expect(onMountSpy).toHaveBeenCalledOnce();
    });

    it('sets isMounted to true', () => {
      view = new View($container);

      view.mount();

      expect(view.isMounted).toBe(true);
    });

    it('only mounts once', () => {
      view = new View($container);
      const renderSpy = vi.spyOn(view, 'render');

      view.mount();
      view.mount();
      view.mount();

      expect(renderSpy).toHaveBeenCalledOnce();
    });

    it('mounts all children', () => {
      view = new View($container);
      const child1 = new View($container);
      const child2 = new View($container);

      const mountSpy1 = vi.spyOn(child1, 'mount');
      const mountSpy2 = vi.spyOn(child2, 'mount');

      view.addChild(child1);
      view.addChild(child2);
      view.mount();

      expect(mountSpy1).toHaveBeenCalled();
      expect(mountSpy2).toHaveBeenCalled();
    });

    it('returns this for chaining', () => {
      view = new View($container);

      const result = view.mount();

      expect(result).toBe(view);
    });
  });

  describe('lifecycle - ready', () => {
    it('calls onReady', () => {
      view = new View($container);
      const onReadySpy = vi.spyOn(view, 'onReady');

      view.mount();
      view.ready();

      expect(onReadySpy).toHaveBeenCalledOnce();
    });

    it('sets isReady to true', () => {
      view = new View($container);

      view.mount();
      view.ready();

      expect(view.isReady).toBe(true);
    });

    it('only calls ready once', () => {
      view = new View($container);
      const onReadySpy = vi.spyOn(view, 'onReady');

      view.mount();
      view.ready();
      view.ready();
      view.ready();

      expect(onReadySpy).toHaveBeenCalledOnce();
    });

    it('signals ready to all children', () => {
      view = new View($container);
      const child1 = new View($container);
      const child2 = new View($container);

      const readySpy1 = vi.spyOn(child1, 'ready');
      const readySpy2 = vi.spyOn(child2, 'ready');

      view.addChild(child1);
      view.addChild(child2);
      view.mount();
      view.ready();

      expect(readySpy1).toHaveBeenCalled();
      expect(readySpy2).toHaveBeenCalled();
    });

    it('returns this for chaining', () => {
      view = new View($container);

      view.mount();
      const result = view.ready();

      expect(result).toBe(view);
    });
  });

  describe('lifecycle - destroy', () => {
    it('calls onDestroy', () => {
      view = new View($container);
      const onDestroySpy = vi.spyOn(view, 'onDestroy');

      view.mount();
      view.destroy();

      expect(onDestroySpy).toHaveBeenCalledOnce();
    });

    it('destroys all children', () => {
      view = new View($container);
      const child1 = new View($container);
      const child2 = new View($container);

      const destroySpy1 = vi.spyOn(child1, 'destroy');
      const destroySpy2 = vi.spyOn(child2, 'destroy');

      view.addChild(child1);
      view.addChild(child2);
      view.mount();
      view.destroy();

      expect(destroySpy1).toHaveBeenCalled();
      expect(destroySpy2).toHaveBeenCalled();
    });

    it('clears children array', () => {
      view = new View($container);
      const child = new View($container);

      view.addChild(child);
      view.destroy();

      expect(view._children).toEqual([]);
    });

    it('removes node from DOM', () => {
      view = new View($container);
      view.$node = document.createElement('div');
      $container.appendChild(view.$node);

      view.destroy();

      expect($container.contains(view.$node)).toBe(false);
    });

    it('sets isMounted and isReady to false', () => {
      view = new View($container);

      view.mount();
      view.ready();
      view.destroy();

      expect(view.isMounted).toBe(false);
      expect(view.isReady).toBe(false);
    });

    it('clears event handlers', () => {
      view = new View($container);
      const $elem = document.createElement('button');
      $container.appendChild($elem);

      view.$node = $container;
      view.on($elem, 'click', () => {});

      expect(view._eventHandlers.size).toBe(1);

      view.destroy();

      expect(view._eventHandlers.size).toBe(0);
    });

    it('clears delegated events', () => {
      view = new View($container);
      view.$node = $container;

      view.delegate('click', '.button', () => {});

      expect(view._delegatedEvents.size).toBe(1);

      view.destroy();

      expect(view._delegatedEvents.size).toBe(0);
    });

    it('clears presenter reference', () => {
      view = new View($container);
      const presenter = { onViewEvent: vi.fn() };

      view.setPresenter(presenter);
      view.destroy();

      expect(view._presenter).toBe(null);
    });

    it('dispose() calls destroy()', () => {
      view = new View($container);
      const destroySpy = vi.spyOn(view, 'destroy');

      view.dispose();

      expect(destroySpy).toHaveBeenCalled();
    });

    it('returns this for chaining', () => {
      view = new View($container);

      view.mount();
      const result = view.destroy();

      expect(result).toBe(view);
    });
  });

  describe('children management', () => {
    it('adds child', () => {
      view = new View($container);
      const child = new View($container);

      view.addChild(child);

      expect(view._children).toContain(child);
      expect(view._children.length).toBe(1);
    });

    it('returns child from addChild', () => {
      view = new View($container);
      const child = new View($container);

      const result = view.addChild(child);

      expect(result).toBe(child);
    });

    it('removes child', () => {
      view = new View($container);
      const child = new View($container);

      view.addChild(child);
      view.removeChild(child);

      expect(view._children).not.toContain(child);
      expect(view._children.length).toBe(0);
    });

    it('destroys child on remove', () => {
      view = new View($container);
      const child = new View($container);
      const destroySpy = vi.spyOn(child, 'destroy');

      view.addChild(child);
      view.removeChild(child);

      expect(destroySpy).toHaveBeenCalled();
    });

    it('does nothing if child not found', () => {
      view = new View($container);
      const child1 = new View($container);
      const child2 = new View($container);

      view.addChild(child1);
      view.removeChild(child2);

      expect(view._children).toContain(child1);
      expect(view._children.length).toBe(1);
    });

    it('returns this from removeChild', () => {
      view = new View($container);
      const child = new View($container);

      view.addChild(child);
      const result = view.removeChild(child);

      expect(result).toBe(view);
    });
  });

  describe('MVP support', () => {
    it('sets presenter reference', () => {
      view = new View($container);
      const presenter = { onViewEvent: vi.fn() };

      view.setPresenter(presenter);

      expect(view._presenter).toBe(presenter);
    });

    it('emits events to presenter', () => {
      view = new View($container);
      const presenter = { onViewEvent: vi.fn() };

      view.setPresenter(presenter);
      view.emit('testEvent', { foo: 'bar' });

      expect(presenter.onViewEvent).toHaveBeenCalledWith('testEvent', { foo: 'bar' });
    });

    it('does not throw if no presenter', () => {
      view = new View($container);

      expect(() => view.emit('testEvent', {})).not.toThrow();
    });

    it('calls update method', () => {
      view = new View($container);
      const updateSpy = vi.spyOn(view, 'update');
      const state = { count: 42 };

      view.update(state);

      expect(updateSpy).toHaveBeenCalledWith(state);
    });

    it('patch calls update by default', () => {
      view = new View($container);
      const updateSpy = vi.spyOn(view, 'update');
      const state = { count: 42 };
      const changes = { count: 43 };

      view.patch(changes, state);

      expect(updateSpy).toHaveBeenCalledWith(state);
    });
  });

  describe('DOM helpers', () => {
    it('setRoot sets $node', () => {
      view = new View($container);
      const $elem = document.createElement('div');

      view.setRoot($elem);

      expect(view.$node).toBe($elem);
    });

    it('getRoot returns $node', () => {
      view = new View($container);
      const $elem = document.createElement('div');

      view.$node = $elem;

      expect(view.getRoot()).toBe($elem);
    });

    it('createElement creates HTML element', () => {
      view = new View($container);
      view.$node = $container;

      const $elem = view.createElement('div', { class: 'test', id: 'my-div' });

      expect($elem.tagName).toBe('DIV');
      expect($elem.className).toBe('test');
      expect($elem.id).toBe('my-div');
      expect($container.contains($elem)).toBe(true);
    });

    it('createElement creates SVG element', () => {
      view = new View($container);
      view.$node = $container;

      const $svg = view.createElement('svg', { width: '100', height: '100' });

      expect($svg.tagName).toBe('svg');
      expect($svg.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
      expect($svg.getAttribute('width')).toBe('100');
    });

    it('createElement creates SVG path', () => {
      view = new View($container);
      const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      $container.appendChild($svg);
      view.$node = $svg;

      const $path = view.createElement('path', { d: 'M 0 0 L 100 100' });

      expect($path.tagName).toBe('path');
      expect($path.getAttribute('d')).toBe('M 0 0 L 100 100');
    });

    it('createElement adds event listeners', () => {
      view = new View($container);
      view.$node = $container;
      const handler = vi.fn();

      const $button = view.createElement('button', {}, { click: handler });

      $button.click();

      expect(handler).toHaveBeenCalled();
    });

    it('createElement uses $parent if $node not set', () => {
      view = new View($container);

      const $elem = view.createElement('div');

      expect($container.contains($elem)).toBe(true);
    });
  });

  describe('event delegation', () => {
    it('delegates event to selector', () => {
      view = new View($container);
      view.$node = $container;
      const handler = vi.fn();

      const $button = document.createElement('button');
      $button.className = 'test-button';
      $container.appendChild($button);

      view.delegate('click', '.test-button', handler);
      $button.click();

      expect(handler).toHaveBeenCalled();
    });

    it('passes event and target to handler', () => {
      view = new View($container);
      view.$node = $container;
      const handler = vi.fn();

      const $button = document.createElement('button');
      $button.className = 'test-button';
      $container.appendChild($button);

      view.delegate('click', '.test-button', handler);
      $button.click();

      expect(handler).toHaveBeenCalledWith(expect.any(Event), $button);
    });

    it('handles multiple selectors for same event', () => {
      view = new View($container);
      view.$node = $container;
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const $button1 = document.createElement('button');
      $button1.className = 'button-1';
      $container.appendChild($button1);

      const $button2 = document.createElement('button');
      $button2.className = 'button-2';
      $container.appendChild($button2);

      view.delegate('click', '.button-1', handler1);
      view.delegate('click', '.button-2', handler2);

      $button1.click();
      $button2.click();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('undelegates event', () => {
      view = new View($container);
      view.$node = $container;
      const handler = vi.fn();

      const $button = document.createElement('button');
      $button.className = 'test-button';
      $container.appendChild($button);

      view.delegate('click', '.test-button', handler);
      view.undelegate('click', '.test-button');

      $button.click();

      expect(handler).not.toHaveBeenCalled();
    });

    it('removes event listener when all selectors undelegated', () => {
      view = new View($container);
      view.$node = $container;

      view.delegate('click', '.button-1', vi.fn());
      expect(view._delegatedEvents.size).toBe(1);

      view.undelegate('click', '.button-1');
      expect(view._delegatedEvents.size).toBe(0);
    });

    it('keeps event listener if other selectors remain', () => {
      view = new View($container);
      view.$node = $container;

      view.delegate('click', '.button-1', vi.fn());
      view.delegate('click', '.button-2', vi.fn());

      view.undelegate('click', '.button-1');

      expect(view._delegatedEvents.size).toBe(1);
    });
  });

  describe('event binding', () => {
    it('binds event handler', () => {
      view = new View($container);
      const $button = document.createElement('button');
      $container.appendChild($button);
      const handler = vi.fn();

      view.on($button, 'click', handler);
      $button.click();

      expect(handler).toHaveBeenCalled();
    });

    it('binds handler with correct context', () => {
      view = new View($container);
      const $button = document.createElement('button');
      $container.appendChild($button);
      let context;

      view.on($button, 'click', function () {
        context = this;
      });

      $button.click();

      expect(context).toBe(view);
    });

    it('returns binding key', () => {
      view = new View($container);
      const $button = document.createElement('button');
      $container.appendChild($button);

      const key = view.on($button, 'click', vi.fn());

      expect(typeof key).toBe('string');
      expect(key).toContain('click');
    });

    it('unbinds event by key', () => {
      view = new View($container);
      const $button = document.createElement('button');
      $container.appendChild($button);
      const handler = vi.fn();

      const key = view.on($button, 'click', handler);
      view.off(key);

      $button.click();

      expect(handler).not.toHaveBeenCalled();
    });

    it('does nothing if key not found', () => {
      view = new View($container);

      expect(() => view.off('invalid-key')).not.toThrow();
    });

    it('tracks multiple bindings', () => {
      view = new View($container);
      const $button1 = document.createElement('button');
      const $button2 = document.createElement('button');
      $container.appendChild($button1);
      $container.appendChild($button2);

      view.on($button1, 'click', vi.fn());
      view.on($button2, 'click', vi.fn());

      expect(view._eventHandlers.size).toBe(2);
    });
  });

  describe('lifecycle integration', () => {
    it('full lifecycle: mount -> ready -> destroy', () => {
      view = new View($container);
      const renderSpy = vi.spyOn(view, 'render');
      const onMountSpy = vi.spyOn(view, 'onMount');
      const onReadySpy = vi.spyOn(view, 'onReady');
      const onDestroySpy = vi.spyOn(view, 'onDestroy');

      view.mount();
      expect(renderSpy).toHaveBeenCalled();
      expect(onMountSpy).toHaveBeenCalled();
      expect(view.isMounted).toBe(true);

      view.ready();
      expect(onReadySpy).toHaveBeenCalled();
      expect(view.isReady).toBe(true);

      view.destroy();
      expect(onDestroySpy).toHaveBeenCalled();
      expect(view.isMounted).toBe(false);
      expect(view.isReady).toBe(false);
    });

    it('cascades lifecycle to children', () => {
      view = new View($container);
      const child1 = new View($container);
      const child2 = new View($container);

      view.addChild(child1);
      view.addChild(child2);

      view.mount();
      expect(child1.isMounted).toBe(true);
      expect(child2.isMounted).toBe(true);

      view.ready();
      expect(child1.isReady).toBe(true);
      expect(child2.isReady).toBe(true);

      view.destroy();
      expect(child1.isMounted).toBe(false);
      expect(child2.isMounted).toBe(false);
    });

    it('cleanup removes all traces', () => {
      view = new View($container);
      const $button = document.createElement('button');
      $container.appendChild($button);
      const presenter = { onViewEvent: vi.fn() };

      view.$node = $container;
      view.setPresenter(presenter);
      view.on($button, 'click', vi.fn());
      view.delegate('click', '.test', vi.fn());

      const child = new View($container);
      view.addChild(child);

      view.mount();
      view.ready();
      view.destroy();

      expect(view._children.length).toBe(0);
      expect(view._eventHandlers.size).toBe(0);
      expect(view._delegatedEvents.size).toBe(0);
      expect(view._presenter).toBe(null);
      expect(view.isMounted).toBe(false);
      expect(view.isReady).toBe(false);
    });
  });
});
