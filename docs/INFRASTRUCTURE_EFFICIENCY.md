# PikoFilm — Política canónica de eficiencia de infraestructura

**Estado:** vigente  
**Ámbito:** Neon PostgreSQL, Vercel y persistencia derivada de PikoFilm

## 1. Principio

PikoFilm debe ser eficiente por diseño. La aplicación debe minimizar transferencia de datos, almacenamiento regenerable y trabajo innecesario de infraestructura sin sacrificar información editorial valiosa, integridad funcional, trazabilidad necesaria ni claridad del modelo.

La optimización no consiste en borrar datos útiles para ahorrar céntimos. Consiste en colocar cada cálculo y cada dato en el lugar correcto, evitar duplicaciones y conservar solo el histórico que aporte valor real.

## 2. Regla de proximidad al dato

PostgreSQL/Neon debe ejecutar siempre que sea razonable:

- filtros;
- `COUNT` y agregaciones;
- `GROUP BY`;
- ordenación;
- paginación;
- cálculos simples de cobertura/estado;
- selección de columnas estrictamente necesarias.

La aplicación no debe traer miles de filas a Node/Vercel para contar, agrupar, filtrar o calcular porcentajes que PostgreSQL puede resolver directamente.

## 3. Transferencia Neon → aplicación

Reglas:

- evitar `SELECT *` salvo necesidad explícita y acotada;
- seleccionar únicamente las columnas utilizadas por la vista/proceso;
- paginar listados grandes;
- usar consultas agregadas para KPIs y resúmenes;
- no cargar universos completos durante render;
- no recalcular Lifecycle masivamente al abrir una pantalla;
- preferir snapshots/read models materializados cuando eviten transferencias o cálculo repetido y su coste de almacenamiento esté justificado;
- evitar N+1: agrupar relaciones mediante joins/agregaciones o consultas por lotes.

## 4. Render y navegación

Abrir una pantalla debe ser fundamentalmente una operación de lectura barata.

No se permiten como comportamiento normal de render:

- enriquecimientos externos masivos;
- recorridos completos del catálogo;
- reanálisis de Plex;
- backfills;
- recalculados masivos de PikoScore/PikoQuality/Lifecycle;
- creación implícita de históricos o snapshots costosos.

Los procesos pesados deben ejecutarse explícitamente y de forma unitaria o mediante mantenimiento/backfill justificado según la arquitectura Lifecycle.

## 5. Almacenamiento

Antes de crear una tabla, histórico, snapshot, cache o columna duplicada debe responderse:

1. ¿es dato canónico, derivado o regenerable?;
2. ¿qué funcionalidad depende de conservarlo?;
3. ¿puede reconstruirse de forma barata y fiable?;
4. ¿necesita retención indefinida?;
5. ¿duplica datos existentes?;

Reglas:

- los datos editoriales valiosos y correcciones manuales se conservan;
- cachés, artefactos regenerables y diagnósticos temporales deben tener retención o estrategia de limpieza cuando crezcan;
- no persistir respuestas externas brutas si bastan campos escalares útiles;
- no almacenar imágenes/binarios cuando una referencia estable sea suficiente;
- no crear una segunda fuente de verdad para acelerar una pantalla.

## 6. Índices

Cada índice nuevo debe estar justificado por una consulta real o una restricción necesaria.

- revisar índices duplicados o solapados antes de crear nuevos;
- comprobar uso y coste antes de eliminar un índice existente;
- recordar que los índices también consumen almacenamiento y aumentan coste de escritura;
- preferir el mínimo conjunto de índices que soporte correctamente las consultas canónicas.

## 7. Históricos y observabilidad

`pipeline_runs`, `plex_sync_runs`, `admin_events` y otros registros operativos deben conservar trazabilidad suficiente sin convertirse en almacenes ilimitados.

Cuando su volumen crezca de forma material debe definirse una política de retención que preserve:

- errores relevantes;
- últimas ejecuciones;
- información necesaria para diagnóstico/auditoría;

sin conservar indefinidamente detalle operativo regenerable o de poco valor.

## 8. Coste y capacidad

El coste de infraestructura es una restricción arquitectónica, no un objetivo funcional.

PikoFilm debe mantenerse razonablemente pequeño y barato, pero no se debe degradar su objetivo principal para reducir costes marginales. Con carácter general:

- primero eliminar trabajo/transferencia innecesarios;
- después eliminar duplicación/regenerables;
- finalmente valorar compactación/retención;
- nunca borrar información canónica valiosa únicamente para ahorrar una cantidad marginal.

Los límites y precios concretos del proveedor pueden cambiar; esta política no depende de una tarifa específica.

## 9. Criterios de revisión de nuevas funcionalidades

Toda nueva funcionalidad que consulte o persista un volumen significativo debe revisar explícitamente:

- columnas/filas transferidas por petición;
- paginación;
- agregación en SQL;
- posibilidad de N+1;
- tamaño persistido esperado;
- necesidad y número de índices;
- política de retención de datos derivados;
- frecuencia de ejecución;
- impacto en compute y llamadas externas.

## 10. Regla de diagnóstico

Ante crecimiento anormal de coste, transferencia o tamaño:

1. medir antes de borrar;
2. localizar consultas/tablas/índices responsables;
3. corregir primero el patrón arquitectónico;
4. verificar funcionalidad;
5. limpiar datos regenerables únicamente después y de forma segura.

Esta política complementa `TECHNICAL_SPECIFICATION_V2.md` y forma parte de la arquitectura canónica de PikoFilm. `PROJECT_RULES.md` obliga a respetarla mediante la Regla de Oro 19.
