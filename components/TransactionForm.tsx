'use client';
import { useMemo, useState } from 'react';
import type { AppState, TxType } from '@/lib/types';
import { WALLET_TYPE_LABELS } from '@/lib/types';
import { useAppData } from '@/lib/data';
import { fmtVND, profitOf, todayISO } from '@/lib/utils';
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
      {err ? <p className="error">{err}</p> : null}
      <button type="submit">Lưu giao dịch</button>
    </form>
  );
}
