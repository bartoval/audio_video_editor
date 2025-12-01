export default class Presenter {
  constructor(model, view) {
    this.model = model;
    this.view = view;

    this.view.setPresenter(this);

    this._unsubscribe = this.model.subscribe((changes, model) => {
      this._onModelChange(changes, model);
    });

    this._render();
  }

  _onModelChange(changes, model) {
    this.view.patch(changes, model.getState());
    this.onModelChange(changes);
  }

  onModelChange(changes) {}

  _render() {
    this.view.render(this.model.getState());
    this.view.mounted();
  }

  onViewEvent(eventName, data) {
    const handlerName = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;

    if (typeof this[handlerName] === 'function') {
      this[handlerName](data);
    } else {
      console.warn(`[Presenter] No handler for event: ${eventName}`);
    }
  }

  set(key, value) {
    this.model.set(key, value);
  }

  update(updates) {
    this.model.update(updates);
  }

  get(key) {
    return this.model.get(key);
  }

  getState() {
    return this.model.getState();
  }

  batch(fn) {
    this.model.batch(fn);
  }

  refresh() {
    this._render();
  }

  dispose() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    this.view.dispose();
    this.model.dispose();

    this.model = null;
    this.view = null;
  }
}
