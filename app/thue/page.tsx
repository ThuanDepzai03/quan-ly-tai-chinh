'use client';
import { useState } from 'react';
import { fmtVND, tax88 } from '@/lib/utils';
export default function Thue(){
 const [rev,setRev]=useState(10000000); const t=tax88(rev);
 return(<main className="glass"><h1>Thuế — TT88/2021 (Hộ kinh doanh)</h1>
 <label>Doanh thu <input type="number" value={rev} onChange={e=>setRev(Number(e.target.value))}/></label>
 <p>VAT 1%: {fmtVND(t.vat)} • TNCN 0,5%: {fmtVND(t.tncn)} • Tổng: {fmtVND(t.total)}</p>
 <p>Đổi sang TT133/2016 hoặc TT200/2014 trong Cài đặt workspace. 7 sổ S1–S7-HKD xuất Excel ở trang Báo cáo. Tỷ lệ trên là mẫu — đối chiếu thông báo cơ quan thuế.</p></main>);
}
