export type WorkspaceMode='personal'|'household'|'team';
export interface Workspace{id:string;name:string;mode:WorkspaceMode;owner_id:string;tax_circular:'TT88/2021'|'TT133/2016'|'TT200/2014'|'TNCN';created_at:string}
export interface Wallet{id:string;workspace_id:string;name:string;type:'cash'|'bank'|'e-wallet'|'credit'|'savings';balance:number;currency:string}
export interface Transaction{id:string;workspace_id:string;wallet_id:string;type:'income'|'expense'|'transfer';amount:number;category_id?:string;product_id?:string;variant_id?:string;imei?:string;quantity?:number;unit_price?:number;cost_price?:number;profit?:number;note?:string;date:string}
export interface Product{id:string;workspace_id:string;name:string;sku:string;category_id?:string;unit:string;cost_price:number;sale_price:number;stock:number;min_stock:number}
export interface ProductVariant{id:string;product_id:string;name:string;cost_price:number;sale_price:number;stock:number}
export function profitOf(qty:number,sale:number,cost:number){return qty*(sale-cost)}
export function tax88(revenue:number){return {vat:revenue*0.01, tncn:revenue*0.005, total:revenue*0.015}}
