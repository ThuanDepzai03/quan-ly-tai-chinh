// Tầng dữ liệu trung tâm.
// - Có Supabase + đã đăng nhập  -> đọc/ghi qua Supabase (RLS bảo vệ theo workspace).
// - Chưa có Supabase (bản demo) -> dữ liệu lưu localStorage theo từng tài khoản.
// Mọi trang đều dùng hook useAppData() nên không cần tự gọi Supabase lẻ tẻ.
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppState, AppUser, Budget, Category, Debt, Goal, Member, Product,
  ProductCategory, ProductField, ProductInput, ProductVariant, Reminder, StockMovement,
  TaxCircular, TaxPayment, Transaction, TxInput, Wallet, Workspace, WorkspaceMode,
} from './types';
import { emptyState, seedDemoState } from './demo';
import { getSessionUser, setSessionUser, syncSessionUserFromSupabase } from './auth';
import { createClient, isSupabaseConfigured } from './supabase/client';
import { uid } from './utils';

const stateKey = (userId: string) => `qltc-v2-state-${userId}`;
const TABLES = [
  'workspaces', 'members', 'wallets', 'categories', 'transactions', 'budgets',
  'goals', 'debts', 'reminders', 'products', 'product_categories',
  'product_variants', 'product_fields', 'stock_movements', 'tax_payments',
] as const;
type TableName = (typeof TABLES)[number];

const STATE_TO_TABLE: Record<string, TableName> = {
  workspaces: 'workspaces', members: 'members', wallets: 'wallets',
  categories: 'categories', transactions: 'transactions', budgets: 'budgets',
  goals: 'goals', debts: 'debts', reminders: 'reminders', products: 'products',
  productCategories: 'product_categories', productVariants: 'product_variants',
  productFields: 'product_fields', stockMovements: 'stock_movements',
  taxPayments: 'tax_payments',
};

function loadLocal(user: AppUser): AppState | null {
  try {
    const raw = localStorage.getItem(stateKey(user.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    parsed.user = user;
    return parsed;
  } catch { return null; }
}

export function ensureLocalState(user: AppUser, withDemo: boolean): AppState {
  const existing = loadLocal(user);
  if (existing) return existing;
  const fresh = withDemo ? seedDemoState(user) : emptyState(user);
  localStorage.setItem(stateKey(user.id), JSON.stringify(fresh));
  return fresh;
}

export function saveLocal(state: AppState): void {
  if (!state.user) return;
  try { localStorage.setItem(stateKey(state.user.id), JSON.stringify(state)); } catch { /* quota */ }
}

export function clearLocalState(user: AppUser): void {
  localStorage.removeItem(stateKey(user.id));
}

export interface AppData {
  state: AppState | null;
  loading: boolean;
  mode: 'local' | 'cloud';
  currentWorkspace: Workspace | null;
  switchWorkspace: (id: string) => void;
  saveWorkspace: (input: { id?: string; name: string; mode: WorkspaceMode; tax_circular: TaxCircular }) => void;
  deleteWorkspace: (id: string) => string | null;
  saveWallet: (input: { id?: string; name: string; type: Wallet['type']; balance: number }) => void;
  deleteWallet: (id: string) => void;
  saveCategory: (input: { id?: string; name: string; kind: 'income' | 'expense'; color: string; icon: string }) => void;
  deleteCategory: (id: string) => void;
  addTransaction: (input: TxInput) => string | null;
  deleteTransaction: (id: string) => void;
  saveBudget: (categoryId: string, month: string, amount: number) => void;
  saveGoal: (input: { id?: string; name: string; target: number; saved: number; deadline?: string | null }) => void;
  contributeGoal: (id: string, amount: number) => void;
  deleteGoal: (id: string) => void;
  saveDebt: (input: { id?: string; name: string; kind: Debt['kind']; amount: number; paid: number; due_date?: string | null }) => void;
  payDebt: (id: string, amount: number) => void;
  deleteDebt: (id: string) => void;
  saveReminder: (input: { id?: string; title: string; amount?: number | null; next_date: string; frequency: Reminder['frequency'] }) => void;
  completeReminder: (id: string) => void;
  deleteReminder: (id: string) => void;
  saveProduct: (input: ProductInput) => void;
  deleteProduct: (id: string) => void;
  importStock: (input: { product_id: string; variant_id?: string | null; quantity: number; cost_price: number; wallet_id: string; imeis?: string[]; note?: string }) => string | null;
  saveProductCategory: (input: { id?: string; name: string; color: string; icon: string }) => void;
  deleteProductCategory: (id: string) => void;
  saveProductField: (input: { id?: string; name: string; field_type: ProductField['field_type']; required: boolean; enabled: boolean; options?: string[] | null }) => void;
  deleteProductField: (id: string) => void;
  saveTaxPayment: (input: { id?: string; tax_type: TaxPayment['tax_type']; period: string; amount: number; paid: boolean; due_date?: string | null; note?: string | null }) => void;
  toggleTaxPaid: (id: string) => void;
  deleteTaxPayment: (id: string) => void;
  updateTaxSettings: (patch: Partial<Pick<Workspace, 'tax_circular' | 'vat_rate' | 'tncn_rate' | 'tndn_rate' | 'mon_bai'>>) => void;
  resetData: (withDemo: boolean) => void;
}

export function useAppData(): AppData {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'local' | 'cloud'>('local');
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;
  // Tăng khi Supabase báo session đổi sang user khác (SIGNED_IN) để tải
  // lại dữ liệu cho đúng user. TOKEN_REFRESHED cùng user thì không tải lại.
  const [authTick, setAuthTick] = useState(0);

  // Đồng bộ phiên Supabase -> key session duy nhất của app.
  // Sửa lỗi 06/11/2026: trước đây effect tải dữ liệu chỉ đọc localStorage
  // (getSessionUser) và thoát ngay khi trống, không bao giờ hỏi Supabase —
  // trong khi Supabase đã lưu session riêng của nó sau khi login thành công.
  useEffect(() => {
    const sb = isSupabaseConfigured() ? createClient() : null;
    if (!sb) return;
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // load lần đầu đã xử lý ở effect dưới
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          syncSessionUserFromSupabase(session.user);
          // Chỉ tải lại khi đổi sang user khác, tránh tải lại vô hạn.
          if (session.user.id !== stateRef.current?.user?.id) setAuthTick((t) => t + 1);
        }
      } else if (event === 'SIGNED_OUT') {
        setSessionUser(null);
        setState(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Hỏi Supabase session TRƯỚC — đây là nguồn đúng nhất sau khi
      //    đăng nhập. Nếu có session thì đồng bộ ngay sang key
      //    qltc-v2-session để mọi nơi (AppShell, Cài đặt...) đều thấy.
      let user: AppUser | null = null;
      let hasSupabaseSession = false;
      const sb = isSupabaseConfigured() ? createClient() : null;
      if (sb) {
        try {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.user) {
            user = syncSessionUserFromSupabase(session.user);
            hasSupabaseSession = true;
          }
        } catch { /* rơi xuống fallback local */ }
      }
      // 2. Chỉ khi không có session Supabase mới dùng phiên local/demo.
      if (!user) user = getSessionUser();
      if (!user) { if (!cancelled) setLoading(false); return; }
      if (sb && hasSupabaseSession) {
        try {
          // user ở đây chính là user đã đồng bộ từ Supabase session ở trên.
          const cloudUser: AppUser = user;
            const loaded: Partial<AppState> = { user: cloudUser };
            for (const table of TABLES) {
              const { data } = await sb.from(table).select('*');
              const key = (Object.keys(STATE_TO_TABLE).find((k) => STATE_TO_TABLE[k] === table) ?? table) as keyof AppState;
              (loaded as unknown as Record<string, unknown>)[key] = (data ?? []) as unknown;
            }
            if (!cancelled) {
              const wsList = (loaded.workspaces ?? []) as Workspace[];
              const full: AppState = {
                user: cloudUser, workspaces: wsList,
                currentWorkspaceId: wsList[0]?.id ?? null,
                members: (loaded.members ?? []) as Member[],
                wallets: (loaded.wallets ?? []) as Wallet[],
                categories: (loaded.categories ?? []) as Category[],
                transactions: (loaded.transactions ?? []) as Transaction[],
                budgets: (loaded.budgets ?? []) as Budget[],
                goals: (loaded.goals ?? []) as Goal[],
                debts: (loaded.debts ?? []) as Debt[],
                reminders: (loaded.reminders ?? []) as Reminder[],
                products: (loaded.products ?? []) as Product[],
                productCategories: (loaded.productCategories ?? []) as ProductCategory[],
                productVariants: (loaded.productVariants ?? []) as ProductVariant[],
                productFields: (loaded.productFields ?? []) as ProductField[],
                stockMovements: (loaded.stockMovements ?? []) as StockMovement[],
                taxPayments: (loaded.taxPayments ?? []) as TaxPayment[],
              };
              setMode('cloud');
              setState(full);
              setLoading(false);
              return;
            }
        } catch { /* rơi xuống bản local */ }
      }
      if (!cancelled) {
        setMode('local');
        setState(loadLocal(user) ?? seedDemoState(user));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authTick]);

  const update = useCallback((fn: (prev: AppState) => AppState, cloudOps?: Array<() => Promise<unknown>>) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      if (mode === 'local') saveLocal(next);
      return next;
    });
    if (mode === 'cloud' && cloudOps) {
      for (const op of cloudOps) op().catch((e: unknown) => console.error('Supabase sync lỗi:', e));
    }
  }, [mode]);

  const cloudUpsert = useCallback((table: TableName, row: Record<string, unknown>) => async () => {
    const sb = createClient();
    if (!sb) return;
    await sb.from(table).upsert(row as never);
  }, []);
  const cloudDelete = useCallback((table: TableName, id: string) => async () => {
    const sb = createClient();
    if (!sb) return;
    await sb.from(table).delete().eq('id', id);
  }, []);

  const currentWorkspace = state?.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;

  const api: AppData = {
    state, loading, mode, currentWorkspace,
    switchWorkspace: (id) => update((p) => ({ ...p, currentWorkspaceId: id })),
    saveWorkspace: (input) => {
      const user = stateRef.current?.user; if (!user) return;
      if (input.id) {
        const row = { ...stateRef.current?.workspaces.find((w) => w.id === input.id), ...input };
        update((p) => ({ ...p, workspaces: p.workspaces.map((w) => (w.id === input.id ? { ...w, ...input } : w)) }),
          [cloudUpsert('workspaces', row as unknown as Record<string, unknown>)]);
      } else {
        const ws: Workspace = {
          id: uid(), owner_id: user.id, name: input.name, mode: input.mode,
          tax_circular: input.tax_circular, vat_rate: 0.01, tncn_rate: 0.005,
          tndn_rate: 0.2, mon_bai: 1000000, created_at: new Date().toISOString(),
        };
        update((p) => ({ ...p, workspaces: [...p.workspaces, ws], currentWorkspaceId: ws.id }),
          [cloudUpsert('workspaces', ws as unknown as Record<string, unknown>)]);
      }
    },
    deleteWorkspace: (id) => {
      const p = stateRef.current; if (!p) return 'Chưa tải dữ liệu.';
      if (p.workspaces.length <= 1) return 'Không thể xóa không gian cuối cùng.';
      const rest = p.workspaces.filter((w) => w.id !== id);
      update((prev) => ({
        ...prev,
        workspaces: rest,
        currentWorkspaceId: prev.currentWorkspaceId === id ? rest[0].id : prev.currentWorkspaceId,
        wallets: prev.wallets.filter((w) => w.workspace_id !== id),
        transactions: prev.transactions.filter((t) => t.workspace_id !== id),
        products: prev.products.filter((x) => x.workspace_id !== id),
      }), [cloudDelete('workspaces', id)]);
      return null;
    },
    saveWallet: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      if (input.id) {
        update((prev) => ({ ...prev, wallets: prev.wallets.map((w) => (w.id === input.id ? { ...w, ...input } : w)) }),
          [cloudUpsert('wallets', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const w: Wallet = { id: uid(), workspace_id: p.currentWorkspaceId, name: input.name, type: input.type, balance: input.balance, currency: 'VND' };
        update((prev) => ({ ...prev, wallets: [...prev.wallets, w] }), [cloudUpsert('wallets', w as unknown as Record<string, unknown>)]);
      }
    },
    deleteWallet: (id) => update((p) => ({
      ...p, wallets: p.wallets.filter((w) => w.id !== id),
      transactions: p.transactions.filter((t) => t.wallet_id !== id),
    }), [cloudDelete('wallets', id)]),
    saveCategory: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      if (input.id) {
        update((prev) => ({ ...prev, categories: prev.categories.map((c) => (c.id === input.id ? { ...c, ...input } : c)) }),
          [cloudUpsert('categories', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const c: Category = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        update((prev) => ({ ...prev, categories: [...prev.categories, c] }), [cloudUpsert('categories', c as unknown as Record<string, unknown>)]);
      }
    },
    deleteCategory: (id) => update((p) => ({
      ...p, categories: p.categories.filter((c) => c.id !== id),
      transactions: p.transactions.map((t) => (t.category_id === id ? { ...t, category_id: null } : t)),
      budgets: p.budgets.filter((b) => b.category_id !== id),
    }), [cloudDelete('categories', id)]),
    addTransaction: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return 'Chưa chọn không gian.';
      const wallet = p.wallets.find((w) => w.id === input.wallet_id);
      if (!wallet) return 'Chưa chọn ví.';
      if (input.amount <= 0) return 'Số tiền phải lớn hơn 0.';
      // Bán hàng: kiểm tra tồn kho trước khi trừ.
      let profit: number | null = null;
      if (input.type === 'income' && input.product_id) {
        const product = p.products.find((x) => x.id === input.product_id);
        const variant = input.variant_id ? p.productVariants.find((v) => v.id === input.variant_id) : undefined;
        const sale = input.unit_price ?? variant?.sale_price ?? product?.sale_price ?? 0;
        const cost = input.cost_price ?? variant?.cost_price ?? product?.cost_price ?? 0;
        const qty = input.quantity ?? 1;
        const stock = variant ? variant.stock : (product?.stock ?? 0);
        if (stock < qty) return `Không đủ tồn kho (còn ${stock}, cần ${qty}).`;
        if (input.imei && variant?.imeis && !variant.imeis.includes(input.imei)) return 'IMEI này không còn trong kho.';
        profit = qty * (sale - cost);
      }
      const tx: Transaction = {
        id: uid(), workspace_id: p.currentWorkspaceId, wallet_id: input.wallet_id,
        type: input.type, amount: input.amount, category_id: input.category_id ?? null,
        product_id: input.product_id ?? null, variant_id: input.variant_id ?? null,
        imei: input.imei ?? null, quantity: input.quantity ?? 1,
        unit_price: input.unit_price ?? null, cost_price: input.cost_price ?? null,
        profit, tax_type: null, tax_rate: null, note: input.note ?? '', date: input.date,
        created_at: new Date().toISOString(),
      };
      const movements: StockMovement[] = [];
      if (tx.type === 'income' && tx.product_id) {
        movements.push({
          id: uid(), workspace_id: tx.workspace_id, product_id: tx.product_id,
          variant_id: tx.variant_id, kind: 'out', quantity: tx.quantity ?? 1,
          imei: tx.imei, note: tx.note, created_at: tx.created_at ?? new Date().toISOString(),
        });
      }
      update((prev) => {
        const wallets = prev.wallets.map((w) => {
          if (w.id === input.wallet_id) {
            const delta = input.type === 'income' ? input.amount : -input.amount;
            return { ...w, balance: w.balance + delta };
          }
          if (input.type === 'transfer' && input.to_wallet_id && w.id === input.to_wallet_id) {
            return { ...w, balance: w.balance + input.amount };
          }
          return w;
        });
        let products = prev.products;
        let variants = prev.productVariants;
        if (tx.type === 'income' && tx.product_id) {
          const q = tx.quantity ?? 1;
          products = products.map((x) => (x.id === tx.product_id ? { ...x, stock: x.stock - q } : x));
          variants = variants.map((v) => {
            if (v.id !== tx.variant_id) return v;
            return {
              ...v, stock: v.stock - q,
              imeis: tx.imei ? (v.imeis ?? []).filter((i) => i !== tx.imei) : v.imeis,
            };
          });
        }
        return {
          ...prev, wallets, products, productVariants: variants,
          transactions: [tx, ...prev.transactions], stockMovements: [...movements, ...prev.stockMovements],
        };
      }, [
        cloudUpsert('transactions', tx as unknown as Record<string, unknown>),
        ...movements.map((m) => cloudUpsert('stock_movements', m as unknown as Record<string, unknown>)),
      ]);
      return null;
    },
    deleteTransaction: (id) => {
      const p = stateRef.current; if (!p) return;
      const tx = p.transactions.find((t) => t.id === id); if (!tx) return;
      update((prev) => {
        const wallets = prev.wallets.map((w) => {
          if (w.id !== tx.wallet_id) return w;
          const delta = tx.type === 'income' ? -tx.amount : tx.amount;
          return { ...w, balance: w.balance + delta };
        });
        let products = prev.products;
        let variants = prev.productVariants;
        if (tx.type === 'income' && tx.product_id) {
          const q = tx.quantity ?? 1;
          products = products.map((x) => (x.id === tx.product_id ? { ...x, stock: x.stock + q } : x));
          variants = variants.map((v) => {
            if (v.id !== tx.variant_id) return v;
            return { ...v, stock: v.stock + q, imeis: tx.imei ? [...(v.imeis ?? []), tx.imei] : v.imeis };
          });
        }
        return {
          ...prev, wallets, products, productVariants: variants,
          transactions: prev.transactions.filter((t) => t.id !== id),
        };
      }, [cloudDelete('transactions', id)]);
    },
    saveBudget: (categoryId, month, amount) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      const existing = p.budgets.find((b) => b.category_id === categoryId && b.month === month);
      if (existing) {
        update((prev) => ({ ...prev, budgets: prev.budgets.map((b) => (b.id === existing.id ? { ...b, amount } : b)) }),
          [cloudUpsert('budgets', { ...existing, amount })]);
      } else {
        const b: Budget = { id: uid(), workspace_id: p.currentWorkspaceId, category_id: categoryId, month, amount };
        update((prev) => ({ ...prev, budgets: [...prev.budgets, b] }), [cloudUpsert('budgets', b as unknown as Record<string, unknown>)]);
      }
    },
    saveGoal: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      if (input.id) {
        update((prev) => ({ ...prev, goals: prev.goals.map((g) => (g.id === input.id ? { ...g, ...input } : g)) }),
          [cloudUpsert('goals', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const g: Goal = { id: uid(), workspace_id: p.currentWorkspaceId, name: input.name, target: input.target, saved: input.saved, deadline: input.deadline ?? null };
        update((prev) => ({ ...prev, goals: [...prev.goals, g] }), [cloudUpsert('goals', g as unknown as Record<string, unknown>)]);
      }
    },
    contributeGoal: (id, amount) => update((prev) => ({
      ...prev, goals: prev.goals.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g)),
    })),
    deleteGoal: (id) => update((p) => ({ ...p, goals: p.goals.filter((g) => g.id !== id) }), [cloudDelete('goals', id)]),
    saveDebt: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      if (input.id) {
        update((prev) => ({ ...prev, debts: prev.debts.map((d) => (d.id === input.id ? { ...d, ...input } : d)) }),
          [cloudUpsert('debts', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const d: Debt = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        update((prev) => ({ ...prev, debts: [...prev.debts, d] }), [cloudUpsert('debts', d as unknown as Record<string, unknown>)]);
      }
    },
    payDebt: (id, amount) => update((prev) => ({
      ...prev, debts: prev.debts.map((d) => (d.id === id ? { ...d, paid: Math.min(d.amount, d.paid + amount) } : d)),
    })),
    deleteDebt: (id) => update((p) => ({ ...p, debts: p.debts.filter((d) => d.id !== id) }), [cloudDelete('debts', id)]),
    saveReminder: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      if (input.id) {
        update((prev) => ({ ...prev, reminders: prev.reminders.map((r) => (r.id === input.id ? { ...r, ...input } : r)) }),
          [cloudUpsert('reminders', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const r: Reminder = { id: uid(), workspace_id: p.currentWorkspaceId, title: input.title, amount: input.amount ?? null, next_date: input.next_date, frequency: input.frequency };
        update((prev) => ({ ...prev, reminders: [...prev.reminders, r] }), [cloudUpsert('reminders', r as unknown as Record<string, unknown>)]);
      }
    },
    completeReminder: (id) => update((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) => {
        if (r.id !== id) return r;
        const d = new Date(r.next_date);
        if (r.frequency === 'daily') d.setDate(d.getDate() + 1);
        else if (r.frequency === 'weekly') d.setDate(d.getDate() + 7);
        else if (r.frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
        else if (r.frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return { ...r, next_date: d.toISOString().slice(0, 10) };
      }),
    })),
    deleteReminder: (id) => update((p) => ({ ...p, reminders: p.reminders.filter((r) => r.id !== id) }), [cloudDelete('reminders', id)]),
    saveProduct: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      const wsId = p.currentWorkspaceId;
      if (input.id) {
        const variants: ProductVariant[] = input.variants.map((v) => ({
          id: v.id ?? uid(), product_id: input.id as string, name: v.name,
          cost_price: v.cost_price, sale_price: v.sale_price, stock: v.stock, imeis: v.imeis ?? [],
        }));
        const totalStock = variants.length > 0 ? variants.reduce((s, v) => s + v.stock, 0) : input.stock;
        const product: Product = {
          id: input.id, workspace_id: wsId, category_id: input.category_id ?? null,
          name: input.name, sku: input.sku, unit: input.unit, cost_price: input.cost_price,
          sale_price: input.sale_price, stock: totalStock, min_stock: input.min_stock,
          custom_values: input.custom_values ?? {},
        };
        update((prev) => ({
          ...prev,
          products: prev.products.map((x) => (x.id === input.id ? product : x)),
          productVariants: [
            ...prev.productVariants.filter((v) => v.product_id !== input.id),
            ...variants,
          ],
        }), [
          cloudUpsert('products', product as unknown as Record<string, unknown>),
          ...variants.map((v) => cloudUpsert('product_variants', v as unknown as Record<string, unknown>)),
        ]);
      } else {
        const product: Product = {
          id: uid(), workspace_id: wsId, category_id: input.category_id ?? null,
          name: input.name, sku: input.sku, unit: input.unit, cost_price: input.cost_price,
          sale_price: input.sale_price, stock: input.stock, min_stock: input.min_stock,
          custom_values: input.custom_values ?? {},
        };
        const variants: ProductVariant[] = input.variants.map((v) => ({
          id: uid(), product_id: product.id, name: v.name,
          cost_price: v.cost_price, sale_price: v.sale_price, stock: v.stock, imeis: v.imeis ?? [],
        }));
        if (variants.length > 0) product.stock = variants.reduce((s, v) => s + v.stock, 0);
        update((prev) => ({
          ...prev, products: [...prev.products, product],
          productVariants: [...prev.productVariants, ...variants],
        }), [
          cloudUpsert('products', product as unknown as Record<string, unknown>),
          ...variants.map((v) => cloudUpsert('product_variants', v as unknown as Record<string, unknown>)),
        ]);
      }
    },
    deleteProduct: (id) => update((prev) => ({
      ...prev, products: prev.products.filter((x) => x.id !== id),
      productVariants: prev.productVariants.filter((v) => v.product_id !== id),
    }), [cloudDelete('products', id)]),
    importStock: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return 'Chưa chọn không gian.';
      const product = p.products.find((x) => x.id === input.product_id);
      const wallet = p.wallets.find((w) => w.id === input.wallet_id);
      if (!product) return 'Không tìm thấy sản phẩm.';
      if (!wallet) return 'Chưa chọn ví.';
      if (input.quantity <= 0) return 'Số lượng phải lớn hơn 0.';
      const totalCost = input.quantity * input.cost_price;
      if (wallet.balance < totalCost) return `Ví không đủ số dư (cần ${totalCost.toLocaleString('vi-VN')}đ).`;
      const tx: Transaction = {
        id: uid(), workspace_id: p.currentWorkspaceId, wallet_id: input.wallet_id,
        type: 'expense', amount: totalCost, category_id: null,
        product_id: input.product_id, variant_id: input.variant_id ?? null,
        imei: null, quantity: input.quantity, unit_price: null,
        cost_price: input.cost_price, profit: null, tax_type: null, tax_rate: null,
        note: input.note ?? `Nhập kho ${product.name} x${input.quantity}`, date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
      };
      const movement: StockMovement = {
        id: uid(), workspace_id: p.currentWorkspaceId, product_id: input.product_id,
        variant_id: input.variant_id ?? null, kind: 'in', quantity: input.quantity,
        imei: null, note: tx.note, created_at: tx.created_at ?? new Date().toISOString(),
      };
      update((prev) => ({
        ...prev,
        wallets: prev.wallets.map((w) => (w.id === input.wallet_id ? { ...w, balance: w.balance - totalCost } : w)),
        products: prev.products.map((x) => (x.id === input.product_id ? { ...x, stock: x.stock + input.quantity } : x)),
        productVariants: prev.productVariants.map((v) => {
          if (v.id !== input.variant_id) return v;
          return { ...v, stock: v.stock + input.quantity, imeis: [...(v.imeis ?? []), ...(input.imeis ?? [])] };
        }),
        transactions: [tx, ...prev.transactions],
        stockMovements: [movement, ...prev.stockMovements],
      }), [
        cloudUpsert('transactions', tx as unknown as Record<string, unknown>),
        cloudUpsert('stock_movements', movement as unknown as Record<string, unknown>),
      ]);
      return null;
    },
    saveProductCategory: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      if (input.id) {
        update((prev) => ({ ...prev, productCategories: prev.productCategories.map((c) => (c.id === input.id ? { ...c, ...input } : c)) }),
          [cloudUpsert('product_categories', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const c: ProductCategory = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        update((prev) => ({ ...prev, productCategories: [...prev.productCategories, c] }), [cloudUpsert('product_categories', c as unknown as Record<string, unknown>)]);
      }
    },
    deleteProductCategory: (id) => update((prev) => ({
      ...prev, productCategories: prev.productCategories.filter((c) => c.id !== id),
      products: prev.products.map((x) => (x.category_id === id ? { ...x, category_id: null } : x)),
    }), [cloudDelete('product_categories', id)]),
    saveProductField: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      if (input.id) {
        update((prev) => ({ ...prev, productFields: prev.productFields.map((f) => (f.id === input.id ? { ...f, ...input } : f)) }),
          [cloudUpsert('product_fields', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const f: ProductField = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        update((prev) => ({ ...prev, productFields: [...prev.productFields, f] }), [cloudUpsert('product_fields', f as unknown as Record<string, unknown>)]);
      }
    },
    deleteProductField: (id) => update((prev) => ({
      ...prev, productFields: prev.productFields.filter((f) => f.id !== id),
    }), [cloudDelete('product_fields', id)]),
    saveTaxPayment: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return;
      if (input.id) {
        update((prev) => ({ ...prev, taxPayments: prev.taxPayments.map((t) => (t.id === input.id ? { ...t, ...input } : t)) }),
          [cloudUpsert('tax_payments', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const t: TaxPayment = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        update((prev) => ({ ...prev, taxPayments: [...prev.taxPayments, t] }), [cloudUpsert('tax_payments', t as unknown as Record<string, unknown>)]);
      }
    },
    toggleTaxPaid: (id) => update((prev) => ({
      ...prev, taxPayments: prev.taxPayments.map((t) => (t.id === id ? { ...t, paid: !t.paid } : t)),
    })),
    deleteTaxPayment: (id) => update((prev) => ({ ...prev, taxPayments: prev.taxPayments.filter((t) => t.id !== id) }), [cloudDelete('tax_payments', id)]),
    updateTaxSettings: (patch) => update((prev) => ({
      ...prev,
      workspaces: prev.workspaces.map((w) => (w.id === prev.currentWorkspaceId ? { ...w, ...patch } : w)),
    })),
    resetData: (withDemo) => {
      const user = stateRef.current?.user; if (!user) return;
      const fresh = withDemo ? seedDemoState(user) : emptyState(user);
      setState(fresh);
      if (mode === 'local') saveLocal(fresh);
    },
  };
  return api;
}

// ---------------------------------------------------------------------------
// Lỗi Auth Supabase — dùng chung cho mọi trang (xem lib/supabase/client.ts).
// Vấn đề 06/11/2026: bật "Confirm email" thì mail xác thực hay vào Spam /
// không tới; tài khoản chưa confirm bị chặn đăng nhập ("Invalid login
// credentials") dù mật khẩu đúng; đăng ký lại báo "User already registered";
// đổi mật khẩu cũng không mở được tài khoản chưa confirm. Các helper dưới
// đây phân biệt đúng từng trường hợp để UI báo tiếng Việt rõ ràng + cho
// gửi lại mail xác thực, thay vì báo chung là "sai mật khẩu".
// ---------------------------------------------------------------------------
export {
  translateAuthError,
  isAlreadyRegistered,
  isEmailNotConfirmed,
  isInvalidLogin,
  resendConfirmationEmail,
  sendPasswordResetEmail,
} from './supabase/client';
