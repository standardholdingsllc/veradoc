export const ADMIN_TABS = [
  { id: "overview", label: "Resumen", requiresCommercialAccounting: false },
  { id: "realtors", label: "Agentes", requiresCommercialAccounting: false },
  { id: "coverage", label: "Cobertura", requiresCommercialAccounting: false },
  {
    id: "payouts",
    label: "Pagos notariales",
    requiresCommercialAccounting: true,
  },
  { id: "finance", label: "Finanzas", requiresCommercialAccounting: true },
  { id: "refunds", label: "Reembolsos", requiresCommercialAccounting: true },
  { id: "users", label: "Usuarios", requiresCommercialAccounting: false },
] as const;

export function getAdminTabs(commercialAccountingEnabled: boolean) {
  return ADMIN_TABS.filter(
    (tab) => commercialAccountingEnabled || !tab.requiresCommercialAccounting,
  ).map(({ id, label }) => ({ id, label }));
}
