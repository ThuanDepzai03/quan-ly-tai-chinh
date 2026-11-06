// Tầng dữ liệu trung tâm.
// - Có Supabase + đã đăng nhập  -> đọc/ghi qua Supabase (RLS bảo vệ theo workspace).
// - Chưa có Supabase (bản demo) -> dữ liệu lưu localStorage theo từng tài khoản.
// Mọi trang đều dùng hook useAppData() nên không cần tự gọi Supabase lẻ tẻ.
'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  AppState, AppUser, Budget, Category, Debt, Goal, Member, Product,
  ProductCategory, ProductField, ProductInput, ProductVariant, Reminder, StockMovement,
  TaxCircular, TaxPayment, Transaction, TxInput, Wallet, Workspace, WorkspaceMode,
} from './types';
import { emptyState, seedDemoState, seedDemoInventoryData } from './demo';
import { getSessionUser, setSessionUser, syncSessionUserFromSupabase } from './auth';
import { createClient, isSupabaseConfigured } from './supabase/client';
import { uid } from './utils';

const stateKey = (userId: string) => `qltc-v2-state-${userId}`;
const TABLES = [
  'workspaces', 'members', 'wallets', 'categories', 'transactions', 'budgets',
  'goals', 'debts', 'reminders', 'products', 'product_categories',
  'product_variants', 'product_fields', 'stock_movements', 'tax_payments',
  'tax_settings',
] as const;
type TableName = (typeof TABLES)[number];

const STATE_TO_TABLE: Record<string, TableName> = {
  workspaces: 'workspaces', members: 'members', wallets: 'wallets',
  categories: 'categories', transactions: 'transactions', budgets: 'budgets',
  goals: 'goals', debts: 'debts', reminders: 'reminders', products: 'products',
  productCategories: 'product_categories', productVariants: 'product_variants',
  productFields: 'product_fields', stockMovements: 'stock_movements',
  taxPayments: 'tax_payments', taxSettings: 'tax_settings',
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


// --- Helper dùng chung cho cả hook và AuthForm (đăng ký cloud + nạp mẫu) ---
// Ghi toàn bộ 1 AppState lên Supabase (upsert từng bảng). Dùng khi đăng ký
// mới chọn "Nạp dữ liệu mẫu" ở chế độ cloud: lúc đó hook useAppData chưa
// chạy nên AuthForm gọi trực tiếp hàm này sau khi signUp thành công.
export async function seedCloudDemoData(sb: NonNullable<ReturnType<typeof createClient>>, user: AppUser): Promise<string | null> {
  const seed = seedDemoState(user);
  await upsertCloudStateRows(sb, seed);
  const { data, error } = await sb.from('workspaces').select('id').eq('id', seed.workspaces[0].id).maybeSingle();
  if (error || !data) return 'Không ghi được dữ liệu mẫu lên Supabase (kiểm tra RLS / kết nối).';
  return null;
}

async function upsertCloudStateRows(sb: NonNullable<ReturnType<typeof createClient>>, s: AppState): Promise<void> {
  // Members are written last because invited users may not exist in auth.users.
  const upsert = async (table: TableName, rows: Array<Record<string, unknown>>, ignoreError = false) => {
    if (rows.length === 0) return;
    const { error } = await sb.from(table).upsert(rows as never);
    if (error) {
      const message = `Supabase upsert ${table} lỗi: ${error.message}`;
      if (ignoreError) { console.error(message); return; }
      throw new Error(message);
    }
  };
  await upsert('workspaces', s.workspaces as unknown as Array<Record<string, unknown>>);
  await upsert('wallets', s.wallets as unknown as Array<Record<string, unknown>>);
  await upsert('categories', s.categories as unknown as Array<Record<string, unknown>>);
  await upsert('product_categories', s.productCategories as unknown as Array<Record<string, unknown>>);
  await upsert('products', s.products as unknown as Array<Record<string, unknown>>);
  await upsert('product_variants', s.productVariants as unknown as Array<Record<string, unknown>>);
  await upsert('product_fields', s.productFields as unknown as Array<Record<string, unknown>>);
  await upsert('transactions', s.transactions as unknown as Array<Record<string, unknown>>);
  await upsert('budgets', s.budgets as unknown as Array<Record<string, unknown>>);
  await upsert('goals', s.goals as unknown as Array<Record<string, unknown>>);
  await upsert('debts', s.debts as unknown as Array<Record<string, unknown>>);
  await upsert('reminders', s.reminders as unknown as Array<Record<string, unknown>>);
  await upsert('stock_movements', s.stockMovements as unknown as Array<Record<string, unknown>>);
  await upsert('tax_payments', s.taxPayments as unknown as Array<Record<string, unknown>>);
  await upsert('members', s.members.map((m) => ({ id: m.id, workspace_id: m.workspace_id, user_id: m.user_id, role: m.role })), true);
}

async function deleteCloudWorkspaceRows(sb: NonNullable<ReturnType<typeof createClient>>, wsIds: string[], productIds: string[]): Promise<void> {
  if (wsIds.length === 0) return;
  const del = async (table: TableName) => {
    const { error } = await sb.from(table).delete().in('workspace_id', wsIds);
    if (error) throw error;
  };
  await del('transactions'); await del('budgets'); await del('goals');
  await del('debts'); await del('reminders'); await del('stock_movements');
  await del('tax_payments');
  if (productIds.length > 0) {
    const { error } = await sb.from('product_variants').delete().in('product_id', productIds);
    if (error) throw error;
  }
  await del('products'); await del('product_fields'); await del('product_categories');
  await del('wallets'); await del('categories'); await del('members');
  const { error } = await sb.from('workspaces').delete().in('id', wsIds);
  if (error) throw error;
}

export interface AppData {
  state: AppState | null;
  loading: boolean;
  mode: 'local' | 'cloud';
  syncError: string;
  clearSyncError: () => void;
  currentWorkspace: Workspace | null;
  switchWorkspace: (id: string) => void;
  saveWorkspace: (input: { id?: string; name: string; mode: WorkspaceMode; tax_circular: TaxCircular; vat_rate?: number; tncn_rate?: number; tndn_rate?: number; mon_bai?: number; tncn_deduction?: number }) => Promise<string | null>;
  saveMember: (input: { id?: string; email: string; name: string; role: Member['role'] }) => Promise<string | null>;
  deleteMember: (id: string) => string | null;
  deleteWorkspace: (id: string) => string | null;
  saveWallet: (input: { id?: string; name: string; type: Wallet['type']; balance: number }) => Promise<string | null>;
  deleteWallet: (id: string) => void;
  saveCategory: (input: { id?: string; name: string; kind: 'income' | 'expense'; color: string; icon: string }) => Promise<string | null>;
  deleteCategory: (id: string) => void;
  addTransaction: (input: TxInput) => Promise<string | null>;
  deleteTransaction: (id: string) => void;
  saveBudget: (categoryId: string, month: string, amount: number) => Promise<string | null>;
  deleteBudget: (id: string) => void;
  saveGoal: (input: { id?: string; name: string; target: number; saved: number; deadline?: string | null }) => Promise<string | null>;
  contributeGoal: (id: string, amount: number) => void;
  deleteGoal: (id: string) => void;
  saveDebt: (input: { id?: string; name: string; kind: Debt['kind']; amount: number; paid: number; due_date?: string | null }) => Promise<string | null>;
  payDebt: (id: string, amount: number) => void;
  deleteDebt: (id: string) => void;
  saveReminder: (input: { id?: string; title: string; amount?: number | null; next_date: string; frequency: Reminder['frequency'] }) => Promise<string | null>;
  /** Đánh dấu nhắc đã xử lý: dời sang kỳ tiếp; nếu opts.createExpense thì
   *  ghi thêm 1 giao dịch Chi tương ứng (số tiền của nhắc, ví opts.walletId). */
  completeReminder: (id: string, opts?: { createExpense?: boolean; walletId?: string | null }) => void;
  deleteReminder: (id: string) => void;
  saveProduct: (input: ProductInput) => Promise<string | null>;
  deleteProduct: (id: string) => void;
  importStock: (input: { product_id: string; variant_id?: string | null; quantity: number; cost_price: number; wallet_id: string; imeis?: string[]; note?: string }) => Promise<string | null>;
  saveProductCategory: (input: { id?: string; name: string; color: string; icon: string }) => Promise<string | null>;
  deleteProductCategory: (id: string) => void;
  saveProductField: (input: { id?: string; name: string; field_type: ProductField['field_type']; required: boolean; enabled: boolean; options?: string[] | null }) => Promise<string | null>;
  deleteProductField: (id: string) => void;
  saveTaxPayment: (input: { id?: string; tax_type: TaxPayment['tax_type']; period: string; amount: number; paid: boolean; due_date?: string | null; note?: string | null }) => Promise<string | null>;
  toggleTaxPaid: (id: string) => void;
  deleteTaxPayment: (id: string) => void;
  updateTaxSettings: (patch: Partial<Pick<Workspace, 'tax_circular' | 'vat_rate' | 'tncn_rate' | 'tndn_rate' | 'mon_bai' | 'tncn_deduction'>>) => void;
  /** Nạp chỉ phần kho mẫu (11 sản phẩm...) vào workspace hiện tại, chỉ khi
   *  kho đang trống — tương đương seedDemoInventory của bản demo. */
  seedDemoInventory: () => Promise<string | null>;
  /** Đính kèm ảnh hóa đơn (base64) vào 1 giao dịch — attachReceipt. */
  attachReceipt: (txId: string, imageBase64: string) => void;
  /** Xóa TOÀN BỘ dữ liệu của tài khoản (mọi workspace) — dùng khi xóa tài khoản. */
  deleteAllAccountData: () => Promise<string | null>;
  resetData: (withDemo: boolean) => void;
  /** Nạp dữ liệu mẫu giống bản demo (ghi thật lên Supabase ở chế độ cloud).
   *  Trả về null khi thành công, thông báo lỗi khi thất bại. */
  loadSampleData: () => Promise<string | null>;
  /** Xóa toàn bộ dữ liệu, bắt đầu với không gian trống (ghi thật lên Supabase). */
  clearSampleData: () => Promise<string | null>;
}

const AppDataContext = createContext<AppData | null>(null);

function useAppDataState(): AppData {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'local' | 'cloud'>('local');
  const [syncError, setSyncError] = useState('');
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;
  const modeRef = useRef<'local' | 'cloud'>('local');
  modeRef.current = mode;
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
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
          const results = await Promise.all(
            TABLES.map(async (table) => {
              const { data, error } = await sb.from(table).select('*');
              return { table, data: data ?? [], error };
            }),
          );
          const failedQuery = results.find((result) => result.error);
          if (failedQuery?.error) throw new Error(`${failedQuery.table}: ${failedQuery.error.message}`);
          const loaded: Partial<AppState> = { user: cloudUser };
          for (const { table, data } of results) {
            const key = (Object.keys(STATE_TO_TABLE).find((k) => STATE_TO_TABLE[k] === table) ?? table) as keyof AppState;
            (loaded as unknown as Record<string, unknown>)[key] = data as unknown;
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
        } catch (error) {
          if (!cancelled) {
            const message = error instanceof Error ? error.message : String(error);
            setMode('cloud');
            setState(emptyState(user));
            setSyncError(
              /schema cache|column .* does not exist|could not find the .* column/i.test(message)
                ? `Cấu trúc Supabase chưa được cập nhật: ${message}. Hãy chạy lại supabase/schema.sql trong SQL Editor rồi tải lại trang.`
                : `Không tải được dữ liệu từ Supabase: ${message}`,
            );
            setLoading(false);
          }
          return;
        }
      }
      if (!cancelled) {
        setMode('local');
        setState(loadLocal(user) ?? seedDemoState(user));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authTick]);

  // Mọi thay đổi state đều đồng bộ lên Supabase ở chế độ cloud bằng
  // full-state upsert (dữ liệu hộ kinh doanh chỉ vài chục dòng nên rẻ).
  // Trước v5, mỗi hàm chỉ upsert đúng 1 bảng của nó nên số dư ví, tồn kho,
  // mục tiêu, nợ, nhắc nhở... chỉ đổi ở local, F5 là mất.
  // cloudOps vẫn được chạy (dùng cho các DELETE tường minh: upsert không
  // xóa được dòng đã gỡ khỏi state).
  const update = useCallback((fn: (prev: AppState) => AppState, cloudOps?: Array<() => Promise<unknown>>): Promise<string | null> => {
    const prev = stateRef.current;
    if (!prev) return Promise.resolve('Dữ liệu chưa sẵn sàng.');
    const next = fn(prev);
    stateRef.current = next;
    setState(next);
    if (mode === 'local') saveLocal(next);
    if (mode === 'cloud') {
      const task = syncQueueRef.current.then(async () => {
        const sb = createClient();
        if (!sb) throw new Error('Chưa cấu hình kết nối Supabase.');
        await upsertCloudStateRows(sb, next);
        if (cloudOps) await Promise.all(cloudOps.map((op) => op()));
      }).then(() => {
        setSyncError('');
        return null;
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Supabase sync lỗi:', message);
        const displayedMessage =
          /schema cache|column .* does not exist|could not find the .* column/i.test(message)
            ? `Cấu trúc Supabase chưa được cập nhật: ${message}. Hãy chạy lại supabase/schema.sql trong SQL Editor rồi tải lại trang.`
            : message;
        setSyncError(displayedMessage);
        if (stateRef.current === next) {
          stateRef.current = prev;
          setState(prev);
        }
        return displayedMessage;
      });
      syncQueueRef.current = task.then(() => undefined);
      return task;
    }
    return Promise.resolve(null);
  }, [mode]);

  const cloudUpsert = useCallback((table: TableName, row: Record<string, unknown>) => async () => {
    const sb = createClient();
    if (!sb) return;
    const { error } = await sb.from(table).upsert(row as never);
    if (error) throw new Error(`Supabase upsert ${table} lỗi: ${error.message}`);
  }, []);
  const cloudDelete = useCallback((table: TableName, id: string) => async () => {
    const sb = createClient();
    if (!sb) return;
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw new Error(`Supabase delete ${table} lỗi: ${error.message}`);
  }, []);

  const currentWorkspace = state?.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;

  // --- Dữ liệu mẫu: nạp / xóa thật, cả ở chế độ cloud (Supabase) ---
  // Trước v4, resetData() chỉ setState local nên ở chế độ cloud bấm "Nạp lại
  // dữ liệu mẫu" xong F5 là mất sạch. Hai hàm dưới đây ghi/xóa thật trên
  // Supabase: ghi dữ liệu mới TRƯỚC (workspace mới, không đụng id cũ),
  // rồi mới xóa dữ liệu cũ — để nếu ghi lỗi thì dữ liệu cũ vẫn còn nguyên.
  // Lưu ý: bảng members trên Supabase chỉ có 4 cột (id, workspace_id,
  // user_id, role) nên khi upsert phải lược bỏ email/name của bản local.
  const deleteCloudWorkspaceData = useCallback(async (sb: NonNullable<ReturnType<typeof createClient>>, wsIds: string[], productIds: string[]) => {
    await deleteCloudWorkspaceRows(sb, wsIds, productIds);
  }, []);

  const upsertCloudState = useCallback(async (sb: NonNullable<ReturnType<typeof createClient>>, s: AppState) => {
    await upsertCloudStateRows(sb, s);
  }, []);

  const loadSampleData = useCallback(async (): Promise<string | null> => {
    const user = stateRef.current?.user;
    if (!user) return 'Chưa đăng nhập.';
    const seed = seedDemoState(user);
    if (modeRef.current === 'cloud') {
      const sb = createClient();
      if (!sb) return 'Chưa cấu hình Supabase.';
      const oldWsIds = (stateRef.current?.workspaces ?? []).map((w) => w.id);
      const oldProductIds = (stateRef.current?.products ?? []).map((p) => p.id);
      try {
        await upsertCloudState(sb, seed);
        await deleteCloudWorkspaceData(sb, oldWsIds, oldProductIds);
        const { data: chk, error: chkErr } = await sb.from('workspaces').select('id').eq('id', seed.workspaces[0].id).maybeSingle();
        if (chkErr || !chk) throw new Error('workspace mẫu không ghi được (kiểm tra RLS / kết nối)');
      } catch (e) {
        console.error('Nạp dữ liệu mẫu lỗi:', e);
        return `Không ghi được dữ liệu mẫu lên Supabase: ${e instanceof Error ? e.message : String(e)}`;
      }
      setState(seed); setMode('cloud');
      return null;
    }
    setState(seed); saveLocal(seed);
    return null;
  }, [deleteCloudWorkspaceData, upsertCloudState]);

  const clearSampleData = useCallback(async (): Promise<string | null> => {
    const user = stateRef.current?.user;
    if (!user) return 'Chưa đăng nhập.';
    const fresh = emptyState(user);
    if (modeRef.current === 'cloud') {
      const sb = createClient();
      if (!sb) return 'Chưa cấu hình Supabase.';
      const oldWsIds = (stateRef.current?.workspaces ?? []).map((w) => w.id);
      const oldProductIds = (stateRef.current?.products ?? []).map((p) => p.id);
      try {
        await upsertCloudState(sb, fresh);
        await deleteCloudWorkspaceData(sb, oldWsIds, oldProductIds);
      } catch (e) {
        console.error('Xóa dữ liệu mẫu lỗi:', e);
        return `Không xóa được dữ liệu trên Supabase: ${e instanceof Error ? e.message : String(e)}`;
      }
      setState(fresh); setMode('cloud');
      return null;
    }
    setState(fresh); saveLocal(fresh);
    return null;
  }, [deleteCloudWorkspaceData, upsertCloudState]);

  const api: AppData = {
    state, loading, mode, syncError, clearSyncError: () => setSyncError(''), currentWorkspace,
    switchWorkspace: (id) => update((p) => ({ ...p, currentWorkspaceId: id })),
    saveWorkspace: async (input) => {
      const current = stateRef.current;
      const user = current?.user;
      if (!current || !user) return 'Chưa đăng nhập hoặc dữ liệu tài khoản chưa tải xong.';
      let workspace: Workspace;
      if (input.id) {
        const prevWs = current.workspaces.find((w) => w.id === input.id);
        if (!prevWs) return 'Không tìm thấy không gian cần cập nhật.';
        workspace = {
          ...prevWs,
          name: input.name, mode: input.mode, tax_circular: input.tax_circular,
          vat_rate: input.vat_rate ?? prevWs?.vat_rate ?? 0.01,
          tncn_rate: input.tncn_rate ?? prevWs?.tncn_rate ?? 0.005,
          tndn_rate: input.tndn_rate ?? prevWs?.tndn_rate ?? 0.2,
          mon_bai: input.mon_bai ?? prevWs?.mon_bai ?? 1000000,
          tncn_deduction: input.tncn_deduction ?? prevWs?.tncn_deduction ?? 11000000,
        };
      } else {
        workspace = {
          id: uid(), owner_id: user.id, name: input.name, mode: input.mode,
          tax_circular: input.tax_circular,
          vat_rate: input.vat_rate ?? 0.01, tncn_rate: input.tncn_rate ?? 0.005,
          tndn_rate: input.tndn_rate ?? 0.2, mon_bai: input.mon_bai ?? 1000000,
          tncn_deduction: input.tncn_deduction ?? 11000000,
          created_at: new Date().toISOString(),
        };
      }
      if (input.id) {
        return await update((pr) => ({
          ...pr,
          workspaces: pr.workspaces.map((w) => (w.id === input.id ? workspace : w)),
        }));
      } else {
        const member: Member = {
          id: uid(), workspace_id: workspace.id, user_id: user.id,
          role: 'owner', email: user.email, name: user.name,
        };
        return await update((pr) => ({
          ...pr,
          workspaces: [...pr.workspaces, workspace],
          members: [...pr.members, member],
          currentWorkspaceId: workspace.id,
        }));
      }
    },
    saveMember: (input) => {
      const pr = stateRef.current; if (!pr || !pr.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      const email = input.email.trim().toLowerCase();
      if (!email) return Promise.resolve('Nhập email thành viên.');
      if (input.id) {
        const existing = pr.members.find((member) => member.id === input.id);
        if (!existing) return Promise.resolve('Không tìm thấy thành viên cần cập nhật.');
        return update((prev) => ({ ...prev, members: prev.members.map((m) => (m.id === input.id ? { ...m, email, name: input.name.trim(), role: input.role } : m)) }),
          [cloudUpsert('members', { id: input.id, workspace_id: pr.currentWorkspaceId, user_id: existing.user_id, role: input.role })]);
      } else {
        if (modeRef.current === 'cloud') {
          return Promise.resolve('Chưa thể mời thành viên mới từ website: cần tạo tài khoản Supabase trước để gán user_id hợp lệ.');
        }
        if (pr.members.some((m) => m.workspace_id === pr.currentWorkspaceId && m.email?.toLowerCase() === email)) {
          return Promise.resolve('Email này đã có trong danh sách thành viên.');
        }
        const m: Member = { id: uid(), workspace_id: pr.currentWorkspaceId, user_id: uid(), role: input.role, email, name: input.name.trim() || email };
        return update((prev) => ({ ...prev, members: [...prev.members, m] }),
          [cloudUpsert('members', { id: m.id, workspace_id: m.workspace_id, user_id: m.user_id, role: m.role })]);
      }
    },
    deleteMember: (id) => {
      const pr = stateRef.current; if (!pr) return 'Chưa tải dữ liệu.';
      const m = pr.members.find((x) => x.id === id);
      if (!m) return 'Không tìm thấy thành viên.';
      if (m.role === 'owner') return 'Không thể xóa chủ sở hữu không gian.';
      update((prev) => ({ ...prev, members: prev.members.filter((x) => x.id !== id) }),
        [cloudDelete('members', id)]);
      return null;
    },
    deleteWorkspace: (id) => {
      const p = stateRef.current; if (!p) return 'Chưa tải dữ liệu.';
      if (p.workspaces.length <= 1) return 'Không thể xóa không gian cuối cùng.';
      const rest = p.workspaces.filter((w) => w.id !== id);
      const byWs = <T extends { workspace_id: string }>(rows: T[]) => rows.filter((r) => r.workspace_id !== id);
      update((prev) => ({
        ...prev,
        workspaces: rest,
        currentWorkspaceId: prev.currentWorkspaceId === id ? rest[0].id : prev.currentWorkspaceId,
        members: byWs(prev.members), wallets: byWs(prev.wallets),
        categories: byWs(prev.categories), transactions: byWs(prev.transactions),
        budgets: byWs(prev.budgets), goals: byWs(prev.goals), debts: byWs(prev.debts),
        reminders: byWs(prev.reminders), products: byWs(prev.products),
        productCategories: byWs(prev.productCategories),
        productFields: byWs(prev.productFields),
        stockMovements: byWs(prev.stockMovements), taxPayments: byWs(prev.taxPayments),
        productVariants: prev.productVariants.filter((v) => !prev.products.some((x) => x.id === v.product_id && x.workspace_id === id)),
      }), [cloudDelete('workspaces', id)]);
      return null;
    },
    saveWallet: async (input) => {
      const p = stateRef.current;
      if (!p?.currentWorkspaceId) return 'Bạn cần tạo hoặc chọn không gian làm việc trước khi thêm ví.';
      let wallet: Wallet;
      if (input.id) {
        const existing = p.wallets.find((w) => w.id === input.id);
        if (!existing) return 'Không tìm thấy ví cần cập nhật.';
        wallet = { ...existing, ...input };
      } else {
        wallet = {
          id: uid(), workspace_id: p.currentWorkspaceId, name: input.name,
          type: input.type, balance: input.balance, currency: 'VND',
        };
      }
      return await update((prev) => ({
        ...prev,
        wallets: input.id
          ? prev.wallets.map((w) => (w.id === input.id ? wallet : w))
          : [...prev.wallets, wallet],
      }));
    },
    deleteWallet: (id) => {
      const txIds = (stateRef.current?.transactions ?? []).filter((t) => t.wallet_id === id).map((t) => t.id);
      update((p) => ({
        ...p, wallets: p.wallets.filter((w) => w.id !== id),
        transactions: p.transactions.filter((t) => t.wallet_id !== id),
      }), [cloudDelete('wallets', id), ...txIds.map((tid) => cloudDelete('transactions', tid))]);
    },
    saveCategory: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      if (input.id) {
        return update((prev) => ({ ...prev, categories: prev.categories.map((c) => (c.id === input.id ? { ...c, ...input } : c)) }),
          [cloudUpsert('categories', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const c: Category = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        return update((prev) => ({ ...prev, categories: [...prev.categories, c] }), [cloudUpsert('categories', c as unknown as Record<string, unknown>)]);
      }
    },
    deleteCategory: (id) => {
      const budgetIds = (stateRef.current?.budgets ?? []).filter((b) => b.category_id === id).map((b) => b.id);
      update((p) => ({
        ...p, categories: p.categories.filter((c) => c.id !== id),
        transactions: p.transactions.map((t) => (t.category_id === id ? { ...t, category_id: null } : t)),
        budgets: p.budgets.filter((b) => b.category_id !== id),
      }), [cloudDelete('categories', id), ...budgetIds.map((bid) => cloudDelete('budgets', bid))]);
    },
    addTransaction: async (input) => {
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
        to_wallet_id: input.to_wallet_id ?? null,
        type: input.type, amount: input.amount, category_id: input.category_id ?? null,
        product_id: input.product_id ?? null, variant_id: input.variant_id ?? null,
        imei: input.imei ?? null, quantity: input.quantity ?? 1,
        unit_price: input.unit_price ?? null, cost_price: input.cost_price ?? null,
        profit, tax_type: input.tax_type ?? null, tax_rate: input.tax_rate ?? null, receipt_image: input.receipt_image ?? null, note: input.note ?? '', date: input.date,
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
      return await update((prev) => {
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
          if (w.id === tx.wallet_id) {
            // Thu: đã cộng tiền -> trừ lại; Chi/Chuyển (ví nguồn): đã trừ -> cộng lại.
            const delta = tx.type === 'income' ? -tx.amount : tx.amount;
            return { ...w, balance: w.balance + delta };
          }
          // Chuyển ví: hoàn lại ví đích số tiền đã nhận.
          if (tx.type === 'transfer' && tx.to_wallet_id && w.id === tx.to_wallet_id) {
            return { ...w, balance: w.balance - tx.amount };
          }
          return w;
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
    deleteBudget: (id) => update((p) => ({ ...p, budgets: p.budgets.filter((b) => b.id !== id) }), [cloudDelete('budgets', id)]),
    saveBudget: (categoryId, month, amount) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      const existing = p.budgets.find((b) => b.category_id === categoryId && b.month === month);
      if (existing) {
        return update((prev) => ({ ...prev, budgets: prev.budgets.map((b) => (b.id === existing.id ? { ...b, amount } : b)) }),
          [cloudUpsert('budgets', { ...existing, amount })]);
      } else {
        const b: Budget = { id: uid(), workspace_id: p.currentWorkspaceId, category_id: categoryId, month, amount };
        return update((prev) => ({ ...prev, budgets: [...prev.budgets, b] }), [cloudUpsert('budgets', b as unknown as Record<string, unknown>)]);
      }
    },
    saveGoal: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      if (input.id) {
        return update((prev) => ({ ...prev, goals: prev.goals.map((g) => (g.id === input.id ? { ...g, ...input } : g)) }),
          [cloudUpsert('goals', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const g: Goal = { id: uid(), workspace_id: p.currentWorkspaceId, name: input.name, target: input.target, saved: input.saved, deadline: input.deadline ?? null };
        return update((prev) => ({ ...prev, goals: [...prev.goals, g] }), [cloudUpsert('goals', g as unknown as Record<string, unknown>)]);
      }
    },
    contributeGoal: (id, amount) => update((prev) => ({
      ...prev, goals: prev.goals.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g)),
    })),
    deleteGoal: (id) => update((p) => ({ ...p, goals: p.goals.filter((g) => g.id !== id) }), [cloudDelete('goals', id)]),
    saveDebt: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      if (input.id) {
        return update((prev) => ({ ...prev, debts: prev.debts.map((d) => (d.id === input.id ? { ...d, ...input } : d)) }),
          [cloudUpsert('debts', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const d: Debt = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        return update((prev) => ({ ...prev, debts: [...prev.debts, d] }), [cloudUpsert('debts', d as unknown as Record<string, unknown>)]);
      }
    },
    payDebt: (id, amount) => update((prev) => ({
      ...prev, debts: prev.debts.map((d) => (d.id === id ? { ...d, paid: Math.min(d.amount, d.paid + amount) } : d)),
    })),
    deleteDebt: (id) => update((p) => ({ ...p, debts: p.debts.filter((d) => d.id !== id) }), [cloudDelete('debts', id)]),
    saveReminder: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      if (input.id) {
        return update((prev) => ({ ...prev, reminders: prev.reminders.map((r) => (r.id === input.id ? { ...r, ...input } : r)) }),
          [cloudUpsert('reminders', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const r: Reminder = { id: uid(), workspace_id: p.currentWorkspaceId, title: input.title, amount: input.amount ?? null, next_date: input.next_date, frequency: input.frequency };
        return update((prev) => ({ ...prev, reminders: [...prev.reminders, r] }), [cloudUpsert('reminders', r as unknown as Record<string, unknown>)]);
      }
    },
    completeReminder: (id, opts) => {
      const pr = stateRef.current; if (!pr) return;
      const r = pr.reminders.find((x) => x.id === id); if (!r) return;
      const d = new Date(r.next_date);
      if (r.frequency === 'daily') d.setDate(d.getDate() + 1);
      else if (r.frequency === 'weekly') d.setDate(d.getDate() + 7);
      else if (r.frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
      else if (r.frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
      else d.setMonth(d.getMonth() + 1);
      const nextDate = d.toISOString().slice(0, 10);
      let tx: Transaction | null = null;
      if (opts?.createExpense && r.amount && r.amount > 0) {
        const walletId = opts.walletId ?? pr.wallets.find((w) => w.workspace_id === r.workspace_id)?.id ?? null;
        if (walletId) {
          tx = {
            id: uid(), workspace_id: r.workspace_id, wallet_id: walletId,
            type: 'expense', amount: r.amount, category_id: null,
            product_id: null, variant_id: null, imei: null, quantity: 1,
            unit_price: null, cost_price: null, profit: null,
            tax_type: null, tax_rate: null, receipt_image: null,
            note: `Nhắc nhở: ${r.title}`, date: r.next_date,
            created_at: new Date().toISOString(),
          };
        }
      }
      update((prev) => ({
        ...prev,
        reminders: prev.reminders.map((x) => (x.id === id ? { ...x, next_date: nextDate } : x)),
        wallets: tx ? prev.wallets.map((w) => (w.id === tx!.wallet_id ? { ...w, balance: w.balance - tx!.amount } : w)) : prev.wallets,
        transactions: tx ? [tx, ...prev.transactions] : prev.transactions,
      }), tx ? [cloudUpsert('transactions', tx as unknown as Record<string, unknown>)] : []);
    },
    deleteReminder: (id) => update((p) => ({ ...p, reminders: p.reminders.filter((r) => r.id !== id) }), [cloudDelete('reminders', id)]),
    saveProduct: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
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
          custom_values: input.custom_values ?? {}, image: input.image ?? null,
        };
        const removedVariantIds = (stateRef.current?.productVariants ?? [])
          .filter((v) => v.product_id === input.id && !variants.some((nv) => nv.id === v.id))
          .map((v) => v.id);
        return update((prev) => ({
          ...prev,
          products: prev.products.map((x) => (x.id === input.id ? product : x)),
          productVariants: [
            ...prev.productVariants.filter((v) => v.product_id !== input.id),
            ...variants,
          ],
        }), [
          cloudUpsert('products', product as unknown as Record<string, unknown>),
          ...variants.map((v) => cloudUpsert('product_variants', v as unknown as Record<string, unknown>)),
          ...removedVariantIds.map((vid) => cloudDelete('product_variants', vid)),
        ]);
      } else {
        const product: Product = {
          id: uid(), workspace_id: wsId, category_id: input.category_id ?? null,
          name: input.name, sku: input.sku, unit: input.unit, cost_price: input.cost_price,
          sale_price: input.sale_price, stock: input.stock, min_stock: input.min_stock,
          custom_values: input.custom_values ?? {}, image: input.image ?? null,
        };
        const variants: ProductVariant[] = input.variants.map((v) => ({
          id: uid(), product_id: product.id, name: v.name,
          cost_price: v.cost_price, sale_price: v.sale_price, stock: v.stock, imeis: v.imeis ?? [],
        }));
        if (variants.length > 0) product.stock = variants.reduce((s, v) => s + v.stock, 0);
        return update((prev) => ({
          ...prev, products: [...prev.products, product],
          productVariants: [...prev.productVariants, ...variants],
        }), [
          cloudUpsert('products', product as unknown as Record<string, unknown>),
          ...variants.map((v) => cloudUpsert('product_variants', v as unknown as Record<string, unknown>)),
        ]);
      }
    },
    // Xóa sản phẩm: lịch sử nhập/xuất kho xóa theo, nhưng giao dịch bán/
    // nhập cũ GIỮ nguyên số lượng + giá vốn để báo cáo lãi không đổi.
    deleteProduct: (id) => {
      const variantIds = (stateRef.current?.productVariants ?? []).filter((v) => v.product_id === id).map((v) => v.id);
      const movementIds = (stateRef.current?.stockMovements ?? []).filter((m) => m.product_id === id).map((m) => m.id);
      update((prev) => ({
        ...prev, products: prev.products.filter((x) => x.id !== id),
        productVariants: prev.productVariants.filter((v) => v.product_id !== id),
        stockMovements: prev.stockMovements.filter((m) => m.product_id !== id),
      }), [
        cloudDelete('products', id),
        ...variantIds.map((vid) => cloudDelete('product_variants', vid)),
        ...movementIds.map((mid) => cloudDelete('stock_movements', mid)),
      ]);
    },
    importStock: async (input) => {
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
      return await update((prev) => ({
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
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      if (input.id) {
        return update((prev) => ({ ...prev, productCategories: prev.productCategories.map((c) => (c.id === input.id ? { ...c, ...input } : c)) }),
          [cloudUpsert('product_categories', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const c: ProductCategory = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        return update((prev) => ({ ...prev, productCategories: [...prev.productCategories, c] }), [cloudUpsert('product_categories', c as unknown as Record<string, unknown>)]);
      }
    },
    deleteProductCategory: (id) => update((prev) => ({
      ...prev, productCategories: prev.productCategories.filter((c) => c.id !== id),
      products: prev.products.map((x) => (x.category_id === id ? { ...x, category_id: null } : x)),
    }), [cloudDelete('product_categories', id)]),
    saveProductField: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      if (input.id) {
        return update((prev) => ({ ...prev, productFields: prev.productFields.map((f) => (f.id === input.id ? { ...f, ...input } : f)) }),
          [cloudUpsert('product_fields', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const f: ProductField = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        return update((prev) => ({ ...prev, productFields: [...prev.productFields, f] }), [cloudUpsert('product_fields', f as unknown as Record<string, unknown>)]);
      }
    },
    deleteProductField: (id) => update((prev) => ({
      ...prev, productFields: prev.productFields.filter((f) => f.id !== id),
    }), [cloudDelete('product_fields', id)]),
    saveTaxPayment: (input) => {
      const p = stateRef.current; if (!p || !p.currentWorkspaceId) return Promise.resolve('Bạn cần tạo hoặc chọn không gian làm việc trước.');
      if (input.id) {
        return update((prev) => ({ ...prev, taxPayments: prev.taxPayments.map((t) => (t.id === input.id ? { ...t, ...input } : t)) }),
          [cloudUpsert('tax_payments', { ...input, workspace_id: p.currentWorkspaceId })]);
      } else {
        const t: TaxPayment = { id: uid(), workspace_id: p.currentWorkspaceId, ...input };
        return update((prev) => ({ ...prev, taxPayments: [...prev.taxPayments, t] }), [cloudUpsert('tax_payments', t as unknown as Record<string, unknown>)]);
      }
    },
    toggleTaxPaid: (id) => update((prev) => ({
      ...prev, taxPayments: prev.taxPayments.map((t) => (t.id === id ? { ...t, paid: !t.paid } : t)),
    })),
    deleteTaxPayment: (id) => update((prev) => ({ ...prev, taxPayments: prev.taxPayments.filter((t) => t.id !== id) }), [cloudDelete('tax_payments', id)]),
    // Trước v5 hàm này chỉ đổi state local — đổi thông tư trên web sẽ mất
    // sau F5 ở chế độ cloud. Giờ ghi thật lên bảng workspaces + tax_settings.
    updateTaxSettings: (patch) => {
      const ws = stateRef.current?.workspaces.find((w) => w.id === stateRef.current?.currentWorkspaceId);
      if (!ws) return;
      const merged: Workspace = { ...ws, ...patch };
      update((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((w) => (w.id === prev.currentWorkspaceId ? merged : w)),
      }), [
        cloudUpsert('workspaces', merged as unknown as Record<string, unknown>),
        cloudUpsert('tax_settings', {
          id: merged.id, workspace_id: merged.id, circular: merged.tax_circular,
          vat_rate: merged.vat_rate, tncn_rate: merged.tncn_rate,
          tndn_rate: merged.tndn_rate, mon_bai: merged.mon_bai,
        }),
      ]);
    },
    seedDemoInventory: async (): Promise<string | null> => {
      const pr = stateRef.current; if (!pr || !pr.currentWorkspaceId) return 'Chưa chọn không gian.';
      if (pr.products.some((x) => x.workspace_id === pr.currentWorkspaceId)) {
        return 'Kho đã có sản phẩm rồi — chỉ nạp kho mẫu khi kho đang trống.';
      }
      const user = pr.user; if (!user) return 'Chưa đăng nhập.';
      const inv = seedDemoInventoryData(user, pr.currentWorkspaceId);
      const invState: AppState = {
        ...pr, productCategories: inv.productCategories, products: inv.products,
        productVariants: inv.productVariants, productFields: inv.productFields,
        stockMovements: inv.stockMovements,
      };
      if (modeRef.current === 'cloud') {
        const sb = createClient();
        if (!sb) return 'Chưa cấu hình Supabase.';
        try { await upsertCloudStateRows(sb, invState); } catch (e) {
          return `Không ghi được kho mẫu lên Supabase: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      setState(invState);
      if (modeRef.current === 'local') saveLocal(invState);
      return null;
    },
    attachReceipt: (txId, imageBase64) => {
      const tx = stateRef.current?.transactions.find((t) => t.id === txId);
      if (!tx) return;
      update((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === txId ? { ...t, receipt_image: imageBase64 } : t)),
      }), [cloudUpsert('transactions', { ...tx, receipt_image: imageBase64 } as unknown as Record<string, unknown>)]);
    },
    deleteAllAccountData: async (): Promise<string | null> => {
      const pr = stateRef.current; if (!pr || !pr.user) return 'Chưa đăng nhập.';
      const wsIds = pr.workspaces.map((w) => w.id);
      const productIds = pr.products.map((x) => x.id);
      if (modeRef.current === 'cloud') {
        const sb = createClient();
        if (!sb) return 'Chưa cấu hình Supabase.';
        try { await deleteCloudWorkspaceRows(sb, wsIds, productIds); } catch (e) {
          return `Không xóa được dữ liệu trên Supabase: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      clearLocalState(pr.user);
      setState(null);
      return null;
    },
    resetData: (withDemo) => {
      // Giữ tương thích với các nút cũ: bản async mới ở load/clearSampleData.
      void (withDemo ? loadSampleData() : clearSampleData());
    },
    loadSampleData,
    clearSampleData,
  };
  return api;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const data = useAppDataState();
  return createElement(AppDataContext.Provider, { value: data }, children);
}

export function useAppData(): AppData {
  const data = useContext(AppDataContext);
  if (!data) throw new Error('useAppData must be used inside AppDataProvider.');
  return data;
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
