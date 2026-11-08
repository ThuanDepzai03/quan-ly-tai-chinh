'use client';
import { useState } from 'react';
import type { AppState, Product, ProductInput } from '@/lib/types';
import { useAppData } from '@/lib/data';
import { fileToBase64 } from '@/lib/receipt';
import { Field } from './GlassCard';
import { usePreferences } from '@/lib/preferences';

interface VariantRow { id?: string; name: string; cost_price: string; sale_price: string; stock: string; imeis: string; }

export default function ProductForm({ state, editing, onDone }: {
  state: AppState;
  editing?: { product: Product; variants: ProductInput['variants'] } | null;
  onDone: () => void;
}) {
  const { saveProduct } = useAppData();
  const { t } = usePreferences();
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
  const [saving, setSaving] = useState(false);
  const variantStock = variants.reduce((total, variant) => total + (Number(variant.stock) || 0), 0);

  function setVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Vui lòng nhập tên sản phẩm.'); return; }
    for (const f of enabledFields) {
      if (f.required && !(custom[f.name] ?? '').trim()) { setErr(`Trường "${f.name}" là bắt buộc.`); return; }
    }
    setSaving(true);
    setErr('');
    try {
      const error = await saveProduct({
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
      if (error) { setErr(error); return; }
      onDone();
    } catch (error) {
      setErr(`Không lưu được sản phẩm: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Tên sản phẩm">
        <input placeholder={t('VD: Ốp lưng iPhone 15')} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="form-row">
        <Field label="Mã SKU">
          <input placeholder={t('VD: OP-IP15')} value={sku} onChange={(e) => setSku(e.target.value)} />
        </Field>
        <Field label="Đơn vị">
          <input placeholder={t('cái / hộp / kg')} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>
      <Field label="Danh mục hàng">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">— {t('Không chọn')} —</option>
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
        <Field label={variants.length ? `${t('Tổng tồn kho')} (${variantStock})` : 'Tồn kho'}>
          <input type="number" min={0} value={variants.length ? String(variantStock) : stock}
            disabled={variants.length > 0} onChange={(e) => setStock(e.target.value)} />
        </Field>
        <Field label="Tồn tối thiểu (cảnh báo)">
          <input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
        </Field>
      </div>

      <Field label="Ảnh sản phẩm (JPEG/PNG, tối đa 2MB)">
        <div className="flex-row">
          <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            {t('📷 Chọn ảnh')}
            <input type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { setImage(await fileToBase64(f)); }
              catch (err) { setErr(err instanceof Error ? err.message : 'Không đọc được ảnh.'); }
            }} />
          </label>
          {image ? <button type="button" className="btn-ghost" onClick={() => setImage(null)}>{t('Gỡ ảnh')}</button> : null}
        </div>
        {image ? <img src={image} alt={t('Ảnh sản phẩm')} decoding="async" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 12, marginTop: 8 }} /> : null}
      </Field>

      {enabledFields.length > 0 ? (
        <fieldset className="fieldset">
          <legend>{t('Thuộc tính tùy chỉnh')}</legend>
          {enabledFields.map((f) => (
            <Field key={f.id} label={f.name + (f.required ? ' *' : '')}>
              {f.field_type === 'select' && f.options ? (
                <select value={custom[f.name] ?? ''} onChange={(e) => setCustom((c) => ({ ...c, [f.name]: e.target.value }))}>
                  <option value="">— {t('Chọn')} —</option>
                  {f.options.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              ) : f.field_type === 'boolean' ? (
                <select value={custom[f.name] ?? 'Không'} onChange={(e) => setCustom((c) => ({ ...c, [f.name]: e.target.value }))}>
                  <option>{t('Có')}</option><option>{t('Không')}</option>
                </select>
              ) : (
                <input
                  type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                  placeholder={t(f.name)}
                  value={custom[f.name] ?? ''}
                  onChange={(e) => setCustom((c) => ({ ...c, [f.name]: e.target.value }))}
                />
              )}
            </Field>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="fieldset">
        <legend>{t('Biến thể (màu / size / dung lượng) — mỗi biến thể có giá & tồn riêng')}</legend>
        {variants.map((v, i) => (
          <div key={v.id ?? i} className="variant-card">
            <div className="variant-card-header">
              <strong>{t('Biến thể')} {i + 1}</strong>
              <button type="button" className="btn-ghost btn-small" onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}>{t('Xóa')}</button>
            </div>
            <div className="variant-fields">
              <Field label="Tên / thuộc tính">
                <input placeholder={t('VD: Đen / 128 GB / Size M')} value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} />
              </Field>
              <Field label="Giá nhập (đ)">
                <input type="number" min={0} value={v.cost_price} onChange={(e) => setVariant(i, { cost_price: e.target.value })} />
              </Field>
              <Field label="Giá bán (đ)">
                <input type="number" min={0} value={v.sale_price} onChange={(e) => setVariant(i, { sale_price: e.target.value })} />
              </Field>
              <Field label="Tồn kho">
                <input type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} />
              </Field>
              <Field label="IMEI / Serial (phân cách bằng dấu phẩy)">
                <input placeholder={t('VD: 356789123456703, 356789123456704')} value={v.imeis} onChange={(e) => setVariant(i, { imeis: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => setVariants((prev) => [...prev, { name: '', cost_price: cost, sale_price: sale, stock: '0', imeis: '' }])}>
          {t('+ Thêm biến thể')}
        </button>
      </fieldset>
      {err ? <p className="error">{t(err)}</p> : null}
      <button type="submit" disabled={saving}>{saving ? t('Đang lưu…') : editing ? t('Lưu thay đổi') : t('Thêm sản phẩm')}</button>
    </form>
  );
}
