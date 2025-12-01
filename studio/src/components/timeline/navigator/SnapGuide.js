import View from '../../../lib/ui/mvp/View.js';

export default class SnapGuide extends View {
  #$line = null;
  #$label = null;

  constructor($parent) {
    super($parent);
    this.render();
  }

  template() {
    return `
			<div class="snap-guide-overlay" data-testid="snap-guide">
				<div class="snap-guide-line" data-testid="snap-guide-line"></div>
				<div class="snap-guide-label" data-testid="snap-guide-label"></div>
			</div>
		`;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    this.#$line = this.$node.querySelector('.snap-guide-line');
    this.#$label = this.$node.querySelector('.snap-guide-label');
  }

  show(posX, label, type) {
    this.$node.className = 'snap-guide-overlay visible';

    if (type) {
      this.$node.classList.add(`snap-type-${type}`);
    }

    this.#$line.style.left = `${posX}px`;

    if (label) {
      this.#$label.textContent = label;
      this.#$label.style.left = `${posX + 5}px`;
      this.#$label.classList.add('visible');
    } else {
      this.#$label.classList.remove('visible');
    }
  }

  hide() {
    this.$node.classList.remove('visible');
    this.#$label.classList.remove('visible');
  }

  destroy() {
    this.$node?.remove();
    this.#$line = null;
    this.#$label = null;
  }
}
