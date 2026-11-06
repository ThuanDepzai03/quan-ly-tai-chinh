// Dữ liệu mẫu hộ kinh doanh — dùng khi đăng nhập demo hoặc khi đăng ký mới
// và chọn "Nạp dữ liệu mẫu". Tổng 4 ví = 176.610.000đ (khớp bản demo trên Muse).
import type { AppState, AppUser, Product } from './types';
import { uid } from './utils';

export const DEMO_EMAIL = 'demo@quanlytaichinh.vn';
export const DEMO_PASSWORD = '123456';

export function seedDemoState(user: AppUser): AppState {
  const wsId = uid();
  const now = new Date().toISOString();
  const wallets = [
    { id: uid(), workspace_id: wsId, name: 'Tiền mặt', type: 'cash' as const, balance: 2140000, currency: 'VND' },
    { id: uid(), workspace_id: wsId, name: 'Vietcombank', type: 'bank' as const, balance: 90400000, currency: 'VND' },
    { id: uid(), workspace_id: wsId, name: 'MoMo', type: 'e-wallet' as const, balance: 34070000, currency: 'VND' },
    { id: uid(), workspace_id: wsId, name: 'Vốn kinh doanh', type: 'savings' as const, balance: 50000000, currency: 'VND' },
  ];
  const cat = (name: string, kind: 'income' | 'expense', color: string, icon: string) => ({
    id: uid(), workspace_id: wsId, name, kind, color, icon,
  });
  const categories = [
    cat('Bán hàng', 'income', '#34c759', '🛍️'),
    cat('Nhập hàng', 'expense', '#ff9500', '📦'),
    cat('Thuê mặt bằng', 'expense', '#af52de', '🏠'),
    cat('Điện nước', 'expense', '#0a84ff', '💡'),
    cat('Lương nhân viên', 'expense', '#ff3b30', '👥'),
    cat('Marketing', 'expense', '#ff2d92', '📣'),
    cat('Ăn uống', 'expense', '#8e8e93', '🍜'),
    cat('Thu khác', 'income', '#30b0c7', '💰'),
  ];
  const findCat = (n: string) => categories.find((c) => c.name === n)?.id ?? null;
  const tx = (
    walletIdx: number, type: 'income' | 'expense' | 'transfer', amount: number,
    catName: string, date: string, note: string, extra: Partial<Record<string, number | string | null>> = {},
  ) => ({
    id: uid(), workspace_id: wsId, wallet_id: wallets[walletIdx].id, type, amount,
    category_id: findCat(catName), product_id: null, variant_id: null, imei: null,
    quantity: 1, unit_price: null, cost_price: null, profit: null,
    tax_type: null, tax_rate: null, note, date, created_at: now, ...extra,
  });
  const transactions = [
    tx(1, 'income', 445000, 'Bán hàng', '2026-11-06', 'Bán 5 ốp lưng iPhone 15 (Đen)', { product_id: 'p-oplung', quantity: 5, unit_price: 89000, cost_price: 35000, profit: 270000 }),
    tx(1, 'income', 1280000, 'Bán hàng', '2026-11-05', 'Bán 2 cường lực + 4 cáp sạc', { quantity: 6, profit: 640000 }),
    tx(0, 'expense', 3500000, 'Nhập hàng', '2026-11-04', 'Nhập 100 ốp lưng các màu', {}),
    tx(1, 'expense', 8000000, 'Thuê mặt bằng', '2026-11-01', 'Thuê mặt bằng tháng 11', {}),
    tx(1, 'expense', 1250000, 'Điện nước', '2026-10-28', 'Tiền điện nước tháng 10', {}),
    tx(1, 'income', 890000, 'Bán hàng', '2026-10-25', 'Bán tai nghe Bluetooth', { quantity: 1, unit_price: 890000, cost_price: 520000, profit: 370000 }),
    tx(1, 'expense', 6000000, 'Lương nhân viên', '2026-10-20', 'Lương nhân viên tháng 10', {}),
    tx(2, 'income', 267000, 'Bán hàng', '2026-10-18', 'Bán 3 ốp lưng Samsung', { quantity: 3, unit_price: 89000, cost_price: 35000, profit: 162000 }),
    tx(1, 'expense', 1500000, 'Marketing', '2026-10-10', 'Chạy quảng cáo Facebook', {}),
    tx(1, 'income', 15990000, 'Bán hàng', '2026-10-05', 'Bán iPhone 15 128GB (IMEI 356789123456701)', { quantity: 1, unit_price: 15990000, cost_price: 14200000, profit: 1790000, imei: '356789123456701' }),
    tx(0, 'income', 445000, 'Bán hàng', '2026-09-22', 'Bán 5 ốp lưng iPhone 15 (Trắng)', { quantity: 5, unit_price: 89000, cost_price: 35000, profit: 270000 }),
    tx(1, 'expense', 4200000, 'Nhập hàng', '2026-09-15', 'Nhập điện thoại + phụ kiện', {}),
  ];
  const productCategories = [
    { id: uid(), workspace_id: wsId, name: 'Ốp lưng', color: '#0a84ff', icon: '📱' },
    { id: uid(), workspace_id: wsId, name: 'Cường lực', color: '#34c759', icon: '🛡️' },
    { id: uid(), workspace_id: wsId, name: 'Cáp sạc', color: '#ff9500', icon: '🔌' },
    { id: uid(), workspace_id: wsId, name: 'Tai nghe', color: '#af52de', icon: '🎧' },
    { id: uid(), workspace_id: wsId, name: 'Điện thoại', color: '#ff3b30', icon: '📞' },
    { id: uid(), workspace_id: wsId, name: 'Pin dự phòng', color: '#30b0c7', icon: '🔋' },
    { id: uid(), workspace_id: wsId, name: 'Phụ kiện khác', color: '#8e8e93', icon: '🧩' },
  ];
  const pc = (n: string) => productCategories.find((c) => c.name === n)?.id ?? null;
  const products: Product[] = [
    { id: 'p-oplung', workspace_id: wsId, category_id: pc('Ốp lưng'), name: 'Ốp lưng iPhone 15', sku: 'OP-IP15', unit: 'cái', cost_price: 35000, sale_price: 89000, stock: 47, min_stock: 10, custom_values: { 'Màu sắc': 'Đen / Trắng / Xanh', 'Nhà cung cấp': 'Phụ kiện An Phát', 'Bảo hành': '7 ngày' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Ốp lưng'), name: 'Ốp lưng Samsung S24', sku: 'OP-SS24', unit: 'cái', cost_price: 32000, sale_price: 79000, stock: 28, min_stock: 10, custom_values: { 'Màu sắc': 'Đen', 'Nhà cung cấp': 'Phụ kiện An Phát' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Cường lực'), name: 'Cường lực iPhone 15', sku: 'CL-IP15', unit: 'cái', cost_price: 15000, sale_price: 49000, stock: 120, min_stock: 20, custom_values: {} },
    { id: uid(), workspace_id: wsId, category_id: pc('Cáp sạc'), name: 'Cáp sạc Type-C 1m', sku: 'CAP-C1M', unit: 'cái', cost_price: 25000, sale_price: 69000, stock: 85, min_stock: 15, custom_values: {} },
    { id: uid(), workspace_id: wsId, category_id: pc('Tai nghe'), name: 'Tai nghe Bluetooth', sku: 'TN-BT01', unit: 'cái', cost_price: 520000, sale_price: 890000, stock: 12, min_stock: 5, custom_values: { 'Màu sắc': 'Trắng', 'Bảo hành': '6 tháng' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Điện thoại'), name: 'iPhone 15 128GB', sku: 'IP15-128', unit: 'cái', cost_price: 14200000, sale_price: 15990000, stock: 1, min_stock: 1, custom_values: { IMEI: '356789123456702', 'Bảo hành': '12 tháng' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Pin dự phòng'), name: 'Pin dự phòng 10000mAh', sku: 'PIN-10K', unit: 'cái', cost_price: 180000, sale_price: 349000, stock: 22, min_stock: 5, custom_values: {} },
  ];
  const variants = [
    { id: uid(), product_id: 'p-oplung', name: 'Đen', cost_price: 35000, sale_price: 89000, stock: 20, imeis: [] },
    { id: uid(), product_id: 'p-oplung', name: 'Trắng', cost_price: 35000, sale_price: 89000, stock: 15, imeis: [] },
    { id: uid(), product_id: 'p-oplung', name: 'Xanh', cost_price: 35000, sale_price: 89000, stock: 12, imeis: [] },
    { id: uid(), product_id: products[5].id, name: '128GB', cost_price: 14200000, sale_price: 15990000, stock: 1, imeis: ['356789123456702'] },
    { id: uid(), product_id: products[4].id, name: 'Trắng', cost_price: 520000, sale_price: 890000, stock: 7, imeis: [] },
  ];
  return {
    user,
    workspaces: [{
      id: wsId, owner_id: user.id, name: 'Hộ kinh doanh mẫu', mode: 'household',
      tax_circular: 'TT88/2021', vat_rate: 0.01, tncn_rate: 0.005, tndn_rate: 0.2,
      mon_bai: 1000000, created_at: now,
    }],
    currentWorkspaceId: wsId,
    members: [{ id: uid(), workspace_id: wsId, user_id: user.id, role: 'owner', email: user.email, name: user.name }],
    wallets, categories, transactions,
    budgets: [
      { id: uid(), workspace_id: wsId, category_id: findCat('Nhập hàng') ?? '', month: '2026-11', amount: 10000000 },
      { id: uid(), workspace_id: wsId, category_id: findCat('Thuê mặt bằng') ?? '', month: '2026-11', amount: 8000000 },
      { id: uid(), workspace_id: wsId, category_id: findCat('Marketing') ?? '', month: '2026-11', amount: 2000000 },
      { id: uid(), workspace_id: wsId, category_id: findCat('Ăn uống') ?? '', month: '2026-11', amount: 3000000 },
    ],
    goals: [
      { id: uid(), workspace_id: wsId, name: 'Quỹ dự phòng', target: 50000000, saved: 18000000, deadline: '2027-06-30' },
      { id: uid(), workspace_id: wsId, name: 'Mở thêm chi nhánh', target: 200000000, saved: 35000000, deadline: '2027-12-31' },
    ],
    debts: [
      { id: uid(), workspace_id: wsId, name: 'Khách nợ — Anh Tuấn', kind: 'lend', amount: 2500000, paid: 1000000, due_date: '2026-11-20' },
      { id: uid(), workspace_id: wsId, name: 'Nợ nhà cung cấp An Phát', kind: 'borrow', amount: 4200000, paid: 0, due_date: '2026-11-30' },
    ],
    reminders: [
      { id: uid(), workspace_id: wsId, title: 'Nộp thuế khoán quý 4', amount: 1695000, next_date: '2026-12-30', frequency: 'quarterly' },
      { id: uid(), workspace_id: wsId, title: 'Thuê mặt bằng tháng 12', amount: 8000000, next_date: '2026-12-01', frequency: 'monthly' },
    ],
    products, productCategories, productVariants: variants,
    productFields: [
      { id: uid(), workspace_id: wsId, name: 'Màu sắc', field_type: 'text', required: false, enabled: true, options: null },
      { id: uid(), workspace_id: wsId, name: 'IMEI', field_type: 'text', required: false, enabled: true, options: null },
      { id: uid(), workspace_id: wsId, name: 'Serial', field_type: 'text', required: false, enabled: true, options: null },
      { id: uid(), workspace_id: wsId, name: 'Nhà cung cấp', field_type: 'text', required: false, enabled: true, options: null },
      { id: uid(), workspace_id: wsId, name: 'Bảo hành', field_type: 'select', required: false, enabled: true, options: ['7 ngày', '1 tháng', '6 tháng', '12 tháng'] },
    ],
    stockMovements: [
      { id: uid(), workspace_id: wsId, product_id: 'p-oplung', variant_id: variants[0].id, kind: 'out', quantity: 5, imei: null, note: 'Bán 5 ốp Đen', created_at: '2026-11-06T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: 'p-oplung', variant_id: null, kind: 'in', quantity: 100, imei: null, note: 'Nhập 100 ốp lưng', created_at: '2026-11-04T08:00:00.000Z' },
    ],
    taxPayments: [
      { id: uid(), workspace_id: wsId, tax_type: 'VAT', period: 'Q3/2026', amount: 1220000, paid: true, due_date: '2026-10-30', note: 'Thuế khoán quý 3' },
      { id: uid(), workspace_id: wsId, tax_type: 'TNCN', period: 'Q3/2026', amount: 610000, paid: true, due_date: '2026-10-30', note: 'Thuế khoán quý 3' },
      { id: uid(), workspace_id: wsId, tax_type: 'mon_bai', period: '2026', amount: 1000000, paid: true, due_date: '2026-01-30', note: 'Lệ phí môn bài năm 2026' },
      { id: uid(), workspace_id: wsId, tax_type: 'VAT', period: 'Q4/2026', amount: 695000, paid: false, due_date: '2027-01-30', note: 'Ước tính từ doanh thu 69,5tr' },
    ],
  };
}

/** State trống cho tài khoản mới không nạp dữ liệu mẫu. */
export function emptyState(user: AppUser): AppState {
  const wsId = uid();
  return {
    user,
    workspaces: [{
      id: wsId, owner_id: user.id, name: 'Không gian của tôi', mode: 'personal',
      tax_circular: 'TT88/2021', vat_rate: 0.01, tncn_rate: 0.005, tndn_rate: 0.2,
      mon_bai: 1000000, created_at: new Date().toISOString(),
    }],
    currentWorkspaceId: wsId,
    members: [{ id: uid(), workspace_id: wsId, user_id: user.id, role: 'owner', email: user.email, name: user.name }],
    wallets: [{ id: uid(), workspace_id: wsId, name: 'Tiền mặt', type: 'cash', balance: 0, currency: 'VND' }],
    categories: [
      { id: uid(), workspace_id: wsId, name: 'Bán hàng', kind: 'income', color: '#34c759', icon: '🛍️' },
      { id: uid(), workspace_id: wsId, name: 'Ăn uống', kind: 'expense', color: '#ff9500', icon: '🍜' },
    ],
    transactions: [], budgets: [], goals: [], debts: [], reminders: [],
    products: [], productCategories: [], productVariants: [], productFields: [],
    stockMovements: [], taxPayments: [],
  };
}
