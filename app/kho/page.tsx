'use client';
import { useState } from 'react';
import { fmtVND, profitOf } from '@/lib/utils';
export default function Kho(){
 const [qty,setQty]=useState(5); const sale=89000, cost=35000;
 return(<main className="glass"><h1>Kho hàng</h1><p>Ví dụ: Ốp lưng iPhone 15 — Giá nhập {fmtVND(cost)} • Giá bán {fmtVND(sale)}</p>
 <label>Số lượng bán <input type="number" value={qty} onChange={e=>setQty(Number(e.target.value))}/></label>
 <p>Doanh thu: {fmtVND(qty*sale)} • Giá vốn: {fmtVND(qty*cost)} • <b>Lãi: {fmtVND(profitOf(qty,sale,cost))}</b></p>
 <p>Chọn biến thể (Đen/Trắng/Xanh), trường tùy chỉnh Màu sắc / IMEI / Serial ở form sản phẩm — xem lib/types.ts và supabase/schema.sql (bảng products, product_variants, product_fields, stock_movements).</p></main>);
}
