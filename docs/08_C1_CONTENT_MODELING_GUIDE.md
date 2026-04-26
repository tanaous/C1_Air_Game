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

## Current Delivery Direction

As of 2026-04-27 the default game path uses C1 fusion-safe gameplay visuals. The full gameplay logic stays active, but the risky visual systems are disabled or replaced with stable proxy geometry:

- `C1_SAFE_GAMEPLAY_BASELINE=false` for normal builds, so gameplay, enemies, bullets, Boss logic, scoring, and pickups continue to run.
- `C1_FUSION_SAFE_VISUALS=true` by default while physical C1 validation continues.
- Large scrolling terrain, extra gameplay depth anchors, scene-space HUD bars, and full-screen transparent warning planes are disabled in the C1 output path.
- A separate `C1SafeField` layer provides scrolling stage dressing through discrete opaque PBR boxes, gates, ribs, and markers. It replaces the old large terrain plane while preserving distance progression and biome transitions.
- Player, enemies, Bosses, bullets, pickups, lasers, and explosions use mostly opaque, thick, high-contrast proxy geometry.
- Distance progression continues through the safe field, so wave spawning and Boss timing still work.
- Auto camera remains event-driven and returns to baseline after input/event pulses.
- Graze scoring is one-shot per bullet to avoid runaway score inflation.
- Laser frame geometry is explicitly released every frame to prevent long-session leaks.

Delivery validation should focus on this fusion-safe real gameplay path first. Once it is stable on the physical C1, reintroduce richer visual systems one at a time: player detail, enemies, Boss detail, terrain, scene HUD, particles, then transparent effects last.
