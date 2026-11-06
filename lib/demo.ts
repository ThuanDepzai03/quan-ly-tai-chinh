// Dữ liệu mẫu hộ kinh doanh — dùng khi đăng nhập demo hoặc khi đăng ký mới
// và chọn "Nạp dữ liệu mẫu". Tổng 4 ví = 176.610.000đ (khớp bản demo trên Muse).
import type { AppState, AppUser, Product } from './types';
import { uid } from './utils';

export const DEMO_EMAIL = 'demo@quanlytaichinh.vn';
export const DEMO_PASSWORD = '123456';
/** ID cố định (UUID hợp lệ) cho sản phẩm mẫu chính — các giao dịch/biến thể
 *  tham chiếu tới nó, và Supabase yêu cầu khóa chính là uuid. */
export const DEMO_MAIN_PRODUCT_ID = 'a1b2c3d4-0000-4000-8000-000000000001';

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
    tx(1, 'income', 445000, 'Bán hàng', '2026-11-06', 'Bán 5 ốp lưng iPhone 15 (Đen)', { product_id: DEMO_MAIN_PRODUCT_ID, quantity: 5, unit_price: 89000, cost_price: 35000, profit: 270000 }),
    tx(1, 'income', 1280000, 'Bán hàng', '2026-11-05', 'Bán 2 cường lực + 4 cáp sạc', { quantity: 6, profit: 640000 }),
    tx(1, 'income', 2670000, 'Bán hàng', '2026-11-03', 'Bán 30 ốp lưng iPhone 15 các màu', { quantity: 30, unit_price: 89000, cost_price: 35000, profit: 1620000 }),
    tx(0, 'expense', 3500000, 'Nhập hàng', '2026-11-04', 'Nhập 100 ốp lưng các màu', {}),
    tx(1, 'expense', 8000000, 'Thuê mặt bằng', '2026-11-01', 'Thuê mặt bằng tháng 11', {}),
    tx(1, 'expense', 1250000, 'Điện nước', '2026-10-28', 'Tiền điện nước tháng 10', {}),
    tx(1, 'income', 890000, 'Bán hàng', '2026-10-25', 'Bán tai nghe Bluetooth', { quantity: 1, unit_price: 890000, cost_price: 520000, profit: 370000 }),
    tx(1, 'income', 15990000, 'Bán hàng', '2026-10-28', 'Bán iPhone 15 128GB (IMEI 356789123456701)', { quantity: 1, unit_price: 15990000, cost_price: 14200000, profit: 1790000, imei: '356789123456701' }),
    tx(1, 'income', 31980000, 'Bán hàng', '2026-10-12', 'Bán 2 iPhone 15 128GB', { quantity: 2, unit_price: 15990000, cost_price: 14200000, profit: 3580000 }),
    tx(1, 'expense', 6000000, 'Lương nhân viên', '2026-10-20', 'Lương nhân viên tháng 10', {}),
    tx(2, 'income', 267000, 'Bán hàng', '2026-10-18', 'Bán 3 ốp lưng Samsung', { quantity: 3, unit_price: 89000, cost_price: 35000, profit: 162000 }),
    tx(1, 'expense', 1500000, 'Marketing', '2026-10-10', 'Chạy quảng cáo Facebook', {}),
    tx(1, 'income', 15990000, 'Bán hàng', '2026-10-05', 'Bán iPhone 15 128GB (IMEI 356789123456701)', { quantity: 1, unit_price: 15990000, cost_price: 14200000, profit: 1790000, imei: '356789123456701' }),
    tx(1, 'income', 1780000, 'Bán hàng', '2026-08-06', 'Bán 2 tai nghe Bluetooth', { quantity: 2, unit_price: 890000, cost_price: 520000, profit: 740000 }),
    tx(1, 'income', 1396000, 'Bán hàng', '2026-09-30', 'Bán 4 pin dự phòng 10000mAh', { quantity: 4, unit_price: 349000, cost_price: 180000, profit: 676000 }),
    tx(0, 'expense', 4200000, 'Nhập hàng', '2026-09-15', 'Nhập điện thoại + phụ kiện', {}),
    tx(1, 'expense', 8000000, 'Thuê mặt bằng', '2026-09-01', 'Thuê mặt bằng tháng 9', {}),
    tx(1, 'income', 445000, 'Bán hàng', '2026-09-22', 'Bán 5 ốp lưng iPhone 15 (Trắng)', { quantity: 5, unit_price: 89000, cost_price: 35000, profit: 270000 }),
    tx(1, 'income', 690000, 'Bán hàng', '2026-09-20', 'Bán 10 cáp sạc Type-C 1m', { quantity: 10, unit_price: 69000, cost_price: 25000, profit: 440000 }),
    tx(1, 'income', 549000, 'Bán hàng', '2026-09-18', 'Bán loa Bluetooth mini', { quantity: 1, unit_price: 549000, cost_price: 320000, profit: 229000 }),
    tx(1, 'expense', 6000000, 'Lương nhân viên', '2026-09-20', 'Lương nhân viên tháng 9', {}),
    tx(1, 'expense', 1100000, 'Điện nước', '2026-09-28', 'Tiền điện nước tháng 9', {}),
    tx(1, 'income', 1185000, 'Bán hàng', '2026-09-12', 'Bán 15 cường lực iPhone 15', { quantity: 15, unit_price: 79000, cost_price: 32000, profit: 705000 }),
    tx(2, 'income', 356000, 'Bán hàng', '2026-09-10', 'Bán 4 ốp lưng iPhone 14', { quantity: 4, unit_price: 89000, cost_price: 30000, profit: 236000 }),
    tx(1, 'expense', 1200000, 'Marketing', '2026-09-08', 'Chạy quảng cáo TikTok', {}),
    tx(1, 'income', 15990000, 'Bán hàng', '2026-09-05', 'Bán iPhone 15 128GB', { quantity: 1, unit_price: 15990000, cost_price: 14200000, profit: 1790000 }),
    tx(1, 'income', 890000, 'Bán hàng', '2026-08-28', 'Bán tai nghe Bluetooth', { quantity: 1, unit_price: 890000, cost_price: 520000, profit: 370000 }),
    tx(1, 'income', 445000, 'Bán hàng', '2026-08-25', 'Bán 5 ốp lưng Samsung S24', { quantity: 5, unit_price: 79000, cost_price: 32000, profit: 235000 }),
    tx(1, 'income', 207000, 'Bán hàng', '2026-08-22', 'Bán 3 cáp sạc Lightning 1m', { quantity: 3, unit_price: 69000, cost_price: 28000, profit: 123000 }),
    tx(0, 'expense', 5200000, 'Nhập hàng', '2026-08-20', 'Nhập 150 ốp + 80 cường lực', {}),
    tx(1, 'expense', 8000000, 'Thuê mặt bằng', '2026-08-01', 'Thuê mặt bằng tháng 8', {}),
    tx(1, 'expense', 6000000, 'Lương nhân viên', '2026-08-20', 'Lương nhân viên tháng 8', {}),
    tx(1, 'income', 1098000, 'Bán hàng', '2026-08-18', 'Bán 2 loa Bluetooth mini', { quantity: 2, unit_price: 549000, cost_price: 320000, profit: 458000 }),
    tx(1, 'income', 712000, 'Bán hàng', '2026-08-15', 'Bán 8 ốp lưng iPhone 14', { quantity: 8, unit_price: 89000, cost_price: 30000, profit: 472000 }),
    tx(1, 'income', 490000, 'Bán hàng', '2026-08-12', 'Bán 10 cường lực Samsung S24', { quantity: 10, unit_price: 49000, cost_price: 14000, profit: 350000 }),
    tx(1, 'expense', 980000, 'Điện nước', '2026-08-28', 'Tiền điện nước tháng 8', {}),
    tx(1, 'income', 345000, 'Bán hàng', '2026-08-10', 'Bán 5 cáp sạc Type-C 1m', { quantity: 5, unit_price: 69000, cost_price: 25000, profit: 220000 }),
    tx(1, 'expense', 900000, 'Marketing', '2026-08-08', 'Chạy quảng cáo Facebook tháng 8', {}),
    tx(1, 'income', 15990000, 'Bán hàng', '2026-08-05', 'Bán iPhone 15 128GB', { quantity: 1, unit_price: 15990000, cost_price: 14200000, profit: 1790000 }),
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
    { id: DEMO_MAIN_PRODUCT_ID, workspace_id: wsId, category_id: pc('Ốp lưng'), name: 'Ốp lưng iPhone 15', sku: 'OP-IP15', unit: 'cái', cost_price: 35000, sale_price: 89000, stock: 47, min_stock: 10, custom_values: { 'Màu sắc': 'Đen / Trắng / Xanh', 'Nhà cung cấp': 'Phụ kiện An Phát', 'Bảo hành': '7 ngày' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Ốp lưng'), name: 'Ốp lưng Samsung S24', sku: 'OP-SS24', unit: 'cái', cost_price: 32000, sale_price: 79000, stock: 28, min_stock: 10, custom_values: { 'Màu sắc': 'Đen', 'Nhà cung cấp': 'Phụ kiện An Phát' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Ốp lưng'), name: 'Ốp lưng iPhone 14', sku: 'OP-IP14', unit: 'cái', cost_price: 30000, sale_price: 89000, stock: 35, min_stock: 10, custom_values: { 'Màu sắc': 'Đen / Xanh', 'Nhà cung cấp': 'Phụ kiện An Phát' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Cường lực'), name: 'Cường lực iPhone 15', sku: 'CL-IP15', unit: 'cái', cost_price: 15000, sale_price: 49000, stock: 120, min_stock: 20, custom_values: {} },
    { id: uid(), workspace_id: wsId, category_id: pc('Cường lực'), name: 'Cường lực Samsung S24', sku: 'CL-SS24', unit: 'cái', cost_price: 14000, sale_price: 49000, stock: 90, min_stock: 20, custom_values: {} },
    { id: uid(), workspace_id: wsId, category_id: pc('Cáp sạc'), name: 'Cáp sạc Type-C 1m', sku: 'CAP-C1M', unit: 'cái', cost_price: 25000, sale_price: 69000, stock: 85, min_stock: 15, custom_values: {} },
    { id: uid(), workspace_id: wsId, category_id: pc('Cáp sạc'), name: 'Cáp sạc Lightning 1m', sku: 'CAP-L1M', unit: 'cái', cost_price: 28000, sale_price: 75000, stock: 60, min_stock: 15, custom_values: {} },
    { id: uid(), workspace_id: wsId, category_id: pc('Tai nghe'), name: 'Tai nghe Bluetooth', sku: 'TN-BT01', unit: 'cái', cost_price: 520000, sale_price: 890000, stock: 12, min_stock: 5, custom_values: { 'Màu sắc': 'Trắng', 'Bảo hành': '6 tháng' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Điện thoại'), name: 'iPhone 15 128GB', sku: 'IP15-128', unit: 'cái', cost_price: 14200000, sale_price: 15990000, stock: 1, min_stock: 1, custom_values: { IMEI: '356789123456702', 'Bảo hành': '12 tháng' } },
    { id: uid(), workspace_id: wsId, category_id: pc('Pin dự phòng'), name: 'Pin dự phòng 10000mAh', sku: 'PIN-10K', unit: 'cái', cost_price: 180000, sale_price: 349000, stock: 22, min_stock: 5, custom_values: {} },
    { id: uid(), workspace_id: wsId, category_id: pc('Tai nghe'), name: 'Loa Bluetooth mini', sku: 'LOA-BT01', unit: 'cái', cost_price: 320000, sale_price: 549000, stock: 9, min_stock: 5, custom_values: { 'Màu sắc': 'Đen', 'Bảo hành': '6 tháng' } },
  ];
  const prodByName = (n: string) => products.find((p) => p.name === n)?.id ?? '';
  const variants = [
    { id: uid(), product_id: DEMO_MAIN_PRODUCT_ID, name: 'Đen', cost_price: 35000, sale_price: 89000, stock: 20, imeis: [] },
    { id: uid(), product_id: DEMO_MAIN_PRODUCT_ID, name: 'Trắng', cost_price: 35000, sale_price: 89000, stock: 15, imeis: [] },
    { id: uid(), product_id: DEMO_MAIN_PRODUCT_ID, name: 'Xanh', cost_price: 35000, sale_price: 89000, stock: 12, imeis: [] },
    { id: uid(), product_id: prodByName('iPhone 15 128GB'), name: '128GB', cost_price: 14200000, sale_price: 15990000, stock: 1, imeis: ['356789123456702'] },
    { id: uid(), product_id: prodByName('Tai nghe Bluetooth'), name: 'Trắng', cost_price: 520000, sale_price: 890000, stock: 7, imeis: [] },
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
      { id: uid(), workspace_id: wsId, product_id: DEMO_MAIN_PRODUCT_ID, variant_id: variants[0].id, kind: 'out', quantity: 5, imei: null, note: 'Bán 5 ốp Đen', created_at: '2026-11-06T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: DEMO_MAIN_PRODUCT_ID, variant_id: null, kind: 'in', quantity: 100, imei: null, note: 'Nhập 100 ốp lưng', created_at: '2026-11-04T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: DEMO_MAIN_PRODUCT_ID, variant_id: variants[0].id, kind: 'out', quantity: 30, imei: null, note: 'Bán 30 ốp các màu', created_at: '2026-11-03T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('iPhone 15 128GB'), variant_id: variants[3].id, kind: 'out', quantity: 1, imei: '356789123456701', note: 'Bán iPhone 15 128GB', created_at: '2026-10-28T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('iPhone 15 128GB'), variant_id: variants[3].id, kind: 'out', quantity: 2, imei: null, note: 'Bán 2 iPhone 15 128GB', created_at: '2026-10-12T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Tai nghe Bluetooth'), variant_id: null, kind: 'out', quantity: 2, imei: null, note: 'Bán 2 tai nghe Bluetooth', created_at: '2026-08-06T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Pin dự phòng 10000mAh'), variant_id: null, kind: 'out', quantity: 4, imei: null, note: 'Bán 4 pin dự phòng', created_at: '2026-09-30T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: DEMO_MAIN_PRODUCT_ID, variant_id: variants[1].id, kind: 'out', quantity: 5, imei: null, note: 'Bán 5 ốp Trắng', created_at: '2026-09-22T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Cáp sạc Type-C 1m'), variant_id: null, kind: 'out', quantity: 10, imei: null, note: 'Bán 10 cáp Type-C', created_at: '2026-09-20T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Loa Bluetooth mini'), variant_id: null, kind: 'out', quantity: 1, imei: null, note: 'Bán loa Bluetooth mini', created_at: '2026-09-18T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Cường lực iPhone 15'), variant_id: null, kind: 'out', quantity: 15, imei: null, note: 'Bán 15 cường lực iPhone 15', created_at: '2026-09-12T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Ốp lưng iPhone 14'), variant_id: null, kind: 'out', quantity: 4, imei: null, note: 'Bán 4 ốp iPhone 14', created_at: '2026-09-10T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('iPhone 15 128GB'), variant_id: variants[3].id, kind: 'out', quantity: 1, imei: null, note: 'Bán iPhone 15 128GB', created_at: '2026-09-05T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Ốp lưng Samsung S24'), variant_id: null, kind: 'out', quantity: 5, imei: null, note: 'Bán 5 ốp Samsung S24', created_at: '2026-08-25T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Cáp sạc Lightning 1m'), variant_id: null, kind: 'out', quantity: 3, imei: null, note: 'Bán 3 cáp Lightning', created_at: '2026-08-22T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: DEMO_MAIN_PRODUCT_ID, variant_id: null, kind: 'in', quantity: 150, imei: null, note: 'Nhập 150 ốp lưng', created_at: '2026-08-20T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('Loa Bluetooth mini'), variant_id: null, kind: 'out', quantity: 2, imei: null, note: 'Bán 2 loa Bluetooth mini', created_at: '2026-08-18T08:00:00.000Z' },
      { id: uid(), workspace_id: wsId, product_id: prodByName('iPhone 15 128GB'), variant_id: variants[3].id, kind: 'out', quantity: 1, imei: null, note: 'Bán iPhone 15 128GB', created_at: '2026-08-05T08:00:00.000Z' },
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
