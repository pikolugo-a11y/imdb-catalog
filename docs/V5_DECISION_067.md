# V5-C067 — Motivos legibles de espera/bloqueo de APIs

Estado: APROBADA
Prioridad: P2

Objetivo: hacer comprensible en Operaciones por qué una fuente externa está esperando, reintentando o bloqueada por gobierno de consumo.

Condiciones:
- No cambia la lógica de gobierno de APIs; solo mejora su explicación operativa.
- Mostrar mensajes legibles para el usuario, por ejemplo: límite de peticiones, reintento tras 5xx/429, pausa por protección de consumo o backoff.
- Mantener el detalle técnico disponible al abrir la ejecución, sin convertir la vista principal en ruido.
- Basarse en la evidencia canónica de ejecución/eventos/errores ya existente; no crear una segunda fuente de verdad.
- Debe funcionar para TMDb, IMDb, Watchmode y cualquier otra fuente gobernada.
- Integrarlo en Operaciones y correlacionarlo con la ejecución afectada.
