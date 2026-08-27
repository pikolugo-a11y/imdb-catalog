# PikoQuality — intentionally deferred finalization

The following work is intentionally not completed during the frontend checkpoint because it depends on the final validated PikoQuality 2.0 formula.

## Explainability
Audit change 7 requires the score explanation to come from the same domain calculation as the score. Do not reconstruct explanations in page components. When C5 or a successor is promoted to the Individual flow, persist/return its exact components (video, audio, storage efficiency, historical context, density/profile factors, limiting factors, formula_version) and render those components on demand.

## Production formula
Do not replace the currently deployed `QUALITY_VERSION` / score implementation merely to finish the frontend. First revalidate frozen C5 on a materially larger Phase 1 snapshot. Promote only after explicit validation.

## Batch / Railway
Do not modify Batch/Railway formula in advance. After the Individual formula is promoted and regression-tested, make Individual and Batch consume one shared calculation and run parity fixtures.
