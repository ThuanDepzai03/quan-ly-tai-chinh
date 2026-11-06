'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtVND, tax88 } from '@/lib/utils';
export default function Dashboard(){
 const [rows,setRows]=useState<any[]>([]); const [ws,setWs]=useState<any[]>([]); const [name,setName]=useState('');
 useEffect(()=>{const sb=createClient();
  sb.from('workspaces').select('*').then(({data})=>setWs(data||[]));
  sb.from('transactions').select('*').order('date',{ascending:false}).limit(20).then(({data})=>setRows(data||[]));
  sb.auth.getUser().then(({data})=>setName(data.user?.email||'demo@quanlytaichinh.vn'));
 },[]);
 const rev=rows.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0); const t=tax88(rev);
 return(<main><div className="glass"><h1>Dashboard</h1><p>Xin chào {name} • Workspace: {ws[0]?.name||'Hộ kinh doanh mẫu'}</p>
 <p>Tổng thu (20 giao dịch gần nhất): <b>{fmtVND(rev)}</b></p><p>Thuế TT88 ước tính: VAT {fmtVND(t.vat)} + TNCN {fmtVND(t.tncn)} = {fmtVND(t.total)}</p></div>
 <div className="glass"><h2>Giao dịch gần đây</h2>{rows.length?rows.map(r=>(<div key={r.id}>{r.date} • {r.type} • {fmtVND(r.amount)} {r.profit!=null?`• Lãi ${fmtVND(r.profit)}`:''} {r.note||''}</div>)):<p>Chưa có dữ liệu — chạy seed ở supabase/schema.sql hoặc dùng tài khoản demo.</p>}</div>
 <p><a href="/kho">Kho hàng</a> • <a href="/thue">Thuế</a> • <a href="/bao-cao">Báo cáo</a> • <button onClick={async()=>{await createClient().auth.signOut(); location.href='/auth'}}>Đăng xuất</button></p></main>);
}
