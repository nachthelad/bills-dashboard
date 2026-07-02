import {
  LayoutDashboard,
  Receipt,
  Wallet,
  ShoppingCart,
  Building2,
  CreditCard,
  Settings,
} from "lucide-react";

export const navItems = [
  { title: "Mi mes", url: "/dashboard", icon: LayoutDashboard },
  { title: "Movimientos", url: "/expenses", icon: ShoppingCart },
  { title: "Importar", url: "/documents", icon: Receipt },
  { title: "Cuotas", url: "/credit-cards", icon: CreditCard },
] as const;

export const mobilePrimaryNavItems = [
  { title: "Mi mes", url: "/dashboard", icon: LayoutDashboard },
  { title: "Movimientos", url: "/expenses", icon: ShoppingCart },
  { title: "Importar", url: "/documents", icon: Receipt },
  { title: "Cuotas", url: "/credit-cards", icon: CreditCard },
] as const;

export const mobileMoreNavItems = [
  { title: "Configuración", url: "/settings", icon: Settings },
  { title: "Ingresos", url: "/income", icon: Wallet },
  { title: "Expensas", url: "/hoa", icon: Building2 },
] as const;
