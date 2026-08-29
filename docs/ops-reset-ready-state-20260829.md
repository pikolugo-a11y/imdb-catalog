# OPS-001 · candidato listo tras reinicio

Hallazgo de producción con `tt15281656` tras un reinicio técnicamente correcto:

- el candidato reaparecía en Novedades;
- `eligibility_status` era `eligible`;
- pero `source_snapshot.manual=true` sin `authoritativeStatus='complete'` ni `manualAuthoritativeResolvedAt` hacía que `deriveState()` lo mostrase indefinidamente como `preparing`;
- no había ningún proceso real ejecutándose.

Corrección: el reset recrea el candidato manual como resolución ya completa (`authoritativeStatus='complete'` + `manualAuthoritativeResolvedAt`), manteniendo `eligibility_status='eligible'` y sin disparar procesamiento automático. Así Novedades lo muestra como `Lista` y el usuario puede pulsar `Añadir` para recorrer el circuito real.
