# C1 Content Modeling Guide

> Date: 2026-04-26  
> Device: CubeVi C1 China region / OpenstageAI, device `ZX1393`  
> Purpose: art and procedural modeling rules for making normal Three.js gameplay read clearly on the C1 naked-eye 3D display.

## Core Finding

The C1 rendering pipeline does not require game-specific fake 3D. The game should still be built as a normal 3D game, then rendered through the validated C1 multi-view/interleaving pipeline.

However, content that looks fine on a normal 2D monitor can look flat or weak on the C1 if its geometry is too thin, too top-down, or too uniform. The strongest validated result came from a PBR box because it had:

- Large readable volume.
- Different colors and patterns on every face.
- Strong visible side faces.
- Clear front/back depth within the object.
- Stable opaque materials.
- Slow rotation, making parallax easy for the eye to read.

Therefore the project needs C1-aware modeling, not C1-specific game logic.

## Practical Rule

For C1, exaggerate visual depth in the render model while keeping gameplay collision and movement clean.

Use separate concepts:

- Gameplay shape: hitbox, movement bounds, bullet collision, scoring.
- Visual shape: thicker geometry, offset parts, raised cockpit/armor, colored sides, depth anchors.

A ship can have a compact 2D hitbox but a much deeper visual model.

## Depth Budget

The earlier gameplay test was stable but weak because most objects used only tiny Z differences. The depth-rich baseline became visibly 3D after increasing object thickness and layer spacing.

Current recommended visual layers:

```text
UI / near effects:       z = +32
bullets / pickups:       z = +24
player visual:           z = +16
focal gameplay plane:    z = 0
enemy visual:            z = -12
terrain objects:         z = -32
far background anchors:  z = -58
```

Guidelines:

- Main ships should have visible local thickness, not just layer offsets.
- Player and enemy bodies should be at least `20-40` units deep in visual geometry when their screen footprint is large.
- Use larger depth for slow/stable readable objects; use smaller depth for fast bullets.
- Avoid pushing everything to maximum depth. Excessive depth can cause discomfort, blur, or unstable fusion.
- Keep `parallax=1.00` as the default validated baseline; improve content first before raising parallax.

## Camera

Pure top-down view reduces normal perspective cues. A slight 3/4 top-down camera is better for C1 because it reveals object side faces and vertical thickness.

Current gameplay camera:

```text
position: (0, -360, 1638)
target:   (0, 0, 0)
pitch:    about 12 degrees
```

The validated C1 camera projection remains:

```text
focalLength: 3806
fov:         about 14.38 degrees
projection:  three-converged
viewOrder:   reversed
```

Do not change the C1 camera/projection parameters casually. Prefer changing scene composition and visual geometry.

## Dynamic Gameplay Camera

Dynamic camera angles are allowed and encouraged as a gameplay presentation layer. Treat the camera as a level director, not as part of the C1 calibration.

Keep these concepts separate:

```text
C1 display pipeline: fixed, validated, device-calibrated
gameplay camera rig: adjustable per level/phase
gameplay collision: stable and simple
visual modeling: thick, layered, C1-readable
```

Recommended camera variables:

```text
pitch:    0-28 degrees
yaw:      -24 to +24 degrees
distance: 1600-1735
targetY:  locked at 0 for now
targetZ:  -60 to +80
```

Guidelines:

- Use gentle interpolation between camera presets.
- Avoid sudden angle jumps, especially during dense bullet patterns.
- Keep the player control plane stable even if the viewing angle changes.
- Increase camera drama during transitions, boss intros, and low-bullet moments.
- Reduce camera drama during dense bullet curtains or precision dodging.
- Do not animate `targetY` until we have a stronger reason; current C1 tests suggest keeping the gameplay axis stable is preferable.
- Smooth interpolation of the other camera parameters is acceptable and did not cause discomfort in user testing.
- Validate every new camera preset on the physical C1, not from screenshots.

The game now has an automatic camera director, but it must not perform decorative parameter drift. Auto mode should rest at the validated baseline and move only when the player or game state gives it a reason:

- Player horizontal movement adds immediate yaw and small `targetX` response.
- Player forward/back position adjusts pitch, distance, and `targetZ` slightly.
- Firing moves the camera a little closer and raises `targetZ` for attack feedback.
- Focus mode reduces camera drama for precision dodging.
- Spin/bomb actions create a stronger short pulse, then smoothly return.
- Player hit, boss intro, boss phase change, boss defeat, warning, and boss telegraph are valid event drivers.
- Every non-player event response must decay back to the baseline through interpolation after the event ends.
- Game over calms the camera back down.

Manual dev controls can temporarily disable the automatic director for testing. Reset returns to automatic mode.

Initial presets:

```text
baseline: pitch 12.4, yaw 0,  distance 1677, targetY 0
canyon:   pitch 18,   yaw -8, distance 1680, targetY 0
orbital:  pitch 9,    yaw 14, distance 1735, targetY 0
boss:     pitch 22,   yaw 0,  distance 1720, targetY 0
```

## Modeling Rules

Use:

- Opaque PBR materials as the default.
- Boxy, beveled, layered, chunky silhouettes.
- Different colors, panels, decals, or procedural textures per face.
- Raised cockpits, engine pods, fins, armor plates, and underside parts.
- Visible side faces at gameplay camera angle.
- Repeated small 3D anchor objects in the scrolling field.
- Slow rotation or bank/tilt only when it helps readability.

Avoid:

- Large full-screen transparent planes.
- Very thin flat sprites used as primary gameplay objects.
- Huge flat terrain sheets with strong additive overlays.
- Many overlapping transparent particles near the focal plane.
- Uniform single-color materials on important objects.
- Pure top-down silhouettes where only the top face is visible.

## Player Ship Direction

The player ship should become a stylized C1-readable 3D craft:

- Compact collision radius remains unchanged.
- Visual body is thicker than a normal shmup ship.
- Nose, body, cockpit, wings, engines, and underside should occupy distinct Z bands.
- Each major part should have distinct material or face pattern.
- The ship may bank slightly while moving, but should not rely on banking alone for depth.

Suggested proportions:

```text
visual footprint:  about 35-55 wide, 45-70 tall
visual depth:      about 25-45
hitbox radius:     unchanged or smaller than visual body
```

## Enemy And Boss Direction

Enemies:

- Scouts can be simple but should use wedge/capsule/box combinations with real depth.
- Medium enemies should have turrets, side pods, engine blocks, and underside chunks.
- Avoid single cones or flat triangles as final C1 visuals.

Bosses:

- Bosses are ideal C1 subjects; use layered armor, raised cores, side structures, and large readable depth.
- Boss attacks can expose/raise weak points in Z, but keep collision logic separate.
- Prefer opaque staged geometry over transparent full-screen danger planes.

## Terrain Direction

The original large scrolling terrain and transparent overlays are risky for C1. Terrain should be rebuilt as readable 3D set dressing:

- Use clusters of boxes, towers, rocks, platforms, and rails.
- Keep large ground planes subdued and shallow.
- Put strong depth cues into discrete objects rather than full-screen sheets.
- Use repeating depth anchors so the player can read motion and space without overwhelming fusion.

## Effects Direction

Effects should be C1-safe:

- Bullets should be small solid capsules/spheres/boxes with emissive material.
- Explosion particles should be short-lived and mostly opaque geometry, not large transparent quads.
- Lasers should not be giant transparent planes in final C1 mode; use segmented cylinders or solid beam chunks.
- Screen flashes and DOM overlays should stay out of the C1 output or be extremely restrained.

## Event Presentation Pass

Use event-driven visual emphasis before adding more continuous decoration. Continuous camera or effect drift can make the image feel busy without improving the player's read of the 3D scene.

Current implementation direction:

- Boss warning: a one-shot top-field beacon made from opaque red/gold 3D chunks.
- Boss intro: a short violet/cyan spatial burst at the Boss target position, not a full-screen overlay.
- Boss phase change: a compact ring/core burst that marks state change without hiding bullets.
- Boss defeat: a heavier multi-shape opaque burst, still capped by the global C1-safe particle budget.
- Stage transition: a short opaque 3D gate pulse in the C1-safe field, using permanent hidden geometry instead of allocating large transient overlays.
- Power-up drop/collect: small type-colored solid bursts, shared material pools, no per-event material allocation.
- Laser impact: the beam stops at the first hit target and adds a solid cap; laser does not pierce targets.

Status:

- Bullet, muzzle, power-up, and non-piercing laser passes have been physically checked by the user and did not break C1 fusion.
- Boss warning/intro/phase/defeat plus stage transition gate pass is implemented and requires the next physical C1 check.

## Validation Method

Every new visual system should pass this order:

1. Single PBR box still looks correct.
2. Same C1 pipeline with one new visual object.
3. Add movement.
4. Add multiple objects.
5. Add gameplay interaction.
6. Add effects last.

If C1 fusion breaks, remove systems in reverse order. Do not adjust grating parameters to compensate for bad content.

## Current Verified Baseline

The current depth-rich gameplay baseline is validated as visibly 3D by the user:

- C1 online params from OpenstageAI.
- Main C1 output fullscreen on `1440x2560`.
- `projection=three-converged`.
- `viewOrder=reversed`.
- `parallax=1.00`.
- Gameplay camera uses slight 3/4 top-down pitch.
- Player probe and scrolling anchors are thick opaque PBR boxes with high-contrast face patterns.

## Runtime Performance Gates

The ordinary-screen debug window is now the required development dashboard. When building stages or adding visual detail, watch these metrics continuously:

- FPS and frame time.
- C1 actual draw calls and rendered triangles.
- Scene objects, meshes, materials, and visible source triangles.
- Gameplay counts: enemies, player bullets, enemy bullets, powerups, laser beams, and Boss state.

C1 mode renders many views per frame, so a small increase in mesh count can be multiplied across the full multi-view pass. Treat visible mesh count and draw calls as first-class design constraints, not late optimization details.

Current visual performance target:

- `30 FPS` is acceptable for this C1 project.
- Temporary dips to about `20 FPS` are acceptable during bursts, transitions, or heavy Boss moments.
- If another application on the development machine is using more than about `30%` GPU, do not use FPS or frame time as a development judgement signal for that session. Continue watching draw calls, triangles, mesh counts, and object counts instead.

Current caution thresholds:

```text
FPS:              warn below 30, critical below 20
frame time:       warn above 33.4ms, critical above 50ms
draw calls:       warn above 5,000, critical above 9,000
render triangles: warn above 3,000,000, critical above 6,000,000
visible meshes:   warn above 180, critical above 280
visible tris:     warn above 70,000, critical above 120,000
```

If a stage crosses caution thresholds, prefer changing the content strategy before adding more effects:

- Reuse geometries and materials.
- Merge or instance repeated set dressing.
- Reduce active bullet counts before increasing bullet detail.
- Keep C1-safe objects chunky and readable rather than numerous and tiny.
- Add richer Boss/player geometry only after ordinary wave scenes stay stable.

Current runtime caps keep runaway scenes inside a predictable budget:

```text
active enemies:       28
player bullets:       160
enemy bullets:        260
powerups:             36
C1-safe particles:    120
full effect particles:260
```

These caps are safety rails, not final balancing targets. If gameplay feels sparse, adjust wave composition and bullet readability before raising caps.

Progression rewards are intentionally low-cost for C1 rendering:

- Small enemies use a lightweight weighted drop table biased toward score gems.
- Medium enemies have a higher chance of upgrades, large gems, bombs, and rare lives.
- Boss kills grant a compact reward pack with guaranteed weapon progression and score value.
- Reward counts still obey the runtime powerup cap, so late-stage reward bursts cannot overload the scene.

## Current Delivery Direction

As of 2026-04-27 the default game path uses C1 fusion-safe gameplay visuals. The full gameplay logic stays active, but the risky visual systems are disabled or replaced with stable proxy geometry:

- `C1_SAFE_GAMEPLAY_BASELINE=false` for normal builds, so gameplay, enemies, bullets, Boss logic, scoring, and pickups continue to run.
- `C1_FUSION_SAFE_VISUALS=true` by default while physical C1 validation continues.
- Large scrolling terrain, extra gameplay depth anchors, scene-space HUD bars, and full-screen transparent warning planes are disabled in the C1 output path.
- A separate `C1SafeField` layer provides scrolling stage dressing through discrete opaque PBR boxes, gates, ribs, and markers. It replaces the old large terrain plane while preserving distance progression and biome transitions.
- Player, enemies, Bosses, bullets, pickups, lasers, and explosions use mostly opaque, thick, high-contrast proxy geometry.
- Distance progression continues through the safe field, so wave spawning and Boss timing still work.
- Dev diagnostics now include stage number, biome, distance, and distance-to-Boss. The ordinary-screen debug window can start/restart a run, skip directly to the current Boss, or advance the stage/biome for fast physical C1 validation.
- Auto camera remains event-driven and returns to baseline after input/event pulses.
- Graze scoring is one-shot per bullet to avoid runaway score inflation.
- Laser frame geometry is explicitly released every frame to prevent long-session leaks.

## Current R&D Priority

The project is now back on an effect-first track. The goal is to make the C1-safe real gameplay path look compelling before adding deeper gameplay systems.

Confirmation must be grouped by technical implementation span, not by tiny content details. Once one mechanism is physically confirmed on the C1, continue restoring the rest of that mechanism's visual coverage without stopping for every small variant. Stop for user confirmation when the rendering technique changes.

Current restoration tiers:

1. Opaque PBR geometry and lights: player, enemies, Bosses, solid bullets, solid pickups, solid particle chunks.
2. Opaque scene set dressing: C1-safe field, biome dressing, stage progression objects, Boss presentation geometry.
3. Higher-risk visual mechanisms: transparent surfaces, large overlays, screen-space flashes, blur/bloom/post effects, full scene HUD in C1 output.
4. Only after the visual baseline feels complete and stable: deeper gameplay systems, balancing, additional scoring depth, and final stage logic.

Rules for this effect-first pass:

- Preserve the validated C1 display pipeline.
- Add effects in increments based on technical mechanism risk.
- Inside an already-confirmed mechanism, restore breadth quickly instead of polishing isolated details.
- Prefer opaque segmented geometry over full-screen transparent planes until the opaque baseline is complete.
- Watch debug draw calls, visible meshes, and render triangles, but do not treat FPS as decisive when the development machine has external GPU load.

The first effect-first pass replaces the old single-piece laser with a segmented C1-safe beam. It uses shared geometry, alternating PBR materials, and small Z offsets so the beam has readable volume without returning to risky transparent full-height planes.

The second effect-first pass changes ordinary bullets from simple boxes to single-mesh faceted solid projectiles. This improves depth readability without increasing object count or relying on transparent trails.

The third effect-first pass adds C1-safe muzzle feedback as fixed solid player-ship geometry. The muzzle nodes scale and brighten while firing, so weapon feedback improves without spawning transient transparent flashes.

The fourth effect-first pass broadens the weapon-feedback shape within the same already-validated mechanism: stronger fixed muzzle geometry, short capped solid muzzle particles, and small safe Z offsets across shot/spread bullet formations. Confirmation checkpoints should now be based on mechanism risk rather than every tiny asset tweak: keep moving inside opaque PBR geometry and capped particles, but stop for physical C1 validation when changing renderer, camera model, transparency/post effects, particle strategy, instancing, or other rendering mechanisms.

Follow-up design correction: weapon feedback must match the weapon's actual logic and level. Level-1 Shot/Laser should read as one central firing point with restrained muzzle particles; side muzzles become active only when that weapon level actually implies side fire or multiple beams. Stable C1 output is not enough if the visual language contradicts the gameplay rules.

The fifth effect-first pass improves enemy and Boss hit feedback within the same safe mechanism. Enemy hits now get a short solid impact core plus directional sparks; enemy kills add a small solid burst core and four-way chunks; Boss hits use a dedicated capped solid impact burst instead of a tiny generic spark.

Laser design correction: the laser is a sustained beam weapon, not a piercing weapon. Each beam only damages the closest valid target along its lane, and the visual segmented beam is truncated at that target with a solid impact cap. This keeps weapon behavior readable and prevents the beam from implying impossible penetration.

Player event feedback correction: player hit and spin/bomb effects use their own blue-white guard visuals instead of reusing medium enemy or Boss destruction explosions. This keeps the visual language readable: player damage looks like shield impact, spin/bomb looks like a defensive burst, and Boss destruction remains reserved for actual Boss kills.

Power-up feedback pass: drops, attraction, and collection now have C1-safe solid feedback. Power-ups remain opaque chunky objects, gain stronger rotation/scale when pulled toward the player, emit a small solid spawn burst on drop, and emit a short color-coded collection burst on pickup. Valuable pickups use stronger but still capped feedback.

Stage transition presentation pass: biome transitions now include a short C1-safe stage gate pulse. The gate is permanent hidden geometry in `C1SafeField`, becomes visible only during stage transition, moves through the playfield as thick opaque PBR pieces, then hides again. This makes Boss defeat -> next area progression more readable without introducing a new rendering mechanism.

Layer-1 restoration pass: player, enemy, and Boss visuals have been moved from simplified C1-safe proxies back to the real procedural PBR model factories. This is still kept inside the opaque PBR mechanism: player canopy and Boss weak-point materials are forced opaque, rich ship meshes disable frustum culling, and fixed player muzzle nodes are retained on the restored player model. This pass is the next physical C1 checkpoint: confirm whether complex opaque procedural models preserve fusion before restoring higher-risk transparent or screen-space effects.

Layer-2 restoration pass: the C1-safe field now restores broader biome set dressing inside the same opaque PBR mechanism. Each biome has a distinct solid-geometry visual vocabulary: plains posts, desert obelisks, ocean pylons, volcanic vents, ruins, orbital panels, deep-space crystals, asteroid masses, black-hole spokes, and final monoliths. Stage transitions rebuild this active biome dressing at the transition start, so the next area reads as a real environment change without using transparent overlays, terrain sheets, bloom, or post effects. This is the next physical C1 checkpoint after Layer 1 is stable: confirm whether denser opaque scene dressing preserves fusion and stays within debug mesh/draw-call budgets.

Layer-2 perceptibility correction: the first biome dressing pass was technically present but not visually noticeable on the physical C1 because the objects were too small, too side-biased, and too fragmentary. The safe field now uses larger repeated biome signature rows near the playfield center, with only a few side motifs as secondary detail. Each row carries the biome identity through readable silhouettes and depth: plains patchwork/towers, desert dune bands/obelisk, ocean platform chains, volcanic plates/lava cracks, ruins floor/columns, orbital panel banks, deep-space crystal clusters, asteroid masses/rails, black-hole ring/spokes, and final-zone monolith corridors. This is still the same confirmed opaque PBR geometry mechanism; it is a visibility correction for effect restoration, not a final art-direction solution and not a renderer change.

Boss attack telegraph restoration: the original full-screen transparent warning lane remains disabled in the C1-safe path. It has been replaced by a permanent hidden opaque PBR telegraph group in `GameplayScene`, shown only during Boss aim/charge/attack states. The group uses a core lock, two charge rails, a cross brace, and segmented lane markers that expand with `Boss.getTelegraphStrength()`. This restores player-readable Boss attack anticipation without adding transparent planes, screen-space flashes, blur, or post-processing.

Combat event feedback batch: after the Boss telegraph mechanism was confirmed stable, the same opaque geometry particle mechanism was applied across related combat events instead of restoring each tiny case separately. Enemy and Boss bullet emissions now trigger throttled solid muzzle bursts; graze events add a small blue-white solid edge spark near the player; bullet clears from bomb actions or bomb pickups add a compact solid cancellation burst. Spin/bomb landing still uses its existing dedicated guard burst and suppresses duplicate clear feedback. This pass stays inside the confirmed C1-safe particle budget and does not introduce transparent trails, additive planes, or new post effects.

Wave and progression feedback batch: the same confirmed opaque particle mechanism now covers enemy/wave entrance and stage progression events. Newly spawned waves emit one compact group arrival pulse plus a capped number of individual enemy arrival sparks; heavier enemies get a slightly stronger arrival core. Boss defeat, manual stage advance, and campaign clear add compact stage-advance bursts in addition to the existing C1-safe field gate. These are intentionally event-triggered rather than continuous decoration, so they improve progression readability without creating constant visual noise or changing the renderer.

Player resource feedback batch: weapon switches, weapon upgrades, laser overheat, extra-life activation, and bomb pickup activation now have compact solid feedback near the player craft. Pickup collection still shows feedback at the pickup position, while the gameplay effect shows a separate activation burst at the player. This keeps resource changes readable on the C1 without adding DOM overlays, screen-space UI in the C1 output, transparent rings, or new shader effects.

Bullet visual hierarchy pass: enemy bullet patterns now use distinct opaque single-mesh projectile bodies instead of sharing one generic red bullet. Aimed/stream shots use elongated faceted bolts; fan shots use sharper tetra forms; rings use rounded dodeca bodies; curtains/cross patterns use slab-like chunks; spiral/rose/helix patterns use rotating elongated facets; Boss bullets use a brighter, thicker pressure projectile. This changes only the visual body and material language, not the bullet trajectories, hitboxes, rates, or gameplay rules.

Player projectile visual pass: Shot and Spread bullets now also carry separate opaque single-mesh projectile visuals. Shot uses a sharper blue-white faceted bolt with slight damage-based scale emphasis; Spread uses a shorter green blade-like projectile with stronger rotation. Laser remains the already-validated segmented solid beam. This restores weapon identity in the projectile layer without changing fire patterns, hitboxes, damage, or introducing transparent trails.

Engine/thruster feedback pass: player, enemy, and Boss movement now emits low-frequency solid exhaust chunks using the same confirmed opaque particle mechanism. Player exhaust responds to movement, firing, focus, and spin states; enemy and Boss exhaust are globally throttled and use stronger bursts only for heavier enemies or Boss attack charge. This restores flight motion energy without adding transparent trails, post effects, new shaders, or gameplay rule changes.

Damage-state feedback pass: heavy enemies and Bosses now emit low-frequency solid vent sparks when their state becomes dangerous or visibly damaged. Enemy vents only appear after durable enemies have actually lost enough HP; Boss vents respond to accumulated damage, phase transition pressure, and attack state. This uses the same capped opaque particle pool, stays event/state-driven, and avoids full-screen flashes, smoke sheets, transparent glow trails, or new rendering passes.

C1-safe HUD restoration pass: the gameplay HUD is back in the C1 scene as large opaque 3D geometry, not as DOM overlay or transparent screen-space planes. The first restored layer uses seven-segment solid digits for score and stage, chunky life pips, weapon icons, weapon-level pips, spin cooldown, laser heat, and an opaque Boss HP bar. This is intentionally functional and readable before being decorative; later UI art can improve presentation only after this solid-geometry HUD is physically confirmed stable on the C1.

Local additive glow checkpoint: the first non-opaque effect layer is intentionally narrow. Player projectiles and Boss projectiles now carry a small additive glow shell around the existing solid projectile body, and the segmented laser has sparse local glow strips plus a small impact glow cap. Ordinary enemy bullet patterns, full-screen flashes, large transparent planes, bloom, and post effects are still disabled. This pass was physically accepted on the C1 by the user and is now the validated transparent baseline.

Short local trail checkpoint: after the local glow layer was accepted, the next transparent mechanism adds only a very short additive trail mesh inside the projectile's own local transform. It is limited to player projectiles and Boss pressure projectiles, using the existing solid projectile body as the readable core. Ordinary enemy bullets still have no transparent trail, and the trail is not emitted as a particle system, so object count remains predictable and the rollback point is isolated if C1 fusion becomes unstable. This pass was also physically accepted on the C1 on 2026-04-29.

Next transparent-effect rule: do not expand transparency to ordinary enemy bullets, explosions, engine plume sheets, screen-space flashes, bloom, blur, or post effects in the same batch. The next checkpoint should introduce only one new transparent mechanism and stop for physical C1 confirmation.

## Future Enhancement Backlog

Biome background art direction needs a full redesign after the current effect-restoration pass is stable. The current `C1SafeField` biome rows are intentional technical placeholders: they test whether larger opaque PBR background geometry can remain C1-stable and perceptible, but their final appearance does not yet match the desired stage themes or production art quality.

Future biome art work should:

- Establish a clear visual concept for each stage before adding more geometry.
- Replace placeholder shape vocabulary with theme-specific silhouettes, landmarks, material language, and repeated motifs.
- Keep the validated C1 constraints from this document: opaque PBR first, chunky depth-readable forms, no risky transparent sheets until the opaque baseline is complete.
- Validate art changes by mechanism tier. Do not mix final biome art redesign with renderer, camera, post-processing, or transparency experiments in the same checkpoint.
- Preserve the ordinary-screen debug metrics workflow so art density can be tuned against visible meshes, draw calls, and C1 rendered triangles.
