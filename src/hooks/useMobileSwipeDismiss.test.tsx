import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMobileSwipeDismiss } from './useMobileSwipeDismiss';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function setup(enabled = true) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  const panel = document.createElement('div');
  panel.style.overflowY = 'auto';
  const content = document.createElement('div');
  panel.append(content);
  document.body.append(panel);
  const onDismiss = vi.fn();
  renderHook(() => useMobileSwipeDismiss({ containerRef: { current: panel }, enabled, onDismiss }));
  const touch = (type: string, x: number, y: number, target = content, count = 1) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: Array.from({ length: count }, () => ({ clientX: x, clientY: y })) });
    target.dispatchEvent(event);
    return event;
  };
  const swipe = (dx: number, dy: number, target = content) => {
    touch('touchstart', 100, 100, target);
    touch('touchmove', 100 + dx, 100 + dy, target);
    touch('touchend', 100 + dx, 100 + dy, target);
  };
  return { panel, content, onDismiss, touch, swipe };
}

describe('mobile overlay dismissal', () => {
  it('dismisses once on a deliberate downward swipe and restores translation', () => {
    const s = setup(); s.swipe(5, 140);
    expect(s.onDismiss).toHaveBeenCalledTimes(1);
    expect(s.panel.style.translate).toBe('');
  });
  it('keeps horizontal and upward gestures available without dismissing', () => {
    const s = setup(); s.swipe(150, 15); s.swipe(0, -150);
    expect(s.onDismiss).not.toHaveBeenCalled();
  });
  it('ignores short movements', () => {
    const s = setup(); s.swipe(0, 20); expect(s.onDismiss).not.toHaveBeenCalled();
  });
  it('does not dismiss when content is scrolled', () => {
    const s = setup(); s.panel.scrollTop = 90; s.swipe(0, 150);
    expect(s.onDismiss).not.toHaveBeenCalled();
  });
  it('allows the grab handle to dismiss while content is scrolled', () => {
    const s = setup(); s.content.dataset.swipeDismissHandle = ''; s.panel.scrollTop = 90; s.swipe(0, 150);
    expect(s.onDismiss).toHaveBeenCalledTimes(1);
  });
  it('does not dismiss finish controls', () => {
    const s = setup(); const button = document.createElement('button'); s.content.append(button); s.swipe(0, 150, button);
    expect(s.onDismiss).not.toHaveBeenCalled();
  });
  it('cancels interrupted and multitouch gestures', () => {
    const s = setup(); s.touch('touchstart', 100, 100); s.touch('touchmove', 100, 240); s.touch('touchcancel', 100, 240); s.touch('touchend', 100, 240);
    s.touch('touchstart', 100, 100); s.touch('touchmove', 100, 240, s.content, 2); s.touch('touchend', 100, 240);
    expect(s.onDismiss).not.toHaveBeenCalled();
  });
  it('does nothing when mobile dismissal is disabled', () => {
    const s = setup(false); s.swipe(0, 150); expect(s.onDismiss).not.toHaveBeenCalled();
  });
});