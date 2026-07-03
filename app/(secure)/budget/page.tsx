import { BudgetSettings } from "@/components/budget/budget-settings";

export default function BudgetPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Mi presupuesto</h1>
        <p className="max-w-3xl text-muted-foreground">
          Definí tu saldo inicial, la reserva que no querés gastar y los
          límites que querés cuidar.
        </p>
      </div>
      <div className="max-w-4xl">
        <BudgetSettings />
      </div>
    </div>
  );
}
