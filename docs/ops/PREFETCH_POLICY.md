# Política de prefetch en PikoFilm

PikoFilm no debe precargar de forma especulativa rutas dinámicas de alto fan-out (catálogo, personas, sagas, calidad, novedades u operaciones).

## Regla V4

- Los enlaces persistentes del Shell usan `prefetch={false}`.
- Los listados con muchas entidades usan `NoPrefetchLink` o `Link prefetch={false}`.
- Los enlaces a fichas de títulos o personas no deben provocar cargas hasta que el usuario navegue realmente.
- Esta regla existe para evitar consumo innecesario de Edge Requests/Functions en Vercel.

## Verificación

Tras cada cambio transversal de navegación, revisar logs de producción y comprobar que una visita a un listado no genera ráfagas de rutas hijas no abiertas por el usuario.
