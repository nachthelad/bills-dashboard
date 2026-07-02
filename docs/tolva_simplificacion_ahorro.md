# Tolva - Simplificación orientada a ahorro

## Objetivo

Convertir Tolva en una app más simple y accionable para controlar gastos mensuales y ayudar a ahorrar más, evitando que se convierta en un panel lleno de datos difíciles de interpretar.

La app no debería responder solamente "cuánto gasté", sino principalmente:

- cuánto puedo gastar de acá a fin de mes;
- cuánto ya tengo comprometido;
- si voy bien o mal contra mi objetivo de ahorro;
- qué gastos variables conviene frenar primero.

## Problema actual

Tolva ya permite registrar gastos, cuotas y períodos, pero la información puede sentirse dispersa o demasiado detallada. El usuario termina viendo muchos números, categorías y movimientos, pero no necesariamente obtiene una respuesta clara para tomar decisiones diarias.

Ejemplo real de uso:

- Ingreso mensual base aproximado: $2.184.000 ARS.
- No hay alquiler.
- Gastos fijos importantes: expensas, servicios, prepaga, internet, seguro, ABL y celular.
- Hay cuotas activas en tarjeta Galicia y Mercado Pago.
- El problema principal no parece ser un gasto fijo enorme, sino muchos gastos variables medianos: compras, salidas, delivery, hobbies, comida comprada, tarjetas y cuotas.

## Principio de diseño

Tolva debería pasar de ser una app de registro a ser una app de decisión.

Menos gráficos.
Menos pantallas.
Más respuestas claras.

La pantalla principal tiene que responder en 5 segundos:

1. ¿Cuánto cobré o espero cobrar este mes?
2. ¿Cuánto quiero ahorrar sí o sí?
3. ¿Cuánto ya está comprometido?
4. ¿Cuánto me queda realmente disponible?
5. ¿Cuánto puedo gastar por día sin pasarme?

## Nueva pantalla principal: "Mi mes"

La home debería ser un dashboard simple con una sola tarjeta principal.

### Datos principales

```txt
Ingreso esperado
$2.184.000

Ahorro objetivo
$436.800

Gastos fijos
$484.000

Cuotas comprometidas
$344.611

Disponible real
$918.589

Quedan 22 días
Podés gastar $41.754 por día
```

### Estados visuales

Mostrar un estado claro:

```txt
Vas bien
Estás justo
Te estás pasando
```

No hace falta mostrar demasiados gráficos. Un indicador grande y claro es mejor.

Ejemplo:

```txt
Disponible real: $918.589
Gasto diario recomendado: $41.754
Hoy gastaste: $18.200

Estado: Vas bien
```

## Fórmula central

La lógica principal de Tolva debería girar alrededor de esta fórmula:

```ts
disponibleReal =
  ingresosDelMes
  - ahorroObjetivo
  - gastosFijosEstimados
  - cuotasComprometidas
  - gastosVariablesYaRealizados
```

Luego:

```ts
gastoDiarioDisponible = disponibleReal / diasRestantesDelMes
```

Esto debería ser el corazón de la app.

## Nuevas entidades sugeridas

### MonthlyBudget

Representa el presupuesto de un mes.

```ts
type MonthlyBudget = {
  id: string
  userId: string
  month: string // "2026-07"

  expectedIncome: number
  savingsGoal: number

  fixedExpensesEstimate: number
  committedInstallmentsEstimate: number

  createdAt: Date
  updatedAt: Date
}
```

### FixedExpense

Gasto fijo mensual o recurrente.

```ts
type FixedExpense = {
  id: string
  userId: string

  name: string
  category: "housing" | "services" | "health" | "insurance" | "taxes" | "phone" | "other"

  estimatedAmount: number
  dueDay?: number

  source?: "manual" | "galicia" | "mercadopago"
  isActive: boolean
}
```

Ejemplos reales:

```txt
Expensas: $180.000
Hominis: $131.198
Luz: $70.564
Agua: $30.718
ABL: $20.800
Telecentro: $18.377
Gas: $13.778
La Meridional: $12.651
Celular: $6.000
```

### SavingsGoal

Objetivo de ahorro mensual.

```ts
type SavingsGoal = {
  id: string
  userId: string

  month: string
  targetAmount: number
  mode: "fixed" | "percentage"

  percentage?: number // ejemplo: 20
  amount?: number // ejemplo: 436800
}
```

Regla recomendada inicial:

```txt
Ahorro objetivo = 20% del ingreso base
```

Para un ingreso de $2.184.000:

```txt
$436.800
```

### SpendingLimit

Límites por categoría variable.

```ts
type SpendingLimit = {
  id: string
  userId: string
  month: string

  categoryId: string
  limitAmount: number
}
```

Ejemplo de límites iniciales:

```txt
Compra / supermercado: $320.000
Salidas: $100.000
Comida comprada / delivery: $60.000
Hobbies: $100.000
Otros: $50.000
Gatos: $80.000
Transporte: $30.000
```

## Simplificación de categorías

Actualmente muchas categorías pueden mezclarse. Conviene separar en tres grupos grandes.

### 1. Fijos

Gastos que se pagan todos los meses y no se deciden día a día.

- Expensas
- Luz
- Gas
- Agua
- ABL
- Internet
- Celular
- Prepaga
- Seguro

### 2. Comprometidos

Gastos que ya vienen de decisiones anteriores.

- Cuotas Galicia
- Cuotas Mercado Pago
- Compras financiadas
- Suscripciones en tarjeta

### 3. Variables

Gastos que sí se pueden ajustar durante el mes.

- Supermercado
- Delivery
- Salidas
- Hobbies
- Transporte
- Compras impulsivas
- Juegos
- Perfumes
- Cartas Pokémon
- Tecnología chica

Esta división debería estar presente en la UI.

## Nueva navegación sugerida

Reducir la navegación a 4 secciones principales.

```txt
1. Mi mes
2. Movimientos
3. Cuotas
4. Configuración
```

### Mi mes

Pantalla principal con:

- ingreso esperado;
- ahorro objetivo;
- gasto fijo estimado;
- cuotas comprometidas;
- disponible real;
- gasto diario recomendado;
- alerta de estado.

### Movimientos

Lista simple de gastos del mes.

Debe permitir:

- agregar gasto rápido;
- editar gasto;
- asignar categoría;
- marcar si fue efectivo, débito, crédito Galicia, crédito Mercado Pago u otro medio.

### Cuotas

Pantalla actual de cuotas, pero enfocada en el impacto mensual.

Debe mostrar:

```txt
Julio 2026: $194.968 Mercado Pago + $424.388 Galicia aprox.
Agosto 2026: $149.643 Mercado Pago + $266.795 Galicia aprox.
Septiembre 2026: ...
```

La prioridad es saber cuánto del próximo sueldo ya está comprometido.

### Configuración

Acá van:

- ingresos base;
- objetivo de ahorro;
- gastos fijos recurrentes;
- categorías;
- medios de pago;
- importación de PDF o resumen;
- preferencias.

## Alertas útiles

Tolva debería alertar cuando haya algo accionable.

### Alertas sugeridas

```txt
Ya gastaste el 80% de tu presupuesto de salidas.
```

```txt
Tu gasto diario recomendado bajó a $24.000.
```

```txt
Este mes ya no conviene comprar hobbies si querés cumplir el ahorro.
```

```txt
Tenés $344.611 comprometidos en cuotas para el mes que viene.
```

```txt
Te falta registrar si pagaste ABL este mes.
```

## Fondo de emergencia

Agregar una sección simple para fondo de emergencia.

### Meta inicial

```txt
Meta 1: $1.500.000
Meta 2: $3.000.000
```

### Estado actual

```txt
Ahorro actual aproximado: $150.000
Progreso meta 1: 10%
```

### Lógica

```ts
emergencyFundProgress = currentSavings / emergencyFundTarget
```

La app podría mostrar:

```txt
Si ahorrás $436.800 por mes, llegás a $1.500.000 en aproximadamente 4 meses.
```

## Cambios de UI

### Home actual

Evitar que la home sea principalmente un gráfico de gastos.

### Home propuesta

Una tarjeta principal tipo:

```txt
Julio 2026

Ingreso esperado
$2.184.000

Ahorro reservado
$436.800

Ya comprometido
$828.611

Disponible real
$918.589

Podés gastar
$41.754 por día

Estado
Vas bien
```

Debajo, solo tres cards:

```txt
Variables del mes
$XXX / $XXX

Cuotas próximas
$XXX

Fondo de emergencia
$150.000 / $1.500.000
```

## Features que conviene NO priorizar ahora

Para simplificar, evitar por ahora:

- demasiados gráficos;
- comparativas anuales complejas;
- dashboards con muchos porcentajes;
- demasiados filtros;
- reportes avanzados;
- predicciones con IA;
- múltiples monedas complejas;
- gamificación;
- presupuestos ultra detallados por subcategoría.

Primero tiene que servir para una cosa: gastar menos y ahorrar más.

## MVP de cambios

### Fase 1 - Modelo mental nuevo

- Crear pantalla "Mi mes".
- Agregar ingreso esperado mensual.
- Agregar objetivo de ahorro mensual.
- Calcular disponible real.
- Calcular gasto diario recomendado.
- Mostrar estado simple.

### Fase 2 - Gastos fijos

- Crear CRUD de gastos fijos.
- Permitir marcarlos como activos/inactivos.
- Sumarlos automáticamente al mes.
- Mostrar si falta registrar/pagar alguno.

### Fase 3 - Cuotas comprometidas

- Consolidar cuotas de Galicia y Mercado Pago.
- Mostrar total comprometido por mes.
- Separar cuotas de gastos variables.

### Fase 4 - Límites variables

- Agregar límites por categoría variable.
- Mostrar porcentaje usado.
- Alertar al 80% y 100%.

### Fase 5 - Fondo de emergencia

- Agregar objetivo de fondo de emergencia.
- Mostrar progreso.
- Calcular fecha estimada para llegar a la meta.

## Ejemplo de implementación progresiva

### Paso 1

Crear una función pura para calcular el presupuesto mensual.

```ts
type BudgetInput = {
  expectedIncome: number
  savingsGoal: number
  fixedExpenses: number
  committedInstallments: number
  variableSpent: number
  remainingDays: number
}

export function calculateMonthlyBudget(input: BudgetInput) {
  const available =
    input.expectedIncome -
    input.savingsGoal -
    input.fixedExpenses -
    input.committedInstallments -
    input.variableSpent

  const dailyAvailable =
    input.remainingDays > 0 ? available / input.remainingDays : available

  let status: "good" | "tight" | "over" = "good"

  if (available < 0) status = "over"
  else if (dailyAvailable < 20000) status = "tight"

  return {
    available,
    dailyAvailable,
    status,
  }
}
```

### Paso 2

Crear tests para esa función.

```ts
import { test } from "node:test"
import assert from "node:assert"
import { calculateMonthlyBudget } from "@/lib/budget"

test("calculates available monthly budget", () => {
  const result = calculateMonthlyBudget({
    expectedIncome: 2184000,
    savingsGoal: 436800,
    fixedExpenses: 484000,
    committedInstallments: 344611,
    variableSpent: 0,
    remainingDays: 22,
  })

  assert.equal(result.available, 918589)
  assert.equal(Math.round(result.dailyAvailable), 41754)
  assert.equal(result.status, "good")
})
```

### Paso 3

Usar esa función en la pantalla principal.

La UI debería consumir números ya calculados, no recalcular todo mezclado dentro del componente.

## Criterio de éxito

Tolva está mejor si al abrirla podés responder:

```txt
¿Puedo comprar esto hoy sin romper mi objetivo de ahorro?
```

Y la app te responde de forma simple:

```txt
Sí, seguís dentro del presupuesto.
```

o

```txt
No conviene. Si comprás esto, tu gasto diario recomendado baja a $18.000.
```

## Nota final

La idea no es transformar Tolva en una app financiera compleja. La idea es que funcione como un copiloto personal de gasto mensual.

Registrar gastos es secundario.
La prioridad es decidir mejor antes de gastar.


## Importación de información (se mantiene)

Una de las fortalezas actuales de Tolva es la carga de información mediante gastos manuales, boletas y resúmenes de tarjetas. **Esta funcionalidad NO debe eliminarse**, sino cambiar de rol.

La importación deja de ser el centro de la aplicación y pasa a ser la forma de alimentar automáticamente el presupuesto mensual.

### Nueva navegación propuesta

```txt
🏠 Mi mes
💳 Movimientos
📥 Importar
📅 Cuotas
⚙️ Configuración
```

### Pantalla "Importar"

Desde acá el usuario puede:

- Agregar gasto manual.
- Importar resumen de tarjeta Galicia.
- Importar resumen de Mercado Pago.
- Importar boleta de Luz.
- Importar boleta de Gas.
- Importar boleta de Agua.
- Importar Telecentro.
- Importar ABL.
- Agregar cualquier otro comprobante.

### Qué debería hacer Tolva automáticamente

#### Gastos manuales

Se registran como movimientos normales.

#### Boletas de servicios

Además de registrar el gasto, deberían:

- actualizar el monto estimado del gasto fijo;
- marcar el servicio como "pagado";
- utilizar ese importe como referencia para el próximo mes.

Ejemplo:

```txt
Importo la factura de Edenor.

Tolva:
✓ Registró el gasto.
✓ Marcó Luz como pagada.
✓ Actualizó el gasto fijo estimado.
```

#### Resúmenes de tarjeta

El parser debería intentar clasificar automáticamente los movimientos.

Por ejemplo:

```txt
Telecentro → Gasto fijo
Hominis → Gasto fijo
La Meridional → Gasto fijo
ChatGPT → Suscripción
Prime Video → Suscripción
CompraGamer cuota → Cuota comprometida
Mercado Libre cuota → Cuota comprometida
Burger King → Comida comprada
Carrefour → Compra
Uber → Transporte
```

El usuario solamente corrige las excepciones.

### Objetivo

La pantalla "Mi mes" nunca debería requerir carga manual de datos.

El flujo ideal sería:

```txt
Importo boletas
↓

Importo resumen Galicia
↓

Importo Mercado Pago
↓

Tolva clasifica automáticamente

↓

Actualiza:

• Gastos fijos
• Cuotas
• Gastos variables
• Disponible real
• Gasto diario recomendado
```

De esta forma, el verdadero valor de Tolva no es importar PDFs, sino transformar esa información en decisiones financieras simples.


## Cierre mensual (Feature destacada)

El primer día de cada mes, antes de mostrar el dashboard del nuevo mes, Tolva debería presentar automáticamente un **Cierre mensual** del período anterior.

Ejemplo:

- Durante julio, la aplicación muestra únicamente información de julio.
- El 1° de agosto, al abrir la app, aparece el **Cierre de julio**.
- Una vez que el usuario lo cierra, entra normalmente al dashboard de agosto.

### Objetivo

No mostrar solo números, sino ayudar al usuario a entender:

- qué hizo bien;
- dónde se pasó del presupuesto;
- si cumplió su objetivo de ahorro;
- cómo mejorar el mes siguiente.

### Ejemplo

```txt
JULIO 2026

Ingresos
$2.184.000

Gastaste
$1.645.300

Ahorraste
$538.700

Objetivo de ahorro
$436.800

✔ Superaste tu objetivo en $101.900
```

### Comparación con el mes anterior

Mostrar únicamente los cambios relevantes.

```txt
Compra
+9%

Delivery
-34%

Salidas
+14%

Transporte
-5%

Ahorro
+18%
```

### Lo mejor del mes

```txt
✓ Bajaste el gasto en delivery.

✓ No agregaste nuevas cuotas.

✓ Pagaste todos los servicios.

✓ Cumpliste el objetivo de ahorro.
```

### Lo peor del mes

```txt
Compra

Presupuesto:
$320.000

Gastaste:
$401.000

(+25%)
```

### Recomendaciones

Sin necesidad de IA, utilizando reglas simples.

Ejemplos:

```txt
Si mantenés el nivel de ahorro de julio durante 12 meses,
vas a ahorrar aproximadamente $6.400.000.
```

```txt
Reduciendo $15.000 por semana en delivery,
podrías sumar más de $700.000 al año.
```

### Score mensual

Agregar un puntaje simple para que el usuario vea rápidamente cómo fue el mes.

```txt
JULIO

Ahorro
★★★★★

Presupuesto
★★★★☆

Compras impulsivas
★★★☆☆

Gastos fijos
★★★★★

Resultado general

8.7 / 10
```

El objetivo no es gamificar la aplicación, sino generar una referencia fácil de entender y motivar mejoras continuas.

### Filosofía

Durante el mes, Tolva actúa como un copiloto financiero.

Al comenzar el siguiente mes, Tolva actúa como un analista financiero personal.

De esta manera, el usuario siempre tiene foco en el presente, pero también aprende de sus hábitos pasados sin tener que buscar reportes manualmente.


---

# Roadmap futuro (Fuera del MVP)

> **Importante:** Las siguientes ideas **NO forman parte del alcance inicial**. Solo deberían comenzar una vez que el nuevo flujo de presupuesto mensual esté completamente estable y probado.

## Simulador de compras ("¿Puedo comprarlo?")

Una vez consolidado el nuevo modelo de presupuesto, Tolva puede incorporar un simulador de compras.

### Objetivo

Antes de realizar una compra, el usuario puede simular su impacto sobre sus finanzas del mes.

Ejemplo:

```txt
Producto
Corsair 4000D

Precio
$130.000
```

Tolva calcula automáticamente:

- cuánto disminuye el disponible real;
- cómo cambia el gasto diario recomendado;
- si todavía se cumple el objetivo de ahorro;
- si afecta el fondo de emergencia;
- si la compra compromete gastos fijos o cuotas.

### Ejemplo de respuesta

```txt
Después de la compra

Disponible diario

Antes:
$41.754

Después:
$35.845

Objetivo de ahorro

✔ Sigue cumpliéndose

Fondo de emergencia

Pasa del 10% al 2%

Recomendación

✔ Compra razonable este mes.
```

O bien:

```txt
⚠ Esta compra retrasa aproximadamente 3 meses tu objetivo de fondo de emergencia.
```

### Filosofía

Tolva **no decide por el usuario**.

Simplemente muestra las consecuencias de la compra para que la decisión sea consciente.

## Prioridad

Esta funcionalidad debe considerarse una **Fase 6** o posterior.

Antes de implementarla deben estar terminadas:

- Pantalla "Mi mes".
- Presupuesto mensual.
- Gastos fijos.
- Cuotas.
- Límites por categoría.
- Cierre mensual.

Solo cuando el núcleo de la aplicación esté sólido tiene sentido agregar simulaciones de compra.
