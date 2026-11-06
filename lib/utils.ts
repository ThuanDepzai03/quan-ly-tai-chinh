export const fmtVND=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);
export const profitOf=(qty:number,sale:number,cost:number)=>qty*(sale-cost);
// TT88/2021: VAT khoán 1% + TNCN 0.5% trên doanh thu. Đối chiếu lại thông báo cơ quan thuế.
export const tax88=(revenue:number)=>({vat:Math.round(revenue*0.01),tncn:Math.round(revenue*0.005),total:Math.round(revenue*0.015)});
