# PikoQuality B — piloto técnico

Piloto temporal ligado a la issue #44 para comprobar qué metadata de streams devuelve realmente el Plex del usuario antes de congelar el modelo de Fase B.

## Qué hace

- Selecciona una muestra representativa de 12 elementos físicos desde Neon:
  - películas 1080p HEVC;
  - películas 1080p H.264;
  - películas SD;
  - episodios antiguos;
  - episodios intermedios;
  - episodios modernos HD/Full HD.
- Consulta únicamente el detalle de esos `rating_key` en Plex.
- Compara el resumen técnico ya persistido (Fase A) con `Media -> Part -> Stream` devuelto por Plex.
- Mide cobertura real de:
  - streams de vídeo/audio/subtítulos;
  - bitrate por stream;
  - bit depth;
  - color space/chroma;
  - señales HDR/Dolby Vision;
  - múltiples pistas de audio.
- No persiste streams ni modifica el inventario Plex.
- No registra rutas de archivo ni secretos.
- Guarda únicamente el resultado seguro del piloto en `pipeline_runs` con `job_type=pikoquality_b_probe`.

## Ejecución

Ruta temporal: `/admin/pikoquality-probe`.

El usuario ejecuta manualmente `Ejecutar piloto B` una vez desplegado el commit correspondiente. Los resultados se usan para decidir qué campos merece la pena incorporar a la Fase B definitiva.

## Cierre

Esta ruta es diagnóstica. Al completar la validación de #44 debe eliminarse o convertirse en la acción definitiva de enriquecimiento técnico, evitando mantener herramientas temporales sin propósito operativo.
