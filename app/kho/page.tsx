'use client';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { EmptyState, Field, Modal, StatCard } from '@/components/GlassCard';
import ProductForm from '@/components/ProductForm';
import { useAppData } from '@/lib/data';
import { fmtDate, fmtVND, profitOf, todayISO } from '@/lib/utils';
import type { Product, ProductField, ProductInput } from '@/lib/types';
import { usePreferences } from '@/lib/preferences';

export default function Kho() {
  const data = useAppData();
  const { t } = usePreferences();
  const { state } = data;
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<{ product: Product; variants: ProductInput['variants'] } | null>(null);
  const [sellProduct, setSellProduct] = useState<Product | null>(null);
  const [importProduct, setImportProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const wsId = state?.currentWorkspaceId ?? null;
  const products = useMemo(
    () => (state?.products ?? []).filter((p) => p.workspace_id === wsId),
    [state, wsId]);
  const cats = useMemo(
    () => (state?.productCategories ?? []).filter((c) => c.workspace_id === wsId),
    [state, wsId]);
  const variants = state?.productVariants ?? [];
  const fields = useMemo(
    () => (state?.productFields ?? []).filter((f) => f.workspace_id === wsId),
    [state, wsId]);
  const movements = useMemo(
    () => (state?.stockMovements ?? []).filter((m) => m.workspace_id === wsId).slice(0, 15),
    [state, wsId]);

  const filtered = products.filter((p) => {
    const okCat = !catFilter || p.category_id === catFilter;
    const q = search.trim().toLowerCase();
    const okQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      || (p.custom_values?.IMEI ?? '').toLowerCase().includes(q);
    return okCat && okQ;
  });
  const totalCostValue = products.reduce((s, p) => s + p.stock * p.cost_price, 0);
  const totalSaleValue = products.reduce((s, p) => s + p.stock * p.sale_price, 0);
  const lowStock = products.filter((p) => p.stock <= p.min_stock);
  const totalProfit = useMemo(
    () => (state?.transactions ?? []).filter((t) => t.workspace_id === wsId)
      .reduce((s, t) => s + (t.profit ?? 0), 0),
    [state, wsId]);
  const catName = (id?: string | null) => cats.find((c) => c.id === id)?.name ?? '—';
  const productVariants = (pid: string) => variants.filter((v) => v.product_id === pid);

  function openEdit(p: Product) {
    const vs = productVariants(p.id).map((v) => ({
      id: v.id, name: v.name, cost_price: v.cost_price, sale_price: v.sale_price,
      stock: v.stock, imeis: v.imeis ?? [],
    }));
    setEditing({ product: p, variants: vs });
    setShowForm(true);
  }

  return (
    <AppShell>
      <div className="flex-row">
        <StatCard label="Sản phẩm" value={String(products.length)} sub={`${cats.length} ${t('danh mục hàng')}`} />
        <StatCard label="Giá trị tồn kho (giá nhập)" value={fmtVND(totalCostValue)} sub="Tổng vốn đang nằm trong kho" />
        <StatCard label="Giá trị tồn kho (giá bán)" value={fmtVND(totalSaleValue)} sub="Nếu bán hết kho" />
        <StatCard label="Lãi bán hàng tích lũy" value={fmtVND(totalProfit)} sub="Tổng profit các đơn bán" />
        <StatCard label="Sắp hết / hết hàng" value={String(lowStock.length)} sub={lowStock.map((p) => p.name).slice(0, 3).join(', ') || t('Không có')} />
      </div>

      <GlassCard title="Kho hàng" action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {products.length === 0 ? (
            <button className="btn-ghost btn-small" onClick={async () => {
              const err = await data.seedDemoInventory();
              setSeedMsg(err ?? t('Đã nạp kho mẫu giống bản demo: 11 sản phẩm, 7 danh mục, 5 trường tùy chỉnh, 5 biến thể.'));
            }}>{t('📥 Nạp kho mẫu')}</button>
          ) : null}
          <button className="btn-ghost btn-small" onClick={() => setShowCatManager(true)}>{t('Danh mục hàng')}</button>
          <button className="btn-ghost btn-small" onClick={() => setShowFieldManager(true)}>{t('Trường tùy chỉnh')}</button>
          <button className="btn-small" onClick={() => { setEditing(null); setShowForm(true); }}>{t('+ Thêm sản phẩm')}</button>
        </div>
      }>
        {seedMsg ? <p className="muted" style={{ fontSize: 13 }}>{seedMsg}</p> : null}
        <div className="toolbar">
          <input placeholder={t('Tìm theo tên, SKU, IMEI…')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">{t('Tất cả danh mục')}</option>
            {cats.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}
          </select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState text={products.length === 0 ? 'Kho chưa có sản phẩm nào — bấm “Thêm sản phẩm” để nhập mặt hàng đầu tiên.' : 'Không tìm thấy sản phẩm phù hợp.'} />
        ) : (
          <div className="row-list">
            {filtered.map((p) => {
              const vs = productVariants(p.id);
              const low = p.stock <= p.min_stock;
              return (
                <div key={p.id} className={`row-item inventory-product-row${p.image ? ' inventory-product-row-with-image' : ''}`} style={{ alignItems: 'flex-start' }}>
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      width={56}
                      height={56}
                      loading="lazy"
                      decoding="async"
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }}
                    />
                  ) : null}
                  <div className="inventory-product-details">
                    <b>{p.name}</b>{' '}
                    <span className="badge">{catName(p.category_id)}</span>{' '}
                    {low ? <span className="badge danger">{t('Sắp hết hàng')}</span> : null}
                    <div className="sub">
                      SKU: {p.sku || '—'} • {t('Nhập')} {fmtVND(p.cost_price)} • {t('Bán')} {fmtVND(p.sale_price)} •
                      {t('Tồn')}: <b style={{ color: low ? '#ff3b30' : 'inherit' }}>{p.stock} {p.unit}</b>
                      {p.custom_values && Object.entries(p.custom_values).map(([k, v]) => v ? ` • ${k}: ${v}` : '').join('')}
                    </div>
                    {vs.length > 0 ? (
                      <div className="sub" style={{ marginTop: 4 }}>
                        {t('Biến thể')}: {vs.map((v) => `${v.name} (${t('Tồn')} ${v.stock}, ${fmtVND(v.sale_price)}${v.imeis?.length ? `, ${v.imeis.length} IMEI` : ''})`).join(' • ')}
                      </div>
                    ) : null}
                  </div>
                  <div className="inventory-product-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn-small" onClick={() => setSellProduct(p)}>{t('Bán')}</button>
                    <button className="btn-ghost btn-small" onClick={() => setImportProduct(p)}>{t('Nhập kho')}</button>
                    <button className="btn-ghost btn-small" onClick={() => openEdit(p)}>{t('Sửa')}</button>
                    <button className="btn-ghost btn-small" onClick={() => setDeleteId(p.id)}>{t('Xóa')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard title="Lịch sử nhập / xuất kho (mới nhất)">
        {movements.length === 0 ? <EmptyState text="Chưa có lịch sử nhập/xuất kho." /> : (
          <div className="row-list">
            {movements.map((m) => {
              const p = products.find((x) => x.id === m.product_id);
              return (
                <div key={m.id} className="row-item">
                  <div>
                    <b>{m.kind === 'in' ? 'Nhập' : 'Xuất'} {m.quantity} × {p?.name ?? '—'}</b>
                    <div className="sub">{fmtDate(m.created_at)}{m.imei ? ` • IMEI ${m.imei}` : ''}{m.note ? ` • ${m.note}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {showForm && state ? (
        <Modal title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} onClose={() => setShowForm(false)}>
          <ProductForm state={state} editing={editing} onDone={() => setShowForm(false)} />
        </Modal>
      ) : null}
      {sellProduct ? <SellModal product={sellProduct} onClose={() => setSellProduct(null)} /> : null}
      {importProduct ? <ImportModal product={importProduct} onClose={() => setImportProduct(null)} /> : null}
      {deleteId ? (
        <Modal title="Xóa sản phẩm?" onClose={() => setDeleteId(null)}>
          <p>{t('Giao dịch bán/nhập cũ vẫn giữ số lượng và giá vốn để báo cáo lãi không đổi. Bạn chắc chắn muốn xóa?')}</p>
          <div className="flex-row">
            <button className="btn-danger" onClick={() => { data.deleteProduct(deleteId); setDeleteId(null); }}>{t('Xóa sản phẩm')}</button>
            <button className="btn-secondary" onClick={() => setDeleteId(null)}>{t('Hủy')}</button>
          </div>
        </Modal>
      ) : null}
      {showCatManager ? <CategoryManager onClose={() => setShowCatManager(false)} /> : null}
      {showFieldManager ? <FieldManager onClose={() => setShowFieldManager(false)} /> : null}
    </AppShell>
  );
}

function SellModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const data = useAppData();
  const { t } = usePreferences();
  const { state } = data;
  const wallets = (state?.wallets ?? []).filter((w) => w.workspace_id === state?.currentWorkspaceId);
  const variants = (state?.productVariants ?? []).filter((v) => v.product_id === product.id);
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [imei, setImei] = useState('');
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const variant = variants.find((v) => v.id === variantId);
  const sale = variant?.sale_price ?? product.sale_price;
  const cost = variant?.cost_price ?? product.cost_price;
  const stock = variant ? variant.stock : product.stock;
  const revenue = qty * sale;
  const profit = profitOf(qty, sale, cost);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const categoryId = state?.categories.find((c) => c.workspace_id === state.currentWorkspaceId && c.kind === 'income')?.id ?? null;
    setSaving(true);
    setErr('');
    try {
      const error = await data.addTransaction({
        type: 'income', amount: revenue, wallet_id: walletId, category_id: categoryId,
        product_id: product.id, variant_id: variantId || null, imei: imei || null,
        quantity: qty, unit_price: sale, cost_price: cost, note: note || `Bán ${product.name}`, date: todayISO(),
      });
      if (error) { setErr(error); return; }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`${t('Bán')}: ${product.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {variants.length > 0 ? (
          <Field label="Biến thể">
            <select value={variantId} onChange={(e) => { setVariantId(e.target.value); setImei(''); }}>
              <option value="">— {t('Giá chung của sản phẩm')} —</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.name} — tồn {v.stock} • {fmtVND(v.sale_price)}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label={`Số lượng (tồn: ${stock})`}>
          <input type="number" min={1} max={stock} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        {variant?.imeis?.length ? (
          <Field label="IMEI / Serial cụ thể">
            <select value={imei} onChange={(e) => setImei(e.target.value)}>
              <option value="">— {t('Không chọn IMEI')} —</option>
              {variant.imeis.map((i) => (<option key={i} value={i}>{i}</option>))}
            </select>
          </Field>
        ) : null}
        <Field label="Ví nhận tiền">
          <select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            {wallets.map((w) => (<option key={w.id} value={w.id}>{w.name} — {fmtVND(w.balance)}</option>))}
          </select>
        </Field>
        <Field label="Ghi chú">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Bán cho khách Anh Tuấn" />
        </Field>
        <div className="profit-box">
          {t('Doanh thu')}: {fmtVND(revenue)}<br />
          {t('Giá vốn')}: {fmtVND(qty * cost)}<br />
          {t('Lãi')}: <b style={{ color: '#34c759' }}>{fmtVND(profit)}</b>
        </div>
        {err ? <p className="error">{t(err)}</p> : null}
        <button type="submit" disabled={saving}>{saving ? t('Đang lưu…') : t('Xác nhận bán')}</button>
      </form>
    </Modal>
  );
}

function ImportModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const data = useAppData();
  const { t } = usePreferences();
  const { state } = data;
  const wallets = (state?.wallets ?? []).filter((w) => w.workspace_id === state?.currentWorkspaceId);
  const variants = (state?.productVariants ?? []).filter((v) => v.product_id === product.id);
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(10);
  const [cost, setCost] = useState(String(product.cost_price));
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const [imeis, setImeis] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const error = await data.importStock({
        product_id: product.id, variant_id: variantId || null, quantity: qty,
        cost_price: Number(cost) || 0, wallet_id: walletId,
        imeis: imeis.split(',').map((s) => s.trim()).filter(Boolean),
        note: `Nhập kho ${product.name} x${qty}`,
      });
      if (error) { setErr(error); return; }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`${t('Nhập kho')}: ${product.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {variants.length > 0 ? (
          <Field label="Biến thể">
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">— {t('Nhập chung cho sản phẩm')} —</option>
              {variants.map((v) => (<option key={v.id} value={v.id}>{v.name} — tồn {v.stock}</option>))}
            </select>
          </Field>
        ) : null}
        <Field label="Số lượng nhập">
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        <Field label="Giá nhập / cái (đ)">
          <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Ví chi tiền">
          <select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            {wallets.map((w) => (<option key={w.id} value={w.id}>{w.name} — {fmtVND(w.balance)}</option>))}
          </select>
        </Field>
        <Field label="IMEI nhập (cách nhau bằng dấu phẩy, nếu có)">
          <input value={imeis} onChange={(e) => setImeis(e.target.value)} placeholder="VD: 356789123456703, 356789123456704" />
        </Field>
        <p className="muted">{t('Tổng chi:')} <b style={{ color: 'var(--text)' }}>{fmtVND(qty * (Number(cost) || 0))}</b> {t('— sẽ ghi 1 giao dịch Chi “Nhập hàng” và tăng tồn kho.')}</p>
        {err ? <p className="error">{t(err)}</p> : null}
        <button type="submit" disabled={saving}>{saving ? t('Đang lưu…') : t('Xác nhận nhập kho')}</button>
      </form>
    </Modal>
  );
}

function CategoryManager({ onClose }: { onClose: () => void }) {
  const data = useAppData();
  const { t } = usePreferences();
  const { state } = data;
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0a84ff');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const cats = (state?.productCategories ?? []).filter((c) => c.workspace_id === state?.currentWorkspaceId);
  return (
    <Modal title="Danh mục loại hàng" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        setErr('');
        try {
          const error = await data.saveProductCategory({ name: name.trim(), color, icon: '📦' });
          if (error) { setErr(error); return; }
          setName('');
        } finally {
          setSaving(false);
        }
      }} className="form-grid">
        <div className="form-row">
          <Field label="Tên danh mục mới">
            <input placeholder="VD: Ốp lưng" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Màu">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </Field>
        </div>
        {err ? <p className="error">{t(err)}</p> : null}
        <button type="submit" disabled={saving}>{saving ? t('Đang lưu…') : t('Thêm danh mục')}</button>
      </form>
      <div className="row-list" style={{ marginTop: 12 }}>
        {cats.map((c) => (
          <div key={c.id} className="row-item">
            <span><span style={{ color: c.color }}>●</span> {c.icon} {c.name}</span>
            <button className="btn-ghost btn-small" onClick={() => data.deleteProductCategory(c.id)}>{t('Xóa')}</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function FieldManager({ onClose }: { onClose: () => void }) {
  const data = useAppData();
  const { t } = usePreferences();
  const { state } = data;
  const [name, setName] = useState('');
  const [type, setType] = useState<ProductField['field_type']>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const fields = (state?.productFields ?? []).filter((f) => f.workspace_id === state?.currentWorkspaceId);
  return (
    <Modal title="Trường thuộc tính tùy chỉnh" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        setErr('');
        try {
          const error = await data.saveProductField({
            name: name.trim(), field_type: type, required, enabled: true,
            options: type === 'select' ? options.split(',').map((s) => s.trim()).filter(Boolean) : null,
          });
          if (error) { setErr(error); return; }
          setName(''); setOptions('');
        } finally {
          setSaving(false);
        }
      }} className="form-grid">
        <Field label="Tên trường mới">
          <input placeholder="VD: Màu sắc, IMEI, Nhà cung cấp, Bảo hành" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Kiểu dữ liệu">
          <select value={type} onChange={(e) => setType(e.target.value as ProductField['field_type'])}>
            <option value="text">{t('Chữ')}</option><option value="number">{t('Số')}</option>
            <option value="date">{t('Ngày')}</option><option value="select">{t('Chọn 1 trong danh sách')}</option>
            <option value="boolean">{t('Có / Không')}</option>
          </select>
        </Field>
        {type === 'select' ? (
          <Field label="Các lựa chọn (cách nhau bằng dấu phẩy)">
            <input placeholder="VD: 7 ngày, 1 tháng, 6 tháng, 12 tháng" value={options} onChange={(e) => setOptions(e.target.value)} />
          </Field>
        ) : null}
        <label className="check-row">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          {t('Bắt buộc nhập khi thêm sản phẩm')}
        </label>
        {err ? <p className="error">{t(err)}</p> : null}
        <button type="submit" disabled={saving}>{saving ? t('Đang lưu…') : t('Thêm trường')}</button>
      </form>
      <div className="row-list" style={{ marginTop: 12 }}>
        {fields.map((f) => (
          <div key={f.id} className="row-item">
            <span>{f.name} <span className="badge">{t(f.field_type)}</span>{f.required ? ' *' : ''}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-ghost btn-small" onClick={() => data.saveProductField({ id: f.id, name: f.name, field_type: f.field_type, required: f.required, enabled: !f.enabled, options: f.options ?? null })}>
                {t(f.enabled ? 'Tắt' : 'Bật')}
              </button>
              <button className="btn-ghost btn-small" onClick={() => data.deleteProductField(f.id)}>{t('Xóa')}</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
