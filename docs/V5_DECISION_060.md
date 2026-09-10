# PikoFilm V5 — Decisión 060

## Mejora 60 · V5-C060 — Optimizar `person_filmography` y `movie_credits`

**Estado:** APROBADA  
**Prioridad definitiva:** P1  
**Categoría:** Neon · Rendimiento · Personas · Filmografía · Datos

### Problema detectado

`person_filmography` y `movie_credits` están entre las tablas grandes de Neon y participan en búsquedas de personas, fichas y relaciones entre títulos, reparto y equipo. Su tamaño y patrón de uso justifican revisar si existen consultas, joins o estructuras que estén haciendo más trabajo del necesario.

### Alcance aprobado

1. Medir primero las consultas reales que usan `person_filmography` y `movie_credits`, incluyendo tiempos, planes, filas examinadas y frecuencia cuando esté disponible.
2. Identificar cuellos de botella concretos en búsquedas de personas, fichas y navegación por filmografías/créditos.
3. Optimizar consultas, joins, acceso por índices y posibles duplicidades de trabajo antes de plantear cambios de modelo.
4. No modificar el modelo de datos por intuición ni por tamaño bruto de tabla; cualquier cambio estructural deberá estar respaldado por evidencia clara y beneficio medible.
5. Preservar exactamente la semántica funcional de créditos, reparto, dirección, filmografías y relaciones entre títulos y personas.
6. Coordinar esta mejora con V5-C025, V5-C023 y las optimizaciones generales de carga aprobadas para evitar soluciones duplicadas.
7. Si se añaden, modifican o retiran índices, aplicar las reglas ya aprobadas en V5-C050, V5-C057 y V5-C058: consumidor real, medición, verificación de planes y ausencia de solapamientos innecesarios.
8. Comparar antes/después con consultas representativas y mantener sólo cambios con beneficio objetivo y sin regresiones funcionales.

### Observabilidad

Los cambios técnicos relevantes, migraciones o incidencias durante la optimización deberán quedar trazados en **Operaciones**. No se generará ruido en **Actividad** por simples mediciones o ajustes internos sin consecuencia funcional visible.

### Resultado esperado para el usuario

Las búsquedas y fichas relacionadas con actores, directores y filmografías deberán responder más rápido y con menos coste en Neon, manteniendo exactamente los mismos datos y relaciones funcionales.

**Decisión del usuario:** aprobada.
