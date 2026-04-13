# Neon Escape VR

A browser-based A-Frame VR game that works on desktop for testing and supports stereoscopic mobile VR mode for phone headsets.

## Features

- **Gaze and Head-Rotation Controls**: Play the entire game without hands or controllers! Just look around to navigate menus and change lanes.
- **Neon Cyberpunk Aesthetic**: A glowing tunnel where speed increases as you survive.
- **Multiple Obstacles**: Avoid glowing blocks, rotating barriers, and laser walls.
- **Two Progressive Levels**: increasing difficulty and spawn rates.

## How to Run

1. You need a local web server to run this game properly (due to browser CORS policies regarding modules/assets).
2. If you have Python installed, open your terminal in this directory and run:
   ```bash
   python -m http.server 8080
   ```
   Or if you use Node.js, you can run:
   ```bash
   npx serve .
   ```
3. Open your browser and navigate to `http://localhost:8080` (or whichever port your server uses).

## Controls

### Mobile VR
- Enter VR mode using the button in the bottom right corner (the "VR" or "Cardboard" logo).
- **Menus**: Look at a menu button and keep the circular reticle over it for 1.5 seconds to "click" it.
- **Gameplay**: Look significantly to the left to move to the left lane, and significantly to the right to move to the right lane.

### Desktop Testing
- **Menus**: Click and drag on the screen to look around. Place the central circular reticle over a button and wait to click.
- **Gameplay**: You can click and drag to look left or right, simulating head rotation. Alternatively, use the **Left Arrow** and **Right Arrow** keys on your keyboard to instantly swap lanes for easier debugging.

## Assets Directory

- Place any custom textures in `assets/textures/`.
- Place any custom background music (`.mp3` or `.ogg`) in `assets/audio/` and update `index.html`'s `<a-assets>` `<audio id="bgm" src="...">` attribute to load your songs.
