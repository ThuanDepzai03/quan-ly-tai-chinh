'use client';
import { useState } from 'react';
import type { Wallet, WalletType } from '@/lib/types';
import { WALLET_TYPE_LABELS } from '@/lib/types';
import { useAppData } from '@/lib/data';
import { Field } from './GlassCard';
import { usePreferences } from '@/lib/preferences';

const TYPES = Object.keys(WALLET_TYPE_LABELS) as WalletType[];

export default function WalletForm({ editing, onDone }: {
  editing?: Wallet | null; onDone: () => void;
}) {
  const { saveWallet } = useAppData();
  const { t } = usePreferences();
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<WalletType>(editing?.type ?? 'cash');
  const [balance, setBalance] = useState(String(editing?.balance ?? 0));
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Vui lòng nhập tên ví.'); return; }
    const bal = Number(balance);
    if (Number.isNaN(bal)) { setErr('Số dư phải là số.'); return; }
    setErr('');
    try {
      const error = await saveWallet({ id: editing?.id, name: name.trim(), type, balance: bal });
      if (error) { setErr(error); return; }
      onDone();
    } catch (error) {
      setErr(`Không lưu được ví: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Tên ví">
        <input placeholder={t('VD: Vietcombank, Tiền mặt, MoMo')} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Loại ví">
        <select value={type} onChange={(e) => setType(e.target.value as WalletType)}>
          {TYPES.map((walletType) => (<option key={walletType} value={walletType}>{t(WALLET_TYPE_LABELS[walletType])}</option>))}
        </select>
      </Field>
      <Field label="Số dư ban đầu (đ)">
        <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
      </Field>
      {err ? <p className="error">{t(err)}</p> : null}
      <button type="submit">{editing ? t('Lưu thay đổi') : t('Thêm ví')}</button>
    </form>
  );
}
