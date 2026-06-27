import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TiltCard } from '../src/shared/TiltCard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderCard() {
  const { container } = render(
    <TiltCard className="workflow-item">
      <span>Card body</span>
    </TiltCard>
  );
  const card = container.querySelector('article.tilt') as HTMLElement;
  card.getBoundingClientRect = () =>
    ({ width: 200, height: 100, left: 0, top: 0, right: 200, bottom: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return card;
}

describe('TiltCard', () => {
  it('tilts toward the pointer and resets on leave', () => {
    const card = renderCard();

    fireEvent.pointerMove(card, { clientX: 200, clientY: 0 });
    expect(card.style.getPropertyValue('--tilt-y')).toBe('5.00deg');
    expect(card.style.getPropertyValue('--tilt-x')).toBe('5.00deg');

    fireEvent.pointerMove(card, { clientX: 0, clientY: 100 });
    expect(card.style.getPropertyValue('--tilt-y')).toBe('-5.00deg');
    expect(card.style.getPropertyValue('--tilt-x')).toBe('-5.00deg');

    fireEvent.pointerLeave(card);
    expect(card.style.getPropertyValue('--tilt-x')).toBe('0deg');
    expect(card.style.getPropertyValue('--tilt-y')).toBe('0deg');
  });

  it('does not tilt when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const card = renderCard();
    fireEvent.pointerMove(card, { clientX: 200, clientY: 0 });
    expect(card.style.getPropertyValue('--tilt-y')).toBe('');
  });

  it('tilts when reduced motion is not preferred', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const card = renderCard();
    fireEvent.pointerMove(card, { clientX: 100, clientY: 50 });
    expect(card.style.getPropertyValue('--tilt-x')).toBe('0.00deg');
    expect(card.style.getPropertyValue('--tilt-y')).toBe('0.00deg');
  });

  it('ignores movement before the card has measurable size', () => {
    const { container } = render(
      <TiltCard>
        <span>No size</span>
      </TiltCard>
    );
    const card = container.querySelector('article.tilt') as HTMLElement;
    fireEvent.pointerMove(card, { clientX: 10, clientY: 10 });
    expect(card.style.getPropertyValue('--tilt-x')).toBe('');
  });

  it('ignores movement when only the height is unmeasured', () => {
    const { container } = render(
      <TiltCard>
        <span>Flat</span>
      </TiltCard>
    );
    const card = container.querySelector('article.tilt') as HTMLElement;
    card.getBoundingClientRect = () =>
      ({ width: 200, height: 0, left: 0, top: 0, right: 200, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerMove(card, { clientX: 50, clientY: 0 });
    expect(card.style.getPropertyValue('--tilt-x')).toBe('');
  });
});
