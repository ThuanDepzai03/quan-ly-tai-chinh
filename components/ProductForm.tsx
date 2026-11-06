'use client';
import { useState } from 'react';
import type { AppState, Product, ProductInput } from '@/lib/types';
import { useAppData } from '@/lib/data';
import { fileToBase64 } from '@/lib/receipt';
import { Field } from './GlassCard';

interface VariantRow { id?: string; name: string; cost_price: string; sale_price: string; stock: string; imeis: string; }

export default function ProductForm({ state, editing, onDone }: {
  state: AppState;
  editing?: { product: Product; variants: ProductInput['variants'] } | null;
  onDone: () => void;
}) {
  const { saveProduct } = useAppData();
  const wsId = state.currentWorkspaceId;
  const enabledFields = state.productFields.filter((f) => f.workspace_id === wsId && f.enabled);
  const cats = state.productCategories.filter((c) => c.workspace_id === wsId);

  const [name, setName] = useState(editing?.product.name ?? '');
  const [sku, setSku] = useState(editing?.product.sku ?? '');
  const [unit, setUnit] = useState(editing?.product.unit ?? 'cái');
  const [categoryId, setCategoryId] = useState(editing?.product.category_id ?? '');
  const [cost, setCost] = useState(String(editing?.product.cost_price ?? 0));
  const [sale, setSale] = useState(String(editing?.product.sale_price ?? 0));
  const [stock, setStock] = useState(String(editing?.product.stock ?? 0));
  const [minStock, setMinStock] = useState(String(editing?.product.min_stock ?? 0));
  const [custom, setCustom] = useState<Record<string, string>>(editing?.product.custom_values ?? {});
  const [image, setImage] = useState<string | null>(editing?.product.image ?? null);
  const [variants, setVariants] = useState<VariantRow[]>(
    (editing?.variants ?? []).map((v) => ({
      id: v.id, name: v.name, cost_price: String(v.cost_price),
      sale_price: String(v.sale_price), stock: String(v.stock),
      imeis: (v.imeis ?? []).join(', '),
    })),
  );
  const [err, setErr] = useState('');

  function setVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Vui lòng nhập tên sản phẩm.'); return; }
    for (const f of enabledFields) {
      if (f.required && !(custom[f.name] ?? '').trim()) { setErr(`Trường "${f.name}" là bắt buộc.`); return; }
    }
    saveProduct({
      id: editing?.product.id,
      name: name.trim(), sku: sku.trim(), unit: unit.trim() || 'cái',
      category_id: categoryId || null,
      cost_price: Number(cost) || 0, sale_price: Number(sale) || 0,
      stock: Number(stock) || 0, min_stock: Number(minStock) || 0,
      custom_values: custom, image,
      variants: variants
        .filter((v) => v.name.trim())
        .map((v) => ({
          id: v.id, name: v.name.trim(),
          cost_price: Number(v.cost_price) || 0, sale_price: Number(v.sale_price) || 0,
          stock: Number(v.stock) || 0,
          imeis: v.imeis.split(',').map((s) => s.trim()).filter(Boolean),
        })),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Tên sản phẩm">
        <input placeholder="VD: Ốp lưng iPhone 15" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="form-row">
        <Field label="Mã SKU">
          <input placeholder="VD: OP-IP15" value={sku} onChange={(e) => setSku(e.target.value)} />
        </Field>
        <Field label="Đơn vị">
          <input placeholder="cái / hộp / kg" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>
      <Field label="Danh mục hàng">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">— Không chọn —</option>
          {cats.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Giá nhập (đ)">
          <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Giá bán (đ)">
          <input type="number" min={0} value={sale} onChange={(e) => setSale(e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Tồn kho">
          <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        </Field>
        <Field label="Tồn tối thiểu (cảnh báo)">
          <input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
        </Field>
      </div>

      <Field label="Ảnh sản phẩm (JPEG/PNG, tối đa 2MB)">
        <div className="flex-row">
          <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            📷 Chọn ảnh
            <input type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { setImage(await fileToBase64(f)); }
              catch (err) { setErr(err instanceof Error ? err.message : 'Không đọc được ảnh.'); }
            }} />
          </label>
          {image ? <button type="button" className="btn-ghost" onClick={() => setImage(null)}>Gỡ ảnh</button> : null}
        </div>
        {image ? <img src={image} alt="Ảnh sản phẩm" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 12, marginTop: 8 }} /> : null}
      </Field>

      {enabledFields.length > 0 ? (
        <fieldset className="fieldset">
          <legend>Thuộc tính tùy chỉnh</legend>
          {enabledFields.map((f) => (
            <Field key={f.id} label={f.name + (f.required ? ' *' : '')}>
              {f.field_type === 'select' && f.options ? (
                <select value={custom[f.name] ?? ''} onChange={(e) => setCustom((c) => ({ ...c, [f.name]: e.target.value }))}>
                  <option value="">— Chọn —</option>
                  {f.options.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              ) : f.field_type === 'boolean' ? (
                <select value={custom[f.name] ?? 'Không'} onChange={(e) => setCustom((c) => ({ ...c, [f.name]: e.target.value }))}>
                  <option>Có</option><option>Không</option>
                </select>
              ) : (
                <input
                  type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                  placeholder={f.name}
                  value={custom[f.name] ?? ''}
                  onChange={(e) => setCustom((c) => ({ ...c, [f.name]: e.target.value }))}
                />
              )}
            </Field>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="fieldset">
        <legend>Biến thể (màu / size / dung lượng) — mỗi biến thể có giá &amp; tồn riêng</legend>
        {variants.map((v, i) => (
          <div key={i} className="variant-row">
            <input placeholder="Tên biến thể (VD: Đen)" value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} />
            <input type="number" min={0} placeholder="Giá nhập" value={v.cost_price} onChange={(e) => setVariant(i, { cost_price: e.target.value })} />
            <input type="number" min={0} placeholder="Giá bán" value={v.sale_price} onChange={(e) => setVariant(i, { sale_price: e.target.value })} />
            <input type="number" min={0} placeholder="Tồn" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} />
            <input placeholder="IMEI, cách nhau bằng dấu phẩy" value={v.imeis} onChange={(e) => setVariant(i, { imeis: e.target.value })} />
            <button type="button" className="btn-ghost" onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}>Xóa</button>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => setVariants((prev) => [...prev, { name: '', cost_price: cost, sale_price: sale, stock: '0', imeis: '' }])}>
          + Thêm biến thể
        </button>
      </fieldset>
      {err ? <p className="error">{err}</p> : null}
      <button type="submit">{editing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button>
    </form>
  );
}
