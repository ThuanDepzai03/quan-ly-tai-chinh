// Kiểu dữ liệu dùng chung cho app Quản lý tài chính.
// Khớp 1-1 với supabase/schema.sql (16 bảng). Chỉ chứa type/interface,
// không chứa hàm tính toán (xem lib/utils.ts).
export type WorkspaceMode = 'personal' | 'household' | 'team';
export type TaxCircular = 'TT88/2021' | 'TT133/2016' | 'TT200/2014' | 'TNCN';
export type TaxCalculationMethod = 'turnover_tncn' | 'profit_tndn' | 'progressive_tncn';
export type WalletType = 'cash' | 'bank' | 'e-wallet' | 'credit' | 'savings' | 'other';
export type TxType = 'income' | 'expense' | 'transfer';
export type DebtKind = 'borrow' | 'lend';
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';
export type TaxKind = 'VAT' | 'TNCN' | 'TNDN' | 'mon_bai';
export const TAX_CALCULATION_METHOD_LABELS: Record<TaxCalculationMethod, string> = {
  turnover_tncn: 'TNCN theo tỷ lệ doanh thu',
  profit_tndn: 'TNDN theo lãi ghi nhận',
  progressive_tncn: 'TNCN lũy tiến (ước tính)',
};

export interface Workspace {
  id: string; owner_id: string; name: string; mode: WorkspaceMode;
  tax_circular: TaxCircular; tax_method?: TaxCalculationMethod; vat_rate: number; tncn_rate: number;
  tndn_rate: number; mon_bai: number; tncn_deduction?: number; created_at: string;
}
export interface Member {
  id: string; workspace_id: string; user_id: string; role: MemberRole;
  email?: string; name?: string;
}
export interface Wallet {
  id: string; workspace_id: string; name: string; type: WalletType;
  balance: number; currency: string; created_at?: string;
}
export interface Category {
  id: string; workspace_id: string; name: string;
  kind: 'income' | 'expense'; color: string; icon: string;
}
export interface Transaction {
  id: string; workspace_id: string; wallet_id: string; to_wallet_id?: string | null; type: TxType;
  amount: number; category_id?: string | null; product_id?: string | null;
  variant_id?: string | null; imei?: string | null; quantity?: number;
  unit_price?: number | null; cost_price?: number | null; profit?: number | null;
  tax_type?: string | null; tax_rate?: number | null; receipt_image?: string | null; note?: string | null;
  date: string; created_at?: string;
}
export interface Budget { id: string; workspace_id: string; category_id: string; month: string; amount: number; }
export interface Goal {
  id: string; workspace_id: string; name: string; target: number;
  saved: number; deadline?: string | null;
}
export interface DebtPayment {
  id: string; amount: number; created_at: string; note?: string | null;
}
export interface Debt {
  id: string; workspace_id: string; name: string; kind: DebtKind;
  amount: number; paid: number; due_date?: string | null; payment_history?: DebtPayment[];
}
export interface Reminder {
  id: string; workspace_id: string; title: string; amount?: number | null;
  next_date: string; frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}
export interface ProductCategory { id: string; workspace_id: string; name: string; color: string; icon: string; }
export interface ProductVariant {
  id: string; product_id: string; name: string;
  cost_price: number; sale_price: number; stock: number; imeis?: string[];
}
export interface ProductField {
  id: string; workspace_id: string; name: string; field_type: FieldType;
  required: boolean; enabled: boolean; options?: string[] | null;
}
export interface Product {
  id: string; workspace_id: string; category_id?: string | null; name: string;
  sku: string; unit: string; cost_price: number; sale_price: number;
  stock: number; min_stock: number;
  custom_values?: Record<string, string>; image?: string | null;
}
export interface StockMovement {
  id: string; workspace_id: string; product_id: string; variant_id?: string | null;
  kind: 'in' | 'out'; quantity: number; imei?: string | null;
  note?: string | null; created_at: string;
}
export interface TaxPayment {
  id: string; workspace_id: string; tax_type: TaxKind; period: string;
  amount: number; paid: boolean; due_date?: string | null; note?: string | null;
}
export interface TaxSettings {
  id: string; workspace_id: string; circular: TaxCircular;
  vat_rate: number; tncn_rate: number; tndn_rate: number; mon_bai: number;
}
export interface AppUser { id: string; email: string; name: string; }

/** Dữ liệu đầu vào khi ghi 1 giao dịch (form Thu/Chi/Chuyển ví / Bán hàng). */
export interface TxInput {
  type: 'income' | 'expense' | 'transfer';
  amount: number; wallet_id: string; to_wallet_id?: string | null;
  category_id?: string | null; product_id?: string | null; variant_id?: string | null;
  imei?: string | null; quantity?: number; unit_price?: number | null;
  cost_price?: number | null; tax_type?: string | null; tax_rate?: number | null;
  receipt_image?: string | null; note?: string; date: string;
}

/** Dữ liệu đầu vào khi thêm/sửa 1 sản phẩm (kèm danh sách biến thể). */
export interface ProductInput {
  id?: string; name: string; sku: string; unit: string; category_id?: string | null;
  cost_price: number; sale_price: number; stock: number; min_stock: number;
  custom_values?: Record<string, string>; image?: string | null;
  variants: Array<{ id?: string; name: string; cost_price: number; sale_price: number; stock: number; imeis?: string[] }>;
}

/** Toàn bộ state của 1 tài khoản (bản local dùng localStorage, bản cloud dùng Supabase). */
export interface AppState {
  user: AppUser | null;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  members: Member[];
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
  reminders: Reminder[];
  products: Product[];
  productCategories: ProductCategory[];
  productVariants: ProductVariant[];
  productFields: ProductField[];
  stockMovements: StockMovement[];
  taxPayments: TaxPayment[];
}

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: 'Tiền mặt', bank: 'Ngân hàng', 'e-wallet': 'Ví điện tử',
  credit: 'Thẻ tín dụng', savings: 'Tiết kiệm / Vốn', other: 'Khác',
};
export const WORKSPACE_MODE_LABELS: Record<WorkspaceMode, string> = {
  personal: 'Cá nhân', household: 'Hộ kinh doanh – Gia đình', team: 'Team – DN nhỏ',
};
export const TAX_CIRCULAR_LABELS: Record<TaxCircular, string> = {
  'TT88/2021': 'TT 88/2021 (Hộ kinh doanh)',
  'TT133/2016': 'TT 133/2016 (DN nhỏ & vừa)',
  'TT200/2014': 'TT 200/2014 (DN lớn)',
  TNCN: 'TNCN cá nhân (lũy tiến)',
};
