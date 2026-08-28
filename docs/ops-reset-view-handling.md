# OPS-001 · vistas derivadas durante reset

Hallazgo de producción con `tt15281656`: `catalog_read_model` contiene `imdb_id` pero es una vista no actualizable. El reset debe inspeccionarla como dependencia derivada, pero nunca ejecutar `DELETE` sobre ella.

Regla fijada: solo las relaciones `BASE TABLE` entran en la allowlist de limpieza y en la transacción. Las vistas se registran en la traza como `derived_views`. Las tablas base desconocidas siguen bloqueando el reset antes de modificar datos.
