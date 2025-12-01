import Component from 'Component';

export default class View {
  constructor($parent) {
    this.$parent = $parent;
    this.$root = null;
    this._eventHandlers = new Map();
    this._delegatedEvents = new Map();
  }

  render(state) {
    throw new Error('View.render() must be implemented by subclass');
  }

  patch(changes, state) {
    this.render(state);
  }

  createElement(tag, props = [], listeners = {}) {
    return Component.render(this.$root || this.$parent, tag, props, listeners);
  }

  setRoot($element) {
    this.$root = $element;
  }

  getRoot() {
    return this.$root;
  }

  delegate(eventType, selector, handler) {
    if (!this._delegatedEvents.has(eventType)) {
      const delegatedHandler = (e) => this._handleDelegated(e, eventType);
      this.$root.addEventListener(eventType, delegatedHandler);
      this._delegatedEvents.set(eventType, {
        handler: delegatedHandler,
        selectors: new Map()
      });
    }

    this._delegatedEvents.get(eventType).selectors.set(selector, handler);
  }

  _handleDelegated(e, eventType) {
    const { selectors } = this._delegatedEvents.get(eventType);

    for (const [selector, handler] of selectors) {
      const target = e.target.closest(selector);

      if (target && this.$root.contains(target)) {
        handler(e, target);
      }
    }
  }

  undelegate(eventType, selector) {
    const delegated = this._delegatedEvents.get(eventType);

    if (delegated) {
      delegated.selectors.delete(selector);

      if (delegated.selectors.size === 0) {
        this.$root.removeEventListener(eventType, delegated.handler);
        this._delegatedEvents.delete(eventType);
      }
    }
  }

  on($element, eventType, handler) {
    const boundHandler = handler.bind(this);
    $element.addEventListener(eventType, boundHandler);

    const key = `${eventType}-${Math.random()}`;
    this._eventHandlers.set(key, { $element, eventType, handler: boundHandler });

    return key;
  }

  off(key) {
    const binding = this._eventHandlers.get(key);

    if (binding) {
      binding.$element.removeEventListener(binding.eventType, binding.handler);
      this._eventHandlers.delete(key);
    }
  }

  emit(eventName, data) {
    if (this._presenter) {
      this._presenter.onViewEvent(eventName, data);
    }
  }

  setPresenter(presenter) {
    this._presenter = presenter;
  }

  mounted() {}

  beforeDispose() {}

  dispose() {
    this.beforeDispose();

    for (const [eventType, { handler }] of this._delegatedEvents) {
      if (this.$root) {
        this.$root.removeEventListener(eventType, handler);
      }
    }
    this._delegatedEvents.clear();

    for (const { $element, eventType, handler } of this._eventHandlers.values()) {
      $element.removeEventListener(eventType, handler);
    }
    this._eventHandlers.clear();

    if (this.$root && this.$root.parentNode) {
      this.$root.parentNode.removeChild(this.$root);
    }

    this.$root = null;
    this.$parent = null;
    this._presenter = null;
  }
}
