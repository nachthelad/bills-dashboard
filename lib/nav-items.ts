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
  { title: "Boletas", url: "/documents", icon: Receipt },
  { title: "Ingresos", url: "/income", icon: Wallet },
  { title: "Panel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Gastos", url: "/expenses", icon: ShoppingCart },
  { title: "Tarjetas", url: "/credit-cards", icon: CreditCard },
  { title: "Expensas", url: "/hoa", icon: Building2 },
] as const;

export const mobilePrimaryNavItems = [
  { title: "Panel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Gastos", url: "/expenses", icon: ShoppingCart },
  { title: "Tarjetas", url: "/credit-cards", icon: CreditCard },
  { title: "Ingresos", url: "/income", icon: Wallet },
] as const;

export const mobileMoreNavItems = [
  { title: "Boletas", url: "/documents", icon: Receipt },
  { title: "Expensas", url: "/hoa", icon: Building2 },
  { title: "Configuración", url: "/settings", icon: Settings },
] as const;
