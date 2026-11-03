# Gemini Lens Assistant Pro v2.0 for Lens Studio 5.x
### Autonomous AI Engine: 1-Click Viral Snapchat Lenses, Real LUTs, Head Stickers, Face Retouch & Monetization SEO

Gemini Lens Assistant Pro transforms **Snap Lens Studio 5.x** into an autonomous, money-making AR creation suite. Powered by **Google Gemini 3.5 Flash-Lite**, it gives creators and developers single-prompt autonomous control over the entire Lens Studio environment to design, optimize, and monetize high-value ($10K+) Snapchat lenses.

---

## 🌟 Key Superpowers

### 1. 🚀 1-Click Viral Preset Generators ($10K Monetization Ready)
- **🌟 $10K Golden Hour Beauty Glow**:
  - Native `RetouchVisual` (smooth porcelain skin, eye brightening, teeth whitening).
  - Cinematic `CrispWarm` 3D Color Correction LUT.
  - Directional golden hour KeyLight (warm sun shadows) + soft cyan RimLight.
  - Floating extruded 3D gold typography (`✨ RADIANT GLOW`) hovering over the forehead and tracking head tilts.
  - Royal Gold Crown / Butterfly accessories.
- **🗿 Chill Guy & Viral Meme Radar**:
  - Real-time head-tracked pixel thug life / chill sunglasses.
  - Retro Sepia / Vintage 90s film LUT.
  - Floating viral catchphrase typography (`CHILL GUY AURA`).
- **🌸 Kawaii Anime & Manga Aesthetic**:
  - Cute Red Devil Horns or Glowing Angel Halo tracking head.
  - Soft pink cheek blush marks with sparkle glints.
  - Vibrant Anime Beauty LUT.
  - Floating 3D Text (`★ KAWAII AURA ★`).
- **💿 Y2K Cyber Chrome**:
  - Neon Cyan & Hot Magenta studio lights.
  - Cyberpunk BlueOrange LUT.
  - Floating chrome 3D text and futuristic visor.
- **⚡ 60 FPS Mobile Optimization Audit**:
  - Auto-checks scene draw calls, texture budgets (<4MB total lens size), single shadow-casting directional light, and guaranteed 60 FPS performance on both iPhone and budget Android devices.

---

### 2. 🎨 Real Color Correction LUT Engine (40+ Built-in Looks)
Instant preview transformation using Lens Studio's native post-processing shader graph:
`Studio.applyColorCorrection(lutName)`
- **Available LUTs**: `CrispWarm`, `Beauty`, `Cinematic`, `Warm`, `VintageWarm`, `Miami`, `Clean`, `InstantPhoto`, `Faded`, `RetroGame`, `Sepia`, `BW`, `Night`, `Brightening`, etc.

---

### 3. ✨ Built-in Face Retouch & Beauty Engine
`Studio.applyFaceRetouch(options)`
- Connects directly to Lens Studio 5's internal `RetouchVisual`.
- Delivers flawless skin smoothing, eye whitening, teeth brightening, and portrait enhancement without requiring third-party plugins.

---

### 4. 👑 Real Head Tracking & Transparent Sticker Engine
`Studio.createHeadBinding(name, attachmentPoint)`  
`Studio.attachSticker(stickerName, parentObj, options)`
- Tracks user head movement via `Component.Head` (`HeadCenter`, `CandideCenter`, `Forehead`).
- Bundles real high-resolution transparent PNG stickers:
  - `gold_crown.png`: Royal golden crown with ruby & sapphire jewels.
  - `angel_halo.png`: Neon golden glowing angel halo.
  - `anime_horns.png`: Sharp red manga devil horns.
  - `chill_sunglasses.png`: Pixel black thug life sunglasses.
  - `anime_blush.png`: Soft pink cheek blush with cute slanted lines.
  - `gold_butterfly.png`: Floating golden luxury butterfly.
  - `sparkle_stars.png`: Anime 4-point glitter sparkle stars.

---

### 5. 🏷️ AI Viral Trend Radar & Snapchat Monetization SEO
`🔥 Trend Radar` analyzes current viral pop culture, news, and TikTok/Snap trends. Every generated lens automatically outputs:
- **Lens Title**: High-converting, search-friendly 2-4 word title.
- **Viral Hashtags**: 10-15 top-ranking search tags ready to copy-paste into Snapchat My Lenses.
- **Monetization Category**: Snapchat Creator Rewards Program, Spotlight Challenges, and Brand Sponsorship tips.
- **Publishing Checklist**: Direct path to hit the top-right **Publish** button (`Cmd+P`).

---

## 📁 Repository Structure

```
GeminiLensAssistant/
├── module.json         # Lens Studio 5.x plugin manifest ("network", "filesystem")
├── main.js             # Autonomous Studio suite, dockable UI, execution engine
├── config.json         # Local API key configuration (gitignored)
├── config.example.json # Safe config template for public repository
├── assets/
│   ├── luts/           # 40+ real Color Correction LUTs (.png) & color_correction.graphShader
│   └── stickers/       # Real transparent PNG stickers (crown, halo, horns, glasses, blush)
├── .gitignore          # Excludes API keys and OS cache files
└── README.md           # Documentation & monetization guide
```

---

## 🚀 Setup & Installation

### Step 1: Add Local Plugin to Lens Studio 5.x
1. Open **Lens Studio 5.x** (v5.24+).
2. Go to **Preferences** > **Plugins** (or **Window** > **Plugin Manager**).
3. Under **Additional Plugin Libraries**, add the folder:
   `~/Desktop/LensStudioPlugins` (or your chosen path).
4. Lens Studio will automatically validate and load `Gemini Lens Assistant Pro`.

### Step 2: Open the Panel
- Go to the top menu: **Window** > **Gemini Lens Assistant Pro**.
- The panel docks into the left or right sidebar next to Scene Hierarchy / Inspector.

### Step 3: API Key
- Enter your Google Gemini API key into the `Key:` field at the top of the panel, or store it in `config.json`:
  ```json
  {
    "apiKey": "YOUR_GEMINI_API_KEY_HERE"
  }
  ```

---

## 💬 Single-Prompt Autonomous Commands

Type any high-level concept or vibe into the prompt box and hit **🚀 Build Lens**:

- *"Build a complete luxury golden-hour portrait lens with warm directional sunlight, soft cyan rim light, smooth face retouch, and floating 3D text '✨ RADIANT' above the head"*
- *"Make a viral anime filter with devil horns, cheek blush, warm film colors, and a bold 3D floating title"*
- *"Make a funny meme filter about the latest news with sunglasses and funny text"*
- *"Build a cyberpunk Y2K filter with neon lights, chrome text, and retro LUT"*
