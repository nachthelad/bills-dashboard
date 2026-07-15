# Claridad de cobertura mensual

## Objetivo

Evitar que el bloque de fondos de `Mi mes` presente la diferencia contra el presupuesto completo como si fuera deuda pendiente. La pantalla debe explicar de forma visible cómo se forma el objetivo mensual y qué período representa cada cifra, sin cambiar todavía el modelo de pagos de tarjetas.

## Problema actual

La interfaz usa `Falta cubrir` y `Cobertura mensual` para comparar los fondos registrados con un objetivo que contiene:

- todos los gastos fijos del período, incluso cuando ya están pagados;
- todos los compromisos de tarjeta asignados al mes de vencimiento;
- la cobertura completa de límites variables;
- el colchón configurado.

Por eso la diferencia no representa una deuda pendiente. Además, `Cobrado` y `Sin convertir` muestran saldos acumulados de moneda extranjera, mientras que `Convertido a ARS` corresponde al mes seleccionado. Los rótulos actuales no hacen visible esa diferencia temporal.

## Alcance aprobado

### Semántica

- Cambiar el estado `Falta cubrir` por `Diferencia contra el plan`.
- Explicar que esa diferencia indica cuánto falta registrar para cubrir el presupuesto completo, no cuánto queda por pagar.
- Cambiar `Cobertura mensual` por `Plan mensual cubierto`.
- Mantener el cálculo actual y todos los datos persistidos sin modificaciones.

### Rótulos de fondos

- `Cobrado` pasa a `Cobros acumulados`.
- `Sin convertir` pasa a `Saldo sin convertir`.
- `Convertido a ARS` pasa a `Convertido en el mes`.
- `Falta cubrir` pasa a `Diferencia contra el plan`.

### Desglose del plan

Debajo de la barra se mostrará un desglose de cuatro componentes:

1. Gastos fijos: `summary.amounts.fixedCommitted`.
2. Tarjetas del mes: `summary.amounts.cardCommitted`.
3. Límites variables: suma de `max(limitAmount, spentAmount)` para cada límite, igual que en el cálculo del servidor.
4. Colchón: `summary.plan.arsBufferAmount`.

El desglose debe sumar el valor de `summary.funding.coverageTarget`. Se mostrará en dos columnas en pantallas chicas y cuatro columnas desde tablet/escritorio.

### Aclaración visible

La tarjeta incluirá una nota breve:

> Es el plan completo del mes, no una deuda pendiente. Incluye fijos y tarjetas aunque ya estén pagados, más los límites variables y el colchón.

## Flujo de datos

No se agregan consultas ni escrituras. El componente calcula únicamente el subtotal visual de límites a partir de `summary.limits`; los demás valores ya llegan en el resumen mensual. La barra conserva `fundedArs / coverageTarget`.

## Fuera de alcance

- Crear un indicador de deuda o pagos pendientes reales.
- Agregar estado de pago a períodos de tarjeta.
- Inferir que una tarjeta está pagada por su fecha de vencimiento.
- Cambiar la asignación mensual de boletas, expensas, tarjetas, ingresos o conversiones.
- Modificar Firestore, rutas API o el cálculo financiero del servidor.

## Verificación

- Ejecutar la suite de pruebas existente para confirmar que el cálculo no cambió.
- Ejecutar el build de producción para validar tipos y renderizado.
- Revisar que el desglose cierre exactamente con `coverageTarget` para el caso de la captura.
- Confirmar que el ocultamiento de importes también se aplique a los cuatro subtotales nuevos.
- Confirmar que la tarjeta sea legible en mobile y desktop.
