# Interactive Gallery structural consistency

## Scope
- Introduce one fixed title-header frame above the secondary gallery ribbon for every state: tour, rooms, and curators.
- Keep the same title typography, tracking, and vertical spacing while only changing the active title text.
- Move room navigation controls from below the image into a compact utility row directly below the secondary ribbon and above the canvas.
- Place the active room label at left and previous, next, carousel, and `n / 4` controls at right.
- Detect portrait room scenes and render their contained image over a semantic soft-neutral backdrop spanning the full shared canvas width; landscape scenes remain image-led.
- Preserve hotspot positioning, product preview behavior, fullscreen tour playback, drawer behavior, and mobile ribbon scrolling.

## Verification
- Check Tour, Living Room, Dining portrait, and Curators states at desktop size.
- Confirm title/ribbon vertical geometry stays unchanged between states.
- Confirm controls sit above room imagery, portrait side fields render, hotspots remain aligned, and the build is healthy.
