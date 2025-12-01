/**
 * Browser sanity test - verify Vitest Browser Mode works
 */
import { describe, it, expect } from 'vitest';

describe('Browser Environment', () => {
  it('has real DOM', () => {
    const div = document.createElement('div');
    div.style.width = '100px';
    document.body.appendChild(div);

    // In real browser, offsetWidth works
    expect(div.offsetWidth).toBe(100);

    div.remove();
  });

  it('can dispatch mouse events', () => {
    let clicked = false;
    const div = document.createElement('div');
    div.addEventListener('click', () => {
      clicked = true;
    });
    document.body.appendChild(div);

    div.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(clicked).toBe(true);
    div.remove();
  });
});
