# NEMSU Cantilan 3D Campus Navigator
A web-based interactive 3D map for new students and visitors of NEMSU Cantilan Campus.

## How to run (no install, no internet needed)
1. Unzip the folder.
2. Double-click `index.html` (Chrome, Edge, Firefox or Safari).
   - Or in VS Code: right-click `index.html` → *Open with Live Server*.

No libraries, CDN or build step: the 3D engine is plain JavaScript + Canvas.

## What's new in this version
- ONE merged layout: your hand-drawn *Layout 1* + *Continuation of Layout 1* (shifted so the AVC Building lines up), with Gates 1, 2, 4, 5, 6, the overpass over the main road and the open court.
- 🚶 **First-person walk view** with an on-screen joystick (forward / backward / left / right). Keyboard: W A S D or arrows, Q / E to turn. Drag to look around. Tap a building (or the "near" chip) to read its description.
- **Hide / show** buttons for the buildings list (arrow on its edge) and for the search bar (🔍 button).
- **Gates and walls**: gate arches at Gates 1, 2, 4, 5, 6 and walls from your sketches.
- Gravel ground (campus floor and the GROUND field).
- Blue + gold theme taken from your banner (BASIS_INTERFACE).

## Update (gates from your Street View screenshots)
- Gate 1: blue WELCOME arch, dark university sign wall, stone-clad pier. Gate 4: red SDS gate, red pillars, picket fence, wooden guard post. Gate 5: tan pillars, light-blue gate, grey pergola, stone guard house. Gates 2 and 6: plain blue steel gate. Edit via `style` in `NEMSU.GATES` (`welcome | red | tan | blue`).
- Gate 1 is the MAIN GATE (WELCOME arch); the Walk view and the first tour step start there. Gate 2 is the overpass gate.
- Every gate (1, 2, 4, 5, 6) now has a wall on both sides with an opening for the gate (edit the list just above `EXTRA_ARCHES` in `js/data.js`).
- The extra small gate in the south wall (in front of the Science side) was removed; the wall gap stays open.
- Search: the X button clears the text, closes suggestions and drops the selected building.

## Update (walk view)
- Walk view has two cameras: first person (no joystick; W A S D / arrows to move, Q E to turn, drag to look) and third person (camera behind a walking avatar, joystick shown). Switch with the 🎥 button or the V key.
- In walk view buildings never lift or sway: the building under the cursor is only highlighted, and the head-bob was removed.
- The caption in front of the DGTT Building now reads PATHWAY.
- Electrical Electronics Tech is aligned in the same row as Automotive Technology.

## Files
- `index.html` – page structure
- `css/style.css` – design (day/night, mobile bottom sheet)
- `js/data.js` – **everything you edit**: buildings, positions, photos, descriptions, offices, hours, roads, tour steps, facilities
- `js/engine.js` – 3D renderer, camera fly-to, routing
- `js/app.js` – sidebar, search, cards, directions, tour
- `assets/` – logo, layout reference map, building photos

## Edit guide (js/data.js)
- Move / resize a building: change `x, y, w, h, rot`. Coordinates are in pixels of the layout map.
- Positions are in SKETCH pixels, multiplied by `K`. Continuation-sheet buildings use `E(...)`, which shifts them by (+1960, +160).
- Parking has been removed (the unlabeled block is plain gravel). IGP buildings are not in the layout, so they are not on the map.
- Male Dormitory was placed under the DGTT as on the banner.
- Descriptions, offices, rooms and office hours are SAMPLE text – please correct them.
- `NEMSU.TOUR` is the Freshman Guide: one object per step (`title`, `tip`, `target`, `zoom`).
- `NEMSU.FACILITIES` holds restroom / canteen / ramp / waiting-area points (sample positions).
- `NEMSU.WALKS` are the walkways used by "Get directions" (and drawn as light paths). `over:true` = overpass.

## Controls
Drag = pan · Right-drag or Shift-drag = rotate/tilt · Wheel = zoom · Esc = deselect / close
Share link format: `index.html#b=<building-id>` (e.g. `#b=library`).
