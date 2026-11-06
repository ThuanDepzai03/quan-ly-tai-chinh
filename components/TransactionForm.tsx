'use client';
import { useMemo, useState } from 'react';
import type { AppState, TxType } from '@/lib/types';
import { WALLET_TYPE_LABELS } from '@/lib/types';
import { useAppData } from '@/lib/data';
import { fmtVND, profitOf, todayISO } from '@/lib/utils';
import { fileToBase64, scanReceipt } from '@/lib/receipt';
import { Field } from './GlassCard';

export default function TransactionForm({ state, onDone }: {
  state: AppState; onDone: () => void;
}) {
  const { addTransaction } = useAppData();
  const wsId = state.currentWorkspaceId;
  const wallets = state.wallets.filter((w) => w.workspace_id === wsId);
  const categories = state.categories.filter((c) => c.workspace_id === wsId);
  const products = state.products.filter((p) => p.workspace_id === wsId);

  const [type, setType] = useState<TxType>('income');
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const [toWalletId, setToWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [isSale, setIsSale] = useState(false);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [imei, setImei] = useState('');
  const [err, setErr] = useState('');
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletId) { setErr('Vui lòng chọn ví.'); return; }
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) {
      setErr('Chuyển ví cần chọn ví đích khác ví nguồn.'); return;
    }
    if (isSale && !productId) { setErr('Vui lòng chọn sản phẩm để bán.'); return; }
    const error = addTransaction({
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
      note, date,
    });
    if (error) { setErr(error); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Loại giao dịch">
        <select value={type} onChange={(e) => { setType(e.target.value as TxType); setIsSale(false); }}>
          <option value="income">Thu</option>
          <option value="expense">Chi</option>
          <option value="transfer">Chuyển ví</option>
        </select>
      </Field>
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
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Không chọn —</option>
            {cats.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}
          </select>
        </Field>
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
        </Field>
      )}
      <Field label="Ngày">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label="Ghi chú">
        <input placeholder="VD: Bán cho khách Anh Tuấn" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {type !== 'transfer' ? (
        <div className="form-row">
          <Field label="Đánh dấu thuế (loại thuế)">
            <select value={taxType} onChange={(e) => { setTaxType(e.target.value); setTaxRate(e.target.value === 'VAT' ? '0.01' : e.target.value === 'TNCN' ? '0.005' : e.target.value === 'TNDN' ? '0.2' : ''); }}>
              <option value="">— Không đánh dấu thuế —</option>
              <option value="VAT">VAT</option>
              <option value="TNCN">TNCN</option>
              <option value="TNDN">TNDN</option>
              <option value="mon_bai">Môn bài</option>
            </select>
          </Field>
          <Field label="Thuế suất (VD: 0.01 = 1%)">
            <input type="number" step="0.001" min={0} max={1} placeholder="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} disabled={!taxType} />
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
                if (scanned.date) setDate(scanned.date);
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
        {receiptImage ? <img src={receiptImage} alt="Hóa đơn đính kèm" style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12, marginTop: 8 }} /> : null}
      </fieldset>
      {err ? <p className="error">{err}</p> : null}
      <button type="submit">Lưu giao dịch</button>
    </form>
  );
}
