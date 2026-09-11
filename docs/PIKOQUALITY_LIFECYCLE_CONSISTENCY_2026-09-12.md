# PikoFilm — Consistencia PikoQuality / Lifecycle (2026-09-12)

## Problema auditado

`/calidad` mostraba `10.830 · Seguimiento` en PikoQuality mientras `/calidad/pikoquality` declaraba `Biblioteca evaluada y al día`, cobertura `100%` y 63.218 archivos técnicos vigentes.

La discrepancia era real y tenía dos causas independientes:

1. `lib/lifecycle-recompute-core.mjs` seguía validando PikoQuality contra la versión legacy `1.0.0`, aunque la versión activa es `2.0.0-c6`.
2. La cobertura de `/calidad/pikoquality` sólo usaba como denominador los archivos que ya tenían `plex_technical_state` listo, por lo que los archivos activos todavía sin captura técnica desaparecían del porcentaje.

## Auditoría de datos

En Neon, a 2026-09-12:

- `catalog_lifecycle.TECH_PENDING`: 10.830 títulos.
- C6 sobre archivos con captura técnica lista: 63.218 / 63.218 evaluados, 0 pendientes, 0 errores.
- Al contrastar los 10.830 títulos con la versión activa C6 y la huella técnica canónica:
  - 10.825 eran falsos pendientes por la versión legacy de Lifecycle.
  - 5 películas sí estaban realmente pendientes porque todavía no tenían captura técnica.

Los 5 casos reales eran:

- `tt0075404` — La ascensión
- `tt0093342` — ¿Dónde está la casa de mi amigo?
- `tt27047903` — Scream 7
- `tt33175825` — Attack on Titan: THE LAST ATTACK
- `tt9603208` — Misión: Imposible - Sentencia final

## Regla canónica desde este cambio

PikoQuality se considera vigente sólo cuando existe evidencia técnica vigente y el cálculo corresponde a la versión activa:

- `plex_technical_state.snapshot_status = 'ready'`;
- `technical_fingerprint` no es nulo;
- `piko_quality.status = 'evaluated'`;
- `piko_quality.formula_version = PIKOQUALITY_ACTIVE_VERSION`;
- `piko_quality.source_fingerprint` coincide con `plex_technical_state.technical_fingerprint`.

Un archivo físico activo sin captura técnica **no está evaluado**. Debe aparecer como seguimiento automático y formar parte del denominador de cobertura.

## Cambios funcionales

- Lifecycle deja de usar una constante PikoQuality legacy y consume `PIKOQUALITY_ACTIVE_VERSION`.
- Lifecycle usa `plex_technical_state.technical_fingerprint` como huella técnica canónica.
- La portada `/calidad` corrige temporalmente los `TECH_PENDING` almacenados contra la verdad C6 vigente para no enseñar miles de falsos pendientes mientras exista deuda histórica de reconciliación.
- `/calidad/pikoquality` incluye los archivos activos sin captura técnica en el denominador y distingue `sin captura técnica` de `pendiente de C6`.
- El recálculo C6 individual y cada bloque del Batch C6 reconcilian después el Lifecycle de los títulos afectados para evitar nuevas divergencias.

## Reparación histórica

Este cambio de código no muta automáticamente los 10.825 estados históricos ya persistidos en Neon. La UI queda coherente mediante el read model efectivo y los futuros procesos C6 mantendrán Lifecycle sincronizado.

La reparación masiva de los estados históricos debe ejecutarse de forma explícita y controlada, verificando antes que siguen siendo 10.825 falsos pendientes y preservando los casos realmente pendientes. No se debe realizar como efecto lateral de una lectura ni sin autorización operativa.
