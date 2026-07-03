# Tolva - Update de presupuesto, gastos fijos e ingresos en USD/USDT

## Contexto

Tolva ya fue simplificada hacia un modelo más útil:

- pantalla principal **Mi mes**;
- disponible real;
- ahorro reservado;
- cuotas comprometidas;
- límites variables;
- importación de comprobantes;
- cierre mensual.

Esta actualización busca ordenar tres puntos clave que aparecieron después de probar el nuevo flujo:

1. Los **gastos fijos** deberían venir preconfigurados con los gastos habituales.
2. Las **facturas/boletas importadas** deberían actualizar esos gastos fijos automáticamente, pero preguntando o detectando el período.
3. Los **ingresos reales** están dolarizados, por lo que Tolva debe manejar USD/USDT como origen, pero seguir presupuestando en ARS.

---

## 1. Gastos fijos preconfigurados

Actualmente existe un modal para agregar gastos fijos manualmente. Eso está bien, pero no debería empezar vacío para un usuario que ya tiene gastos recurrentes claros.

### Objetivo

Al entrar a **Mi presupuesto / Configuración**, Tolva debería mostrar gastos fijos habituales ya creados o sugeridos.

### Gastos fijos iniciales sugeridos

```txt
Expensas
Hominis
Luz
Gas
Agua
ABL
Telecentro
La Meridional
Celular
```

### Valores iniciales estimados

```txt
Expensas: $201.339
Hominis: $131.198
Luz: $70.564
Gas: $13.778
Agua: $30.718
ABL: $20.800
Telecentro: $18.377
La Meridional: $12.651
Celular: $6.000
```

> Nota: estos valores deben poder editarse manualmente.

### Categorías recomendadas

```txt
Expensas → Vivienda
Hominis → Salud
Luz → Servicios
Gas → Servicios
Agua → Servicios
ABL → Impuestos
Telecentro → Servicios
La Meridional → Seguro
Celular → Servicios
```

### UX sugerida

En vez de mostrar:

```txt
Todavía no configuraste gastos fijos.
```

Mostrar:

```txt
Gastos fijos sugeridos

✓ Expensas
✓ Hominis
✓ Luz
✓ Gas
✓ Agua
✓ ABL
✓ Telecentro
✓ La Meridional
✓ Celular
```

Y permitir:

- activar/desactivar;
- editar monto estimado;
- editar día de vencimiento;
- editar regla de actualización;
- eliminar;
- agregar otro gasto fijo.

---

## 2. Actualización automática de gastos fijos mediante facturas

Cuando el usuario importa una boleta o factura, Tolva debe intentar asociarla a un gasto fijo existente.

### Flujo ideal

```txt
Importar factura
↓
Tolva detecta proveedor
↓
Tolva detecta importe
↓
Tolva pregunta o detecta período
↓
Tolva registra el gasto
↓
Tolva actualiza el gasto fijo estimado
↓
Tolva marca el servicio como pagado para ese período
```

### Ejemplo

```txt
Factura importada: Edenor / Edesur
Importe detectado: $70.564
Período detectado: Junio 2026
Tipo de período: Mensual / Bimestral

Acciones:
✓ Registrar gasto en junio
✓ Actualizar gasto fijo "Luz"
✓ Marcar Luz como pagada
```

---

## 3. Períodos de facturación

Algunas facturas pueden ser mensuales y otras bimestrales. Tolva no debe asumir siempre que una factura corresponde a un solo mes.

### Campo nuevo recomendado

```ts
type BillingPeriodType = "monthly" | "bimonthly" | "custom"
```

En cada gasto fijo:

```ts
type FixedExpense = {
  id: string
  name: string
  category: string

  estimatedAmount: number
  dueDay?: number

  billingPeriodType: "monthly" | "bimonthly" | "custom"

  updateMode: "manual" | "last_invoice" | "average_3" | "average_6"

  isActive: boolean
}
```

### Al importar una factura

Tolva debería mostrar una confirmación:

```txt
Detectamos esta factura:

Proveedor: Edesur
Importe: $70.564
Período: Junio/Julio 2026
Tipo: Bimestral

¿Cómo querés imputarla?

( ) Todo al mes de vencimiento
( ) Dividir entre los meses del período
( ) Elegir manualmente
```

### Reglas recomendadas

#### Factura mensual

Se imputa completa al mes correspondiente.

```txt
Luz junio 2026
$70.564
```

#### Factura bimestral

Por defecto, ofrecer dividir entre los dos meses, pero dejar que el usuario elija.

```txt
Edesur junio-julio
$70.564

Opción recomendada:
$35.282 en junio
$35.282 en julio
```

### Importante

Aunque se divida contablemente entre meses, el pago real puede ocurrir en un solo mes. Por eso conviene guardar dos conceptos distintos:

- **período de consumo**;
- **fecha de pago/vencimiento**.

---

## 4. Modos de actualización automática

El campo actual "Actualización automática" está bien, pero debería tener opciones más útiles.

### Opciones sugeridas

```txt
Manual
Última factura
Promedio últimos 3 meses
Promedio últimos 6 meses
```

### Uso recomendado

```txt
Expensas → Última factura o promedio 3 meses
Luz → Promedio 3 o 6 meses
Gas → Promedio 6 meses
Agua → Última factura
ABL → Última factura
Hominis → Última factura
Telecentro → Última factura
Celular → Manual
```

---

## 5. Límites variables simplificados

No conviene mostrar todas las categorías en límites variables. Solo deberían aparecer las categorías que realmente se pueden controlar durante el mes.

### Categorías variables recomendadas

```txt
Compra
Salidas
Comida comprada
Hobbies
Transporte
Otros
Gatos
Salud
Fútbol
```

### Categorías a eliminar u ocultar de límites variables

```txt
Lotería
Tarjeta
Servicios
```

### Razón

- **Lotería:** ya no se usa.
- **Tarjeta:** no es una categoría real de gasto, es un medio de pago.
- **Servicios:** debería manejarse como gasto fijo, no como variable.

### Presupuestos iniciales sugeridos

```txt
Compra: $320.000
Salidas: $100.000
Comida comprada: $60.000
Hobbies: $100.000
Transporte: $30.000
Otros: $50.000
Gatos: $80.000
Salud: $70.000
Fútbol: $40.000
```

---

## 6. Objetivos financieros

Agregar una sección simple de objetivos financieros.

### Primer objetivo recomendado

```txt
Fondo de emergencia

Meta inicial: $1.500.000
Meta futura: $3.000.000
Ahorro actual aproximado: $150.000
```

### Modelo sugerido

```ts
type FinancialGoal = {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  currency: "ARS" | "USD" | "USDT"
  priority: number
  isActive: boolean
}
```

---

## 7. Ingresos en USD/USDT, presupuesto en ARS

El usuario cobra principalmente en USD/USDT, pero sus gastos cotidianos son en pesos argentinos.

Por eso, Tolva debe separar:

- moneda en la que se cobra;
- moneda en la que se presupuesta;
- conversión efectiva a ARS.

### Moneda principal del presupuesto

```txt
ARS
```

Todos los cálculos principales de **Mi mes** deben seguir en pesos:

- ingreso convertido;
- gastos fijos;
- cuotas;
- variables;
- ahorro reservado;
- disponible real;
- disponible diario.

### Fuentes de ingreso

Agregar configuración de ingresos recurrentes.

```txt
Argentek sueldo base
USD 650

Integra sueldo base
USDT 800

Argentek comisiones
USD variable
```

### Modelo sugerido

```ts
type IncomeSource = {
  id: string
  name: string

  currency: "USD" | "USDT" | "ARS"
  expectedAmount: number

  isVariable: boolean
  isActive: boolean
}
```

---

## 8. Registro de conversiones USD/USDT a ARS

El presupuesto mensual no debería tomar simplemente un dólar teórico. Debe usar el tipo de cambio efectivo al momento de convertir.

### Flujo recomendado

```txt
Registrar conversión

Origen:
USDT / USD

Monto:
800

Cotización sugerida:
Binance P2P

Cotización:
$1.485

Monto recibido:
$1.188.000

Guardar conversión
```

### Importante

Tolva ya puede extraer el precio de Binance P2P. Ese valor debería usarse como cotización sugerida, pero siempre editable.

### UX esperada

```txt
Cotización sugerida

Binance P2P
$1.485

[Editar cotización]

Monto convertido
USDT 800

Pesos recibidos
$1.188.000
```

Si el usuario edita la cotización:

```txt
Cotización usada
$1.472

Motivo opcional
Martín me convirtió a este valor
```

### Modelo sugerido

```ts
type CurrencyConversion = {
  id: string
  date: Date

  fromCurrency: "USD" | "USDT"
  fromAmount: number

  suggestedRateSource: "binance_p2p" | "manual" | "other"
  suggestedRate?: number

  usedRate: number
  arsReceived: number

  relatedIncomeSourceId?: string
  note?: string
}
```

### Cálculo

```ts
arsReceived = fromAmount * usedRate
```

---

## 9. Cómo debe impactar la conversión en Mi mes

Cuando el usuario registra una conversión, Tolva debe sumar esos pesos al ingreso real disponible del mes.

### Ejemplo

```txt
Ingresos esperados:
USD 650 + USDT 800 + comisiones variables

Conversiones registradas:
USDT 800 x $1.485 = $1.188.000
USD 650 x $1.480 = $962.000

Ingreso real ARS:
$2.150.000
```

### Card sugerida en Mi mes

```txt
Ingresos del mes

Esperado:
USD 650 + USDT 800 + comisiones

Convertido a ARS:
$2.150.000

Pendiente de convertir:
USD 650
```

---

## 10. Recomendación financiera dentro de la app

La app no debería forzar a convertir todo a pesos.

La lógica recomendada es:

1. Cobrar en USD/USDT.
2. Convertir a ARS solo lo necesario para cubrir:
   - gastos fijos;
   - cuotas;
   - variables presupuestadas;
   - colchón chico en pesos.
3. Mantener el resto en USD/USDT como reserva o ahorro.

### Tolva puede ayudar mostrando

```txt
Necesitás convertir aproximadamente:

$1.650.000

Para cubrir:
• gastos fijos
• cuotas
• variables presupuestadas
• colchón en pesos
```

Y luego:

```txt
Te quedarían sin convertir:

USD 300
USDT 250
```

Esta recomendación es informativa, no obligatoria.

---

## 11. Cambios concretos en Configuración / Mi presupuesto

Renombrar la sección actual:

```txt
Configuración
```

a:

```txt
Mi presupuesto
```

Dejar "Configuración" real para cosas de app:

- tema;
- moneda visual;
- cuenta;
- exportaciones;
- preferencias.

### Secciones de Mi presupuesto

```txt
1. Ingresos
2. Objetivo de ahorro
3. Gastos fijos
4. Límites variables
5. Objetivos financieros
6. Reglas de importación
```

---

## 12. Reglas de importación

Agregar una sección para definir comportamiento automático.

### Opciones

```txt
✓ Actualizar gastos fijos al importar boletas
✓ Detectar período de facturación
✓ Preguntar si la factura es mensual o bimestral cuando no esté claro
✓ Detectar cuotas automáticamente
✓ Detectar suscripciones automáticamente
✓ Recordar servicios sin registrar
✓ Usar Binance P2P como cotización sugerida en conversiones
```

---

## 13. Alcance de esta update

### Prioridad alta

- Gastos fijos preconfigurados.
- Período de facturación mensual/bimestral/custom.
- Importación de boletas actualizando gastos fijos.
- Límites variables simplificados.
- Ingresos en USD/USDT.
- Registro de conversiones con cotización Binance P2P editable.
- Objetivo financiero "Fondo de emergencia".

### Prioridad media

- Card de ingresos convertidos/pendientes.
- Recomendación de cuánto convertir a ARS.
- Modos de actualización por promedio.
- Recordatorio de servicios sin registrar.

### Fuera de alcance por ahora

- Simulador de compras.
- IA financiera.
- Inversiones avanzadas.
- Multiusuario.
- Predicción compleja de tipo de cambio.
- Automatización completa sin confirmación del usuario.

---

## 14. Criterio de éxito

Esta update está completa si Tolva puede responder claramente:

```txt
¿Cuánto dinero real tengo disponible en pesos este mes?
```

```txt
¿Cuánto de mis USD/USDT ya convertí?
```

```txt
¿Cuánto necesito convertir para cubrir el mes?
```

```txt
¿Qué gastos fijos ya están pagados y cuáles faltan?
```

```txt
¿Mis límites variables tienen sentido o estoy usando categorías que ya no aplican?
```

La app debe mantener el foco principal:

> Ayudar al usuario a ahorrar más y tomar decisiones financieras más claras, sin volver a convertirse en un panel complejo de métricas.
