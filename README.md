# Gemini Lens Assistant for Lens Studio 5.x

An AI-powered Editor Plugin for **Snap Lens Studio 5.x** that embeds an intelligent chat panel directly inside the Lens Studio UI. It connects to **Gemini 1.5 Pro** and gives the AI full, granular control over every aspect of Lens Studio: from creating complex 3D hierarchies to tweaking the subtlest component property.

---

## 🌟 Deep Control Capabilities

Gemini is not limited to simple object creation—it has full situational awareness and deep Editor API control:

### 1. Real-Time Scene Awareness
Every user prompt is dynamically enriched with a **live snapshot of your scene hierarchy, active components, and project assets**. Gemini always knows what objects exist in your project and can reference, modify, or delete them by name.

### 2. Full Hierarchy & Object Control
- **Find**: Locates any object anywhere in the tree (`Studio.find("ObjectName")`, `Studio.findAll("Light")`).
- **Create**: Creates objects with parent-child relationships (`Studio.createSceneObject("Child", parentObj)`).
- **Duplicate**: Clones objects with all transforms and components (`Studio.duplicate("ObjectName", "NewName")`).
- **Delete**: Cleans up unwanted objects (`Studio.delete("ObjectName")` or `obj.destroy()`).

### 3. Precision Transform Control
- Local & World coordinates: Position, Euler angle rotation, and scale.
- Helper: `Studio.setTransform(obj, { position: [0, 5, -50], rotationEuler: [0, 90, 0], scale: [2, 2, 2] })`.

### 4. Granular Component Manipulation
Directly configures every component type:
- **`Component.LightSource`**: Type (Directional, Point, Ambient, Spot), color, intensity, shadow casting.
- **`Component.Camera`**: FOV, near/far clipping planes, camera type, clear colors, render targets.
- **`Component.Text`**: Text string, size, font, colors, horizontal/vertical alignment.
- **`Component.RenderMeshVisual`**: Meshes, materials, passes.
- **`Component.Head` & `FaceRetouchVisual`**: Face tracking rigs and cosmetic effects.
- **`Component.AudioComponent`**: Volume, looping, audio track assignments.
- **`Component.ScreenTransform`**: 2D UI layouts, anchors, offsets.

### 5. Single-Step Undo (Cmd+Z)
Every modification executed by Gemini is batched into Lens Studio's project history stream (`model.project.history.executeAsGroup`). Any AI modification can be undone in a single keystroke (**Cmd+Z** or the **Undo** button in the panel).

---

## 📁 Repository Structure

```
GeminiLensAssistant/
├── module.json         # Plugin manifest declaring "network" and "scene_modification"
├── main.js             # Deep control Studio suite, UI panel, requester & execution engine
├── config.example.json # Template for local API key configuration
├── .gitignore          # Keeps secrets and local config safe from Git
└── README.md           # Documentation and usage guide
```

---

## 🚀 Quick Setup

### Step 1: Add Local Plugin to Lens Studio 5.x
1. Open **Lens Studio 5.x**.
2. In the top menu, click **Window** > **Plugin Manager**.
3. Click **Add Local Plugin** and select this `GeminiLensAssistant` folder.
4. Allow requested permissions (**network** and **scene_modification**).

### Step 2: Open the Panel
- Go to **Window** > **Gemini Lens Assistant**.
- Dock the panel into your workspace or keep it as a floating utility window.

### Step 3: API Key
- Enter your Gemini API key in the top **API Key** input field in the panel, or add it to a local `config.json`:
  ```json
  {
    "apiKey": "YOUR_GEMINI_API_KEY_HERE"
  }
  ```

---

## 💬 Example Commands to Try

- **Subtle property tweaks:**
  - *"Change the color of KeyLight to soft orange and increase intensity to 2.5"*
  - *"Set the FOV of MainCamera to 45 degrees"*
  - *"Change the text of HeroTitle to 'Snapchat AR' and make it gold"*
- **Hierarchy manipulation:**
  - *"Duplicate KeyLight, rename it FillLight, and position it at (-30, 10, -40)"*
  - *"Delete the object named UnusedSphere"*
  - *"Create a parent object named 'Environment' and move all lights inside it"*
- **AR Effects & Rigging:**
  - *"Create a Face Tracking Head component object with FaceRetouch attached"*
  - *"Add a 2D ScreenTransform Image on canvas"*
