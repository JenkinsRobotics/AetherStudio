import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { NewFileDialog } from './NewFileDialog';

test('creation stays pending once, preserves the name on failure and closes only after success', async () => {
  let reject!: (e: Error) => void;
  const create = vi.fn().mockImplementationOnce(() => new Promise<void>((_, fail) => { reject = fail; })).mockResolvedValueOnce(undefined);
  const close = vi.fn();
  render(<NewFileDialog title="New file" directory="Team / Models" onCreate={create} onClose={close} />);
  const name = screen.getByRole('textbox', {name:'Name'});
  fireEvent.change(name, {target:{value:'Wheel'}});
  const form = name.closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(create).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name:'Close'}));
  expect(close).not.toHaveBeenCalled();
  reject(new Error('No permission to create here.'));
  await screen.findByRole('alert');
  expect((name as HTMLInputElement).value).toBe('Wheel');
  expect(close).not.toHaveBeenCalled();
  fireEvent.submit(form);
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});
