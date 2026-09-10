# PikoFilm V5 — Decisión 056

## Mejora 56 · V5-C056 — Activar `pg_stat_statements` para analizar consultas SQL reales

**Estado:** APROBADA  
**Prioridad definitiva:** P1.  
**Categoría:** Neon · Rendimiento · Observabilidad SQL · Diagnóstico

**Problema detectado**

Para optimizar PikoFilm con precisión conviene saber qué consultas PostgreSQL consumen más tiempo acumulado, cuántas veces se ejecutan y cuáles concentran más carga real. Sin esa visibilidad, algunas optimizaciones de búsqueda, Catálogo, Inicio u Operaciones dependerían demasiado de mediciones parciales o análisis aislados.

**Alcance aprobado**

1. Activar `pg_stat_statements` en el entorno de Neon cuando se implemente este bloque de V5.
2. Usarlo como fuente técnica para identificar consultas de alto coste real por tiempo total, frecuencia y coste medio.
3. Priorizar optimizaciones sobre consultas con impacto demostrado, evitando cambios especulativos.
4. Correlacionar sus hallazgos con las mejoras ya aprobadas de rendimiento y búsqueda cuando resulte útil.
5. No convertir `pg_stat_statements` en una nueva fuente funcional de verdad: será una herramienta de diagnóstico técnico.
6. Definir un uso prudente de la información obtenida y evitar exponer SQL sensible o payloads innecesarios en la interfaz.
7. Si la activación requiere parámetros o reinicios con impacto operativo, planificarla de forma segura y dejar trazabilidad técnica en Operaciones.

**Autorización explícita del usuario**

El usuario ha aprobado expresamente esta mejora y, con ello, autoriza la activación de la extensión `pg_stat_statements` como parte de V5. Esta autorización se limita a esta extensión y no implica permiso general para instalar otras extensiones PostgreSQL.

**Resultado esperado para el usuario**

PikoFilm podrá detectar con datos reales qué consultas están generando más carga en Neon y orientar las optimizaciones hacia los puntos que realmente importan, reduciendo tiempo y coste sin introducir índices o cambios de arquitectura por intuición.

**Decisión del usuario:** aprobada con autorización explícita para activar `pg_stat_statements`.
