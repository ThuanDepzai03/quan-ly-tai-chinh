import type { BusinessSector, BusinessType, TaxCalculationMethod } from './types';

export const TAX_RULES_2026 = {
  effectiveYear: 2026,
  legalBasis: [
    'Luật Thuế GTGT số 48/2024/QH15, được sửa đổi bởi Luật số 149/2025/QH15',
    'Luật Thuế TNCN số 109/2025/QH15',
    'Luật Thuế TNDN số 67/2025/QH15',
    'Nghị quyết số 198/2025/QH15',
    'Thông tư số 152/2025/TT-BTC',
  ],
  householdBusiness: {
    annualRevenueExemption: 500_000_000,
    profitMethodRevenueThreshold: 3_000_000_000,
    revenueRates: {
      goods: { vat: 0.01, tncn: 0.005 },
      services: { vat: 0.05, tncn: 0.02 },
      manufacturing_transport: { vat: 0.03, tncn: 0.015 },
      other: { vat: 0.02, tncn: 0.01 },
    } satisfies Record<BusinessSector, { vat: number; tncn: number }>,
    incomeTaxRates: [
      { maxAnnualRevenue: 50_000_000_000, rate: 0.15 },
      { maxAnnualRevenue: Infinity, rate: 0.2 },
    ],
  },
  enterprise: {
    defaultVatRate: 0.1,
    corporateIncomeTaxRates: [
      { maxAnnualRevenue: 3_000_000_000, rate: 0.15 },
      { maxAnnualRevenue: 50_000_000_000, rate: 0.17 },
      { maxAnnualRevenue: Infinity, rate: 0.2 },
    ],
  },
  personalIncome: {
    monthlyDeduction: 15_500_000,
    progressiveBrackets: [
      { width: 10_000_000, rate: 0.05 },
      { width: 20_000_000, rate: 0.1 },
      { width: 30_000_000, rate: 0.2 },
      { width: 40_000_000, rate: 0.3 },
      { width: Infinity, rate: 0.35 },
    ],
  },
} as const;

export function inferBusinessType(mode: 'personal' | 'household' | 'team'): BusinessType {
  if (mode === 'household') return 'household_business';
  if (mode === 'team') return 'enterprise';
  return 'individual';
}

export function defaultTaxMethod(
  businessType: BusinessType,
  annualRevenue = 0,
): TaxCalculationMethod {
  if (businessType === 'individual') return 'employment_income';
  if (businessType === 'enterprise') return 'enterprise_profit';
  return annualRevenue > TAX_RULES_2026.householdBusiness.profitMethodRevenueThreshold
    ? 'business_profit'
    : 'business_revenue';
}

export function taxMethodOptions(
  businessType: BusinessType,
  annualRevenue = 0,
): TaxCalculationMethod[] {
  if (businessType === 'individual') return ['employment_income'];
  if (businessType === 'enterprise') return ['enterprise_profit'];
  return annualRevenue > TAX_RULES_2026.householdBusiness.profitMethodRevenueThreshold
    ? ['business_profit']
    : ['business_revenue'];
}
