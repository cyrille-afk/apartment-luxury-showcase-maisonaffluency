import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PairingMediaEditor from './PairingMediaEditor';
const mocks = vi.hoisted(() => ({ upload: vi.fn(), change: vi.fn(), busy: vi.fn() }));
vi.mock('@/hooks/useCuratorPickDetail', () => ({ useCuratorPickDetail: () => ({ data: { size_variants: [], gallery_images: [] }, isPending: false, isError: false }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({ upload: mocks.upload, getPublicUrl: () => ({ data: { publicUrl: 'https://assets.example/finish.jpg' } }) }) } } }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.upload.mockResolvedValue({ error: null });
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1024, height: 1024, close: vi.fn() }));
  vi.stubGlobal('Image', class { onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function open() {
  render(<PairingMediaEditor pickId="pick" hero="https://assets.example/hero.jpg" options={[{ id: 'oak', name: 'Oak', price_cents: 100 }]} entries={[]} onChange={mocks.change} onBusy={mocks.busy} />);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: 'Oak' }));
}
describe('admin finish image upload', () => {
  it('uploads and assigns a validated product photo to the selected finish', async () => {
    await open(); fireEvent.change(screen.getByLabelText('Upload product photo'), { target: { files: [new File(['image'], 'oak.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(mocks.change).toHaveBeenCalledWith([{ key: 'custom:oak', label: 'Oak', product_image_url: 'https://assets.example/finish.jpg' }]));
    expect(mocks.upload).toHaveBeenCalledOnce(); expect(mocks.busy).toHaveBeenLastCalledWith(false);
  });
  it('retains assignments after storage rejects an upload', async () => {
    mocks.upload.mockResolvedValue({ error: new Error('Upload denied') }); await open();
    fireEvent.change(screen.getByLabelText('Upload macro texture tile'), { target: { files: [new File(['image'], 'oak.jpg', { type: 'image/jpeg' })] } });
    await screen.findByRole('alert'); expect(mocks.change).not.toHaveBeenCalled(); expect(mocks.busy).toHaveBeenLastCalledWith(false);
  });
  it('blocks undecodable or undersized images before storage writes', async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({ width: 100, height: 100, close: vi.fn() } as unknown as ImageBitmap); await open();
    fireEvent.change(screen.getByLabelText('Upload product photo'), { target: { files: [new File(['image'], 'oak.jpg', { type: 'image/jpeg' })] } });
    await screen.findByRole('alert'); expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.change).not.toHaveBeenCalled();
  });
});