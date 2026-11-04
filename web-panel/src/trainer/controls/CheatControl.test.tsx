import { fireEvent, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';

import { ECheatType, type CheatSchema } from '../../../protocol/messages';
import { makeCheat, renderWithI18n } from '../../testing/fixtures';
import { CheatControl } from './CheatControl';

function renderControl(cheat: CheatSchema, value: unknown, extra: { pending?: boolean; disabled?: boolean } = {}) {
  const onChange = vi.fn();
  const view = renderWithI18n(
    <CheatControl cheat={cheat} value={value} pending={extra.pending ?? false} disabled={extra.disabled ?? false} onChange={onChange} />,
  );
  return { ...view, onChange };
}

describe('CheatControl', () => {
  it('flips a toggle', () => {
    const { onChange } = renderControl(makeCheat({ type: ECheatType.Toggle }), true);
    const toggle = screen.getByRole('button');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('disables the control while a write is pending', () => {
    renderControl(makeCheat({ type: ECheatType.Toggle }), false, { pending: true });
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('steps a number within its range and strips grouping from typed input', () => {
    const cheat = makeCheat({ type: ECheatType.Number, args: { min: 0, max: 1000, step: 100 } });
    const { onChange } = renderControl(cheat, 950);
    const [decrement, increment] = screen.getAllByRole('button');
    fireEvent.click(increment);
    fireEvent.click(decrement);
    expect(onChange).toHaveBeenNthCalledWith(1, 1000);
    expect(onChange).toHaveBeenNthCalledWith(2, 850);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('950');
    fireEvent.input(input, { target: { value: '1,250' } });
    expect(onChange).toHaveBeenLastCalledWith('1250');
  });

  it('renders a labelled action button that sends a one-shot value', () => {
    const { onChange } = renderControl(makeCheat({ type: ECheatType.Button, args: { button: 'Heal' } }), undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('picks a selection option, matching numeric and string values', () => {
    const cheat = makeCheat({ type: ECheatType.Selection, args: { options: [{ label: 'Easy', value: 1 }, { label: 'Hard', value: 2 }] } });
    const { onChange } = renderControl(cheat, '2');
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(onChange).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('button', { name: 'Easy' })).toBeNull();
  });

  it('walks incremental options and disables the edges', () => {
    const cheat = makeCheat({ type: ECheatType.Incremental, args: { options: ['x1', 'x2', 'x3'] } });
    const { onChange } = renderControl(cheat, 'x1');
    const [previous, next] = screen.getAllByRole('button') as HTMLButtonElement[];
    expect(previous.disabled).toBe(true);
    expect(screen.getByText('x1')).toBeTruthy();
    fireEvent.click(next);
    expect(onChange).toHaveBeenCalledWith('x2');
  });

  it('shows the slider value with its postfix', () => {
    renderControl(makeCheat({ type: ECheatType.Slider, args: { min: 0, max: 2, step: 0.5, postfix: 'x' } }), 1.5);
    expect(screen.getByText('1.5x')).toBeTruthy();
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('1.5');
  });
});
