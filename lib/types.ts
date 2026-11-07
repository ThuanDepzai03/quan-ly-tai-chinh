// Kiểu dữ liệu dùng chung cho app Quản lý tài chính.
// Khớp 1-1 với supabase/schema.sql (16 bảng). Chỉ chứa type/interface,
// không chứa hàm tính toán (xem lib/utils.ts).
export type WorkspaceMode = 'personal' | 'household' | 'team';
export type BusinessType = 'individual' | 'household_business' | 'enterprise';
export type BusinessSector = 'goods' | 'services' | 'manufacturing_transport' | 'other';
export type TaxCircular = 'none' | 'TT88/2021' | 'TT152/2025' | 'TT133/2016' | 'TT200/2014' | 'TNCN';
export type TaxCalculationMethod = 'business_revenue' | 'business_profit' | 'enterprise_profit' | 'employment_income';
export type WalletType = 'cash' | 'bank' | 'e-wallet' | 'credit' | 'savings' | 'other';
export type TxType = 'income' | 'expense' | 'transfer';
export type DebtKind = 'borrow' | 'lend';
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';
export type TaxKind = 'VAT' | 'TNCN' | 'TNDN' | 'other' | 'mon_bai'; // mon_bai chỉ giữ để đọc dữ liệu lịch sử.
export const TAX_CALCULATION_METHOD_LABELS: Record<TaxCalculationMethod, string> = {
  business_revenue: 'Thuế hộ kinh doanh theo doanh thu',
  business_profit: 'Thuế hộ kinh doanh theo thu nhập tính thuế',
  enterprise_profit: 'TNDN theo thu nhập tính thuế',
  employment_income: 'TNCN từ tiền lương (lũy tiến)',
};

export interface Workspace {
  id: string; owner_id: string; name: string; mode: WorkspaceMode;
  tax_circular: TaxCircular; business_type?: BusinessType; business_sector?: BusinessSector;
  tax_method?: TaxCalculationMethod; vat_rate: number; tncn_rate: number;
  tndn_rate: number; tncn_deduction?: number; created_at: string;
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
  date: string; occurred_at?: string; created_at?: string;
}
export interface Budget { id: string; workspace_id: string; category_id: string; month: string; amount: number; }
export interface Goal {
  id: string; workspace_id: string; name: string; target: number;
  saved: number; deadline?: string | null;
}
export interface DebtPayment {
  id: string; type?: 'increase' | 'payment'; amount: number; created_at: string; note?: string | null;
}
export interface Debt {
  id: string; workspace_id: string; name: string; kind: DebtKind;
  amount: number; paid: number; start_date?: string | null; due_date?: string | null;
  payment_history?: DebtPayment[]; image?: string | null;
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
  business_type?: BusinessType; business_sector?: BusinessSector;
  vat_rate: number; tncn_rate: number; tndn_rate: number;
}
export interface AppUser { id: string; email: string; name: string; }

/** Dữ liệu đầu vào khi ghi 1 giao dịch (form Thu/Chi/Chuyển ví / Bán hàng). */
export interface TxInput {
  type: 'income' | 'expense' | 'transfer';
  amount: number; wallet_id: string; to_wallet_id?: string | null;
  category_id?: string | null; product_id?: string | null; variant_id?: string | null;
  imei?: string | null; quantity?: number; unit_price?: number | null;
  cost_price?: number | null; tax_type?: string | null; tax_rate?: number | null;
  receipt_image?: string | null; note?: string; date: string; occurred_at?: string;
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
  none: 'Không áp dụng chế độ kế toán',
  'TT88/2021': 'TT 88/2021 (Hộ kinh doanh)',
  'TT152/2025': 'TT 152/2025 (Hộ, cá nhân kinh doanh)',
  'TT133/2016': 'TT 133/2016 (DN nhỏ & vừa)',
  'TT200/2014': 'TT 200/2014 (DN lớn)',
  TNCN: 'TNCN cá nhân (lũy tiến)',
};
export const ACCOUNTING_REGIMES: TaxCircular[] = [
  'none', 'TT152/2025', 'TT88/2021', 'TT133/2016', 'TT200/2014',
];
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  individual: 'Cá nhân có thu nhập tiền lương',
  household_business: 'Hộ / cá nhân kinh doanh',
  enterprise: 'Doanh nghiệp',
};
export const BUSINESS_SECTOR_LABELS: Record<BusinessSector, string> = {
  goods: 'Phân phối, cung cấp hàng hóa',
  services: 'Dịch vụ',
  manufacturing_transport: 'Sản xuất, vận tải, dịch vụ gắn với hàng hóa',
  other: 'Hoạt động kinh doanh khác',
};
