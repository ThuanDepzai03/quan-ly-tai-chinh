'use client';
import { useMemo, useState } from 'react';
import type { AppState, TxType } from '@/lib/types';
import { WALLET_TYPE_LABELS } from '@/lib/types';
import { useAppData } from '@/lib/data';
import { fmtVND, localDateTimeInput, profitOf, uid } from '@/lib/utils';
import { fileToBase64, scanReceipt } from '@/lib/receipt';
import { Field } from './GlassCard';

export default function TransactionForm({ state, onDone, initialType = 'income' }: {
  state: AppState; onDone: () => void; initialType?: TxType;
}) {
  const { addTransaction, saveCategory } = useAppData();
  const wsId = state.currentWorkspaceId;
  const wallets = state.wallets.filter((w) => w.workspace_id === wsId);
  const categories = state.categories.filter((c) => c.workspace_id === wsId);
  const products = state.products.filter((p) => p.workspace_id === wsId);

  const [type, setType] = useState<TxType>(initialType);
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const [toWalletId, setToWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateTimeInput());
  const [note, setNote] = useState('');
  const [isSale, setIsSale] = useState(false);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [imei, setImei] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [taxType, setTaxType] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState('');

  const product = products.find((p) => p.id === productId);
  const variants = state.productVariants.filter((v) => v.product_id === productId);
  const variant = variants.find((v) => v.id === variantId);
  const salePrice = variant?.sale_price ?? product?.sale_price ?? 0;
  const costPrice = variant?.cost_price ?? product?.cost_price ?? 0;
  const computedAmount = isSale ? qty * salePrice : Number(amount) || 0;
  const computedProfit = isSale ? profitOf(qty, salePrice, costPrice) : null;
  const availableImeis = useMemo(() => variant?.imeis ?? [], [variant]);
  const cats = categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense'));

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) { setErr('Vui lòng nhập tên danh mục.'); return; }
    const kind = type === 'income' ? 'income' : 'expense';
    const id = uid();
    setSavingCategory(true);
    setErr('');
    try {
      const error = await saveCategory({
        id, name, kind, color: '#0a84ff', icon: kind === 'income' ? '💰' : '💸',
      });
      if (error) { setErr(error); return; }
      setCategoryId(id);
      setNewCategoryName('');
      setShowCategoryForm(false);
    } catch (error) {
      setErr(`Không thể thêm danh mục: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSavingCategory(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletId) { setErr('Vui lòng chọn ví.'); return; }
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) {
      setErr('Chuyển ví cần chọn ví đích khác ví nguồn.'); return;
    }
    if (isSale && !productId) { setErr('Vui lòng chọn sản phẩm để bán.'); return; }
    setSaving(true);
    setErr('');
    try {
      const error = await addTransaction({
        type, amount: computedAmount, wallet_id: walletId,
        to_wallet_id: type === 'transfer' ? toWalletId : null,
        category_id: categoryId || null,
        product_id: isSale ? productId : null,
        variant_id: isSale && variantId ? variantId : null,
        imei: isSale && imei ? imei : null,
        quantity: isSale ? qty : 1,
        unit_price: isSale ? salePrice : null,
        cost_price: isSale ? costPrice : null,
        tax_type: type === 'transfer' ? null : (taxType || null),
        tax_rate: type === 'transfer' ? null : (taxRate ? Number(taxRate) : null),
        receipt_image: receiptImage,
        note, date: date.slice(0, 10), occurred_at: new Date(date).toISOString(),
      });
      if (error) { setErr(error); return; }
      onDone();
    } catch (error) {
      setErr(`Không lưu được giao dịch: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <div className="transaction-type-switch" role="group" aria-label="Loại giao dịch">
        {([
          ['expense', 'Chi tiền'],
          ['income', 'Thu tiền'],
          ['transfer', 'Chuyển ví'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={type === value ? 'transaction-type-active' : ''}
            aria-pressed={type === value}
            onClick={() => { setType(value); if (value !== 'income') setIsSale(false); }}
          >{label}</button>
        ))}
      </div>
      <Field label={type === 'transfer' ? 'Ví nguồn' : 'Ví'}>
        <select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>{w.name} ({WALLET_TYPE_LABELS[w.type]}) — {fmtVND(w.balance)}</option>
          ))}
        </select>
      </Field>
      {type === 'transfer' ? (
        <Field label="Ví đích">
          <select value={toWalletId} onChange={(e) => setToWalletId(e.target.value)}>
            <option value="">— Chọn ví đích —</option>
            {wallets.filter((w) => w.id !== walletId).map((w) => (
              <option key={w.id} value={w.id}>{w.name} — {fmtVND(w.balance)}</option>
            ))}
          </select>
        </Field>
      ) : null}
      {type !== 'transfer' ? (
        <Field label="Danh mục">
          <div className="category-select-row">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Không chọn —</option>
              {cats.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}
            </select>
            <button type="button" className="btn-ghost category-add-button" aria-label="Thêm danh mục" title="Thêm danh mục" onClick={() => { setErr(''); setShowCategoryForm((shown) => !shown); }}>+</button>
          </div>
        </Field>
      ) : null}
      {showCategoryForm && type !== 'transfer' ? (
        <div className="category-create-panel">
          <Field label={`Tên danh mục ${type === 'income' ? 'thu' : 'chi'}`}>
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nhập tên danh mục"
              maxLength={60}
            />
          </Field>
          <div className="category-create-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowCategoryForm(false); setNewCategoryName(''); }}>Hủy</button>
            <button type="button" disabled={savingCategory} onClick={() => { void createCategory(); }}>
              {savingCategory ? 'Đang thêm…' : 'Thêm danh mục'}
            </button>
          </div>
        </div>
      ) : null}
      {type === 'income' ? (
        <label className="check-row">
          <input type="checkbox" checked={isSale} onChange={(e) => setIsSale(e.target.checked)} />
          Bán hàng từ kho (tự trừ tồn, tự tính lãi)
        </label>
      ) : null}
      {isSale ? (
        <>
          <Field label="Sản phẩm">
            <select value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(''); setImei(''); }}>
              <option value="">— Chọn sản phẩm —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — tồn {p.stock} • {fmtVND(p.sale_price)}</option>
              ))}
            </select>
          </Field>
          {variants.length > 0 ? (
            <Field label="Biến thể (màu / size / dung lượng)">
              <select value={variantId} onChange={(e) => { setVariantId(e.target.value); setImei(''); }}>
                <option value="">— Dùng giá chung của sản phẩm —</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} — tồn {v.stock} • {fmtVND(v.sale_price)}</option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Số lượng">
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          {availableImeis.length > 0 ? (
            <Field label="IMEI / Serial cụ thể">
              <select value={imei} onChange={(e) => setImei(e.target.value)}>
                <option value="">— Không chọn IMEI —</option>
                {availableImeis.map((i) => (<option key={i} value={i}>{i}</option>))}
              </select>
            </Field>
          ) : null}
          <div className="profit-box">
            Giá bán: {fmtVND(salePrice)} × {qty} = <b>{fmtVND(computedAmount)}</b><br />
            Giá vốn: {fmtVND(costPrice)} × {qty} = {fmtVND(qty * costPrice)}<br />
            Lãi dự kiến: <b style={{ color: '#34c759' }}>{fmtVND(computedProfit ?? 0)}</b>
          </div>
        </>
      ) : (
        <Field label="Số tiền (đ)">
          <input type="number" min={0} placeholder="VD: 500000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <div className="amount-shortcuts" aria-label="Gợi ý số tiền">
            {[50000, 100000, 200000, 500000, 1000000, 5000000].map((value) => (
              <button key={value} type="button" className="amount-shortcut" onClick={() => {
                setAmount((current) => String((Number(current) || 0) + value));
              }}>+{value >= 1000000 ? `${value / 1000000},0 tr` : `${value / 1000}k`}</button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Ngày giờ giao dịch">
        <input type="datetime-local" step={1} value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label="Ghi chú">
        <input placeholder="VD: Bán cho khách Anh Tuấn" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {type !== 'transfer' ? (
        <div className="form-row">
          <Field label="Đánh dấu thuế (loại thuế)">
            <select value={taxType} onChange={(e) => { setTaxType(e.target.value); setTaxRate(''); }}>
              <option value="">— Không đánh dấu thuế —</option>
              <option value="VAT">VAT</option>
              <option value="TNCN">TNCN</option>
              <option value="TNDN">TNDN</option>
              <option value="other">Thuế khác</option>
            </select>
          </Field>
          <Field label="Thuế suất tham chiếu (nhập theo hồ sơ, nếu cần)">
            <input type="number" step="0.001" min={0} max={1} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} disabled={!taxType} />
          </Field>
        </div>
      ) : null}
      <fieldset className="fieldset">
        <legend>Hóa đơn (đính kèm / quét)</legend>
        <div className="flex-row">
          <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            📎 Đính kèm ảnh hóa đơn
            <input type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { setReceiptImage(await fileToBase64(f)); setScanMsg(`Đã đính kèm ${f.name}.`); }
              catch (err) { setErr(err instanceof Error ? err.message : 'Không đọc được ảnh.'); }
            }} />
          </label>
          <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            🧾 Quét hóa đơn bằng AI
            <input type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try {
                const scanned = await scanReceipt(f);
                setReceiptImage(scanned.image);
                if (scanned.amount) setAmount(String(scanned.amount));
                if (scanned.date) setDate(scanned.date.length > 10 ? scanned.date.slice(0, 16) : `${scanned.date}T00:00`);
                if (scanned.note) setNote(scanned.note);
                setScanMsg(scanned.amount
                  ? `Đã quét: số tiền ${fmtVND(scanned.amount)} — kiểm tra lại rồi bấm Lưu giao dịch.`
                  : 'Đã quét ảnh. Số tiền không trích xuất được tự động — nhập số tiền rồi bấm Lưu.');
              } catch (err) { setErr(err instanceof Error ? err.message : 'Không quét được hóa đơn.'); }
            }} />
          </label>
          {receiptImage ? (
            <button type="button" className="btn-ghost" onClick={() => { setReceiptImage(null); setScanMsg(''); }}>Gỡ ảnh</button>
          ) : null}
        </div>
        {scanMsg ? <p className="muted" style={{ fontSize: 13 }}>{scanMsg}</p> : null}
        {receiptImage ? <img src={receiptImage} alt="Hóa đơn đính kèm" decoding="async" style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12, marginTop: 8 }} /> : null}
      </fieldset>
      {err ? <p className="error">{err}</p> : null}
      <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu giao dịch'}</button>
    </form>
  );
}
