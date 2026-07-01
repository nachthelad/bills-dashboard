# Estado en español en el detalle de documentos

## Objetivo

Mostrar en español el estado y la acción de procesamiento dentro de
`/documents/[id]`, con el mismo vocabulario utilizado en la lista de documentos.

## Alcance

- Cambiar `Parsing...` por `Procesando...`.
- Traducir únicamente la presentación del estado:
  - `pending` → `Pendiente`
  - `parsed` → `Procesado`
  - `needs_review` → `Requiere revisión`
  - `paid` → `Pagado`
  - `error` → `Error`
- Mantener sin cambios los valores internos, contratos de API y datos guardados.

## Implementación

La página de detalle definirá una traducción explícita para los estados admitidos
por el modelo del documento y la utilizará en el encabezado. El botón conservará
su comportamiento actual y cambiará solamente el texto visible mientras procesa.

## Validación

- Ejecutar la comprobación de tipos o lint disponible para el archivo.
- Confirmar que el detalle no muestre valores de estado en inglés.
- Confirmar que el estado interno siga siendo el valor original en inglés.
