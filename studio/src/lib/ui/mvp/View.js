/** View - base class for all UI components with lifecycle and optional MVP support */
export default class View {
  constructor($parent) {
    this.$parent = $parent;
    this.$node = null;
    this._children = [];
    this._isMounted = false;
    this._isReady = false;
    this._eventHandlers = new Map();
    this._delegatedEvents = new Map();
    this._presenter = null;
  }

  // ============================================================================
  // Aliases
  // ============================================================================

  /** Alias for $node - MVP uses $root */
  get $root() {
    return this.$node;
  }

  set $root(value) {
    this.$node = value;
  }

  // ============================================================================
  // Lifecycle Hooks (override in subclass)
  // ============================================================================

  /** Create DOM structure - called by mount() */
  render() {}

  /** Called after DOM created, before children ready */
  onMount() {}

  /** Called after all children ready, safe to add signals */
  onReady() {}

  /** Cleanup before destroy */
  onDestroy() {
    for (const [eventType, { handler }] of this._delegatedEvents) {
      if (this.$node) {
        this.$node.removeEventListener(eventType, handler);
      }
    }
    this._delegatedEvents.clear();

    for (const { $element, eventType, handler } of this._eventHandlers.values()) {
      $element.removeEventListener(eventType, handler);
    }
    this._eventHandlers.clear();

    this._presenter = null;
  }

  // ============================================================================
  // MVP Support (optional - only used with Presenter)
  // ============================================================================

  /** Update DOM with state - called by Presenter */
  update(state) {}

  /** Partial update - called by Presenter on state changes */
  patch(changes, state) {
    this.update(state);
  }

  /** Emit event to Presenter */
  emit(eventName, data) {
    if (this._presenter) {
      this._presenter.onViewEvent(eventName, data);
    }
  }

  /** Set Presenter reference */
  setPresenter(presenter) {
    this._presenter = presenter;
  }

  // ============================================================================
  // Children Management
  // ============================================================================

  /** Register a child component */
  addChild(child) {
    this._children.push(child);

    return child;
  }

  /** Remove a child component */
  removeChild(child) {
    const index = this._children.indexOf(child);

    if (index > -1) {
      this._children.splice(index, 1);
      child.destroy();
    }

    return this;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /** Mount this component and all children */
  mount() {
    if (this._isMounted) {
      return this;
    }

    this.render();
    this._children.forEach(c => c.mount());
    this._isMounted = true;
    this.onMount();

    return this;
  }

  /** Signal all components are ready (call on root only) */
  ready() {
    if (this._isReady) {
      return this;
    }

    this._children.forEach(c => c.ready());
    this._isReady = true;
    this.onReady();

    return this;
  }

  /** Destroy this component and all children */
  destroy() {
    this._children.forEach(c => c.destroy());
    this._children = [];
    this.onDestroy();

    if (this.$node && this.$node.parentNode) {
      this.$node.parentNode.removeChild(this.$node);
    }

    this._isMounted = false;
    this._isReady = false;

    return this;
  }

  /** Alias for destroy - backward compatibility */
  dispose() {
    this.destroy();
  }

  /** Check if mounted */
  get isMounted() {
    return this._isMounted;
  }

  /** Check if ready */
  get isReady() {
    return this._isReady;
  }

  // ============================================================================
  // DOM Helpers
  // ============================================================================

  setRoot($element) {
    this.$node = $element;
  }

  getRoot() {
    return this.$node;
  }

  createElement(tag, props = {}, listeners = {}) {
    const $parent = this.$node || this.$parent;
    const isSvg = ['svg', 'path', 'line', 'text'].includes(tag);
    const $elem = isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag);

    if (tag === 'svg') {
      $elem.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    for (const [key, value] of Object.entries(props)) {
      if (isSvg) {
        $elem.setAttributeNS(null, key, value);
      } else if (key === 'class') {
        $elem.className = value;
      } else {
        $elem.setAttribute(key, value);
      }
    }

    for (const [event, handler] of Object.entries(listeners)) {
      $elem.addEventListener(event, handler);
    }

    $parent.appendChild($elem);

    return $elem;
  }

  // ============================================================================
  // Event Delegation
  // ============================================================================

  delegate(eventType, selector, handler) {
    if (!this._delegatedEvents.has(eventType)) {
      const delegatedHandler = e => this._handleDelegated(e, eventType);
      this.$node.addEventListener(eventType, delegatedHandler);
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

      if (target && this.$node.contains(target)) {
        handler(e, target);
      }
    }
  }

  undelegate(eventType, selector) {
    const delegated = this._delegatedEvents.get(eventType);

    if (delegated) {
      delegated.selectors.delete(selector);

      if (delegated.selectors.size === 0) {
        this.$node.removeEventListener(eventType, delegated.handler);
        this._delegatedEvents.delete(eventType);
      }
    }
  }

  // ============================================================================
  // Event Binding
  // ============================================================================

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
      const { $element, eventType, handler } = binding;
      $element.removeEventListener(eventType, handler);
      this._eventHandlers.delete(key);
    }
  }
}
