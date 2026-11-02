# Gemini Lens Assistant for Lens Studio 5.x

An AI-powered Editor Plugin for Snap **Lens Studio 5.x** that embeds a custom dockable chat panel directly inside the Lens Studio UI. It connects to the **Gemini 1.5 Pro API** and directly executes Lens Studio Editor API commands to build and modify lenses in real-time.

---

## 📁 Plugin Structure

```
~/Desktop/GeminiLensAssistant/
├── module.json    # Plugin metadata and explicit permissions ("network", "scene_modification")
├── main.js        # UI panel, Gemini network requester, system prompt injection & execution engine
└── README.md      # Documentation and usage guide
```

---

## 🚀 Quick Start Guide

### Step 1: Open Lens Studio 5.x
Launch **Lens Studio 5.x** on your Mac.

### Step 2: Open Plugin Manager
1. In the top menu bar, click **Window** > **Plugin Manager**.
2. Click **Add Local Plugin** (or the `+` button in the Plugin Manager).
3. Select the **`GeminiLensAssistant`** folder on your Desktop (`~/Desktop/GeminiLensAssistant`).
4. When prompted, grant the requested permissions:
   - **`network`**: To connect to the Gemini API.
   - **`scene_modification`**: To allow the Editor API to create and modify Scene Hierarchy objects.

### Step 3: Open the AI Assistant Panel
1. Go to **Window** > **Gemini Lens Assistant** in the top menu bar.
2. The panel will dock into your workspace (or float as a detached window).

---

## 🔑 API Key Configuration

Your active API key is pre-configured in `main.js`:
```javascript
const DEFAULT_GEMINI_API_KEY = "YOUR_API_KEY_HERE";
```

You can also view or update the API key at any time directly in the plugin's UI panel inside Lens Studio without editing code.

---

## 💬 Example Commands to Try

Type any of the following into the chat input or click the quick action preset buttons:

1. **3D Text Object**:
   ```
   Create a 3D Text object named 'WelcomeText' with text 'Hello Lens' at position (0, 0, -50)
   ```
2. **Lighting Rig**:
   ```
   Add a Directional Light named 'SunLight' and set its color to warm white
   ```
3. **Camera Rig**:
   ```
   Create a Perspective Camera named 'UserCamera' positioned at (0, 10, -100)
   ```
4. **Face Tracker**:
   ```
   Create a Face Tracking Head component object named 'FaceTracker'
   ```
5. **Hierarchy Nesting**:
   ```
   Create a parent SceneObject named 'WorldRoot' and add two child objects 'LeftHand' and 'RightHand'
   ```

---

## 🛠 Features

- **Dockable Native UI**: Built with `Studio.ui` (`LensStudio:Ui`), seamlessly matching Lens Studio's layout.
- **Direct Editor API Execution**: Executes commands directly on `Studio.project.scene`, instantly reflecting changes in the Scene Hierarchy.
- **Robust Code Cleaning**: Automatically strips markdown formatting or backticks returned by Gemini.
- **Dual Network Client**: Uses `LensStudio:Network` with fallback to standard `fetch`.
- **Quick Action Presets**: One-click preset buttons for common lens creation tasks.
- **Live Chat Console**: Scrollable log of conversation, generated code, and execution status.
