import {
  LayoutDashboard,
  Receipt,
  Wallet,
  ShoppingCart,
  Building2,
  CreditCard,
  Settings,
  SlidersHorizontal,
} from "lucide-react";

export const navItems = [
  { title: "Mi mes", url: "/dashboard", icon: LayoutDashboard },
  { title: "Gastos", url: "/expenses", icon: ShoppingCart },
  { title: "Boletas", url: "/documents", icon: Receipt },
  { title: "Tarjetas", url: "/credit-cards", icon: CreditCard },
] as const;

export const mobilePrimaryNavItems = [
  { title: "Mi mes", url: "/dashboard", icon: LayoutDashboard },
  { title: "Movimientos", url: "/expenses", icon: ShoppingCart },
  { title: "Boletas", url: "/documents", icon: Receipt },
  { title: "Tarjetas", url: "/credit-cards", icon: CreditCard },
] as const;

export const mobileMoreNavItems = [
  { title: "Mi presupuesto", url: "/budget", icon: SlidersHorizontal },
  { title: "Configuración", url: "/settings", icon: Settings },
  { title: "Ingresos", url: "/income", icon: Wallet },
  { title: "Expensas", url: "/hoa", icon: Building2 },
] as const;
