'use client';
export default function BaoCao(){
 function exportCSV(){const rows=[['Ngay','Loai','So tien','Lai'],['2026-11-06','Ban hang',445000,270000]]; const csv=rows.map(r=>r.join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='bao-cao.csv'; a.click();}
 return(<main className="glass"><h1>Báo cáo & Xuất file</h1><p>Báo cáo thu–chi, lời/lãi theo sản phẩm/biến thể, thuế theo tháng/quý/năm.</p><button onClick={exportCSV}>Xuất CSV mẫu</button><p>Xuất Excel đầy đủ dùng thư viện xlsx ở package.json — xem README.</p></main>);
}
