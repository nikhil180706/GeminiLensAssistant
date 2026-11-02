import PanelPlugin from 'LensStudio:PanelPlugin';
import { Descriptor, DockState, Size } from 'LensStudio:PanelPlugin';
import * as Ui from 'LensStudio:Ui';
import * as Network from 'LensStudio:Network';

/**
 * =========================================================================
 * Gemini Lens Assistant - Ultra Comprehensive Lens Studio 5.x Editor Plugin
 * =========================================================================
 * Empowers Gemini with deep, granular control over every aspect of Lens Studio:
 * - Full Scene Hierarchy inspection, creation, modification, and deletion
 * - Precise Transform control (local/world position, rotation, scale, parenting)
 * - Deep component property control (Camera, LightSource, Text, Mesh, Audio, etc.)
 * - Asset Manager interaction (materials, textures, render targets, meshes)
 * - Real-time Scene Hierarchy & Asset Snapshot injection into AI prompt context
 * - Single-step Undo/Redo (Cmd+Z) batching via project history stream
 * - Interactive UI with Scene Inspector, Preset Actions, Undo, and Chat Log
 */

// -------------------------------------------------------------------------
// Active Gemini API Key Configuration
// -------------------------------------------------------------------------
let localApiKey = "";
try {
    // If local gitignored config.json exists, read the key
    const localConfig = require('./config.json');
    if (localConfig && localConfig.apiKey && localConfig.apiKey !== "YOUR_API_KEY_HERE") {
        localApiKey = localConfig.apiKey;
    }
} catch (e) {
    // No local config file present
}

const DEFAULT_GEMINI_API_KEY = localApiKey || "YOUR_API_KEY_HERE";
let currentApiKey = DEFAULT_GEMINI_API_KEY;

// Gemini API Endpoint
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

// -------------------------------------------------------------------------
// Universal Math Fallbacks for environments where global math types differ
// -------------------------------------------------------------------------
const FallbackVec2 = typeof vec2 !== 'undefined' ? vec2 : class { constructor(x=0, y=0) { this.x = x; this.y = y; } };
const FallbackVec3 = typeof vec3 !== 'undefined' ? vec3 : class { constructor(x=0, y=0, z=0) { this.x = x; this.y = y; this.z = z; } };
const FallbackVec4 = typeof vec4 !== 'undefined' ? vec4 : class { constructor(x=0, y=0, z=0, w=1) { this.x = x; this.y = y; this.z = z; this.w = w; } };
const FallbackQuat = typeof quat !== 'undefined' ? quat : {
    fromEulerAngles: (x, y, z) => ({ x, y, z, w: 1 }),
    quat: () => ({ x: 0, y: 0, z: 0, w: 1 })
};

// -------------------------------------------------------------------------
// Comprehensive Studio Namespace & Editor Control Suite
// -------------------------------------------------------------------------
const Studio = {
    ui: Ui,
    pluginSystem: null,
    model: null,

    // Active project reference
    get project() {
        if (this.model && this.model.project) {
            return this.model.project;
        }
        if (typeof Editor !== 'undefined' && Editor.Model && Editor.Model.project) {
            return Editor.Model.project;
        }
        return null;
    },

    // Active scene reference
    get scene() {
        const proj = this.project;
        if (proj && proj.scene) {
            return proj.scene;
        }
        if (typeof globalThis !== 'undefined' && globalThis.scene) {
            return globalThis.scene;
        }
        return null;
    },

    // Undo / History Stream reference
    get history() {
        const proj = this.project;
        return (proj && proj.history) ? proj.history : null;
    },

    // Asset Manager reference
    get assetManager() {
        const proj = this.project;
        return (proj && proj.assetManager) ? proj.assetManager : null;
    },

    // ---------------------------------------------------------------------
    // Scene Object Hierarchy Queries & Traversal
    // ---------------------------------------------------------------------
    getRootObjects() {
        const scn = this.scene;
        if (!scn) return [];
        if (Array.isArray(scn.rootSceneObjects)) return scn.rootSceneObjects;
        if (typeof scn.getRootObjects === 'function') return scn.getRootObjects();
        return [];
    },

    /**
     * Recursively traverses all scene objects.
     * @param {function} callback Called for every SceneObject
     */
    traverseHierarchy(callback) {
        const roots = this.getRootObjects();
        const visit = (obj) => {
            if (!obj) return;
            callback(obj);
            const children = this.getChildren(obj);
            for (let i = 0; i < children.length; i++) {
                visit(children[i]);
            }
        };
        for (let i = 0; i < roots.length; i++) {
            visit(roots[i]);
        }
    },

    /**
     * Safely retrieves child objects of a SceneObject.
     */
    getChildren(obj) {
        if (!obj) return [];
        if (Array.isArray(obj.children)) return obj.children;
        if (typeof obj.getChildrenCount === 'function' && typeof obj.getChild === 'function') {
            const list = [];
            const count = obj.getChildrenCount();
            for (let i = 0; i < count; i++) {
                list.push(obj.getChild(i));
            }
            return list;
        }
        return [];
    },

    /**
     * Finds the first SceneObject matching the name (case-insensitive).
     */
    find(name) {
        if (!name) return null;
        const target = name.toLowerCase().trim();
        let found = null;
        this.traverseHierarchy((obj) => {
            if (!found && obj.name && obj.name.toLowerCase().trim() === target) {
                found = obj;
            }
        });
        return found;
    },

    /**
     * Finds all SceneObjects matching a substring or regex.
     */
    findAll(pattern) {
        const results = [];
        const isRegex = pattern instanceof RegExp;
        const lower = typeof pattern === 'string' ? pattern.toLowerCase() : '';
        this.traverseHierarchy((obj) => {
            if (!obj || !obj.name) return;
            if (isRegex && pattern.test(obj.name)) {
                results.push(obj);
            } else if (obj.name.toLowerCase().includes(lower)) {
                results.push(obj);
            }
        });
        return results;
    },

    /**
     * Creates a new SceneObject at root or under a parent.
     */
    createSceneObject(name, parentObj = null) {
        const scn = this.scene;
        if (!scn) throw new Error("No active scene available in project.");
        const obj = scn.createSceneObject(name || "New_Object");
        if (parentObj && typeof obj.setParent === 'function') {
            obj.setParent(parentObj);
        }
        return obj;
    },

    /**
     * Safely deletes a SceneObject.
     */
    delete(target) {
        const obj = typeof target === 'string' ? this.find(target) : target;
        if (!obj) return false;
        if (typeof obj.destroy === 'function') {
            obj.destroy();
            return true;
        }
        return false;
    },

    /**
     * Duplicates an existing SceneObject.
     */
    duplicate(target, newName = null) {
        const source = typeof target === 'string' ? this.find(target) : target;
        if (!source) throw new Error(`Target object not found for duplication.`);
        const scn = this.scene;
        const clone = scn.createSceneObject(newName || (source.name + "_Copy"));
        
        // Copy transform
        if (source.getTransform && clone.getTransform) {
            const sT = source.getTransform();
            const cT = clone.getTransform();
            if (sT.getLocalPosition && cT.setLocalPosition) cT.setLocalPosition(sT.getLocalPosition());
            if (sT.getLocalRotation && cT.setLocalRotation) cT.setLocalRotation(sT.getLocalRotation());
            if (sT.getLocalScale && cT.setLocalScale) cT.setLocalScale(sT.getLocalScale());
        }

        // Copy components
        const comps = this.listComponents(source);
        for (let i = 0; i < comps.length; i++) {
            const comp = comps[i];
            const compType = comp.getTypeName ? comp.getTypeName() : null;
            if (compType) {
                clone.createComponent(compType);
            }
        }
        return clone;
    },

    // ---------------------------------------------------------------------
    // Transform Helpers
    // ---------------------------------------------------------------------
    setTransform(obj, options = {}) {
        if (typeof obj === 'string') obj = this.find(obj);
        if (!obj || !obj.getTransform) return null;
        const t = obj.getTransform();

        if (options.position && t.setLocalPosition) {
            const p = options.position;
            t.setLocalPosition(new FallbackVec3(p[0] || p.x || 0, p[1] || p.y || 0, p[2] || p.z || 0));
        }
        if (options.scale && t.setLocalScale) {
            const s = options.scale;
            t.setLocalScale(new FallbackVec3(s[0] || s.x || 1, s[1] || s.y || 1, s[2] || s.z || 1));
        }
        if (options.rotationEuler && t.setLocalRotation) {
            const r = options.rotationEuler;
            t.setLocalRotation(FallbackQuat.fromEulerAngles(r[0] || r.x || 0, r[1] || r.y || 0, r[2] || r.z || 0));
        }
        if (options.worldPosition && t.setWorldPosition) {
            const wp = options.worldPosition;
            t.setWorldPosition(new FallbackVec3(wp[0] || wp.x || 0, wp[1] || wp.y || 0, wp[2] || wp.z || 0));
        }
        return t;
    },

    // ---------------------------------------------------------------------
    // Component & Property Helpers
    // ---------------------------------------------------------------------
    listComponents(obj) {
        if (typeof obj === 'string') obj = this.find(obj);
        if (!obj) return [];
        if (typeof obj.getComponents === 'function') {
            return obj.getComponents("Component") || [];
        }
        return [];
    },

    getComponent(obj, typeName) {
        if (typeof obj === 'string') obj = this.find(obj);
        if (!obj || !obj.getComponent) return null;
        return obj.getComponent(typeName);
    },

    getOrAddComponent(obj, typeName) {
        if (typeof obj === 'string') obj = this.find(obj);
        if (!obj) return null;
        let comp = this.getComponent(obj, typeName);
        if (!comp && typeof obj.createComponent === 'function') {
            comp = obj.createComponent(typeName);
        }
        return comp;
    },

    /**
     * Deeply configures properties of a component.
     * e.g. modifyComponent(obj, "Component.LightSource", { color: new vec4(1,0,0,1), intensity: 2.5 })
     */
    modifyComponent(obj, typeName, properties = {}) {
        const comp = this.getOrAddComponent(obj, typeName);
        if (!comp) return null;
        for (const [key, value] of Object.entries(properties)) {
            try {
                comp[key] = value;
            } catch (propErr) {
                print(`[Studio] Could not set ${key} on ${typeName}: ${propErr}`);
            }
        }
        return comp;
    },

    // ---------------------------------------------------------------------
    // Asset Management Utilities
    // ---------------------------------------------------------------------
    assets: {
        get all() {
            const am = Studio.assetManager;
            return (am && am.assets) ? am.assets : [];
        },
        find(name) {
            if (!name) return null;
            const lower = name.toLowerCase().trim();
            const list = this.all;
            return list.find(a => a.name && a.name.toLowerCase().trim() === lower) || null;
        },
        findByType(typeName) {
            const list = this.all;
            return list.filter(a => {
                if (typeof a.isOfType === 'function') return a.isOfType(typeName);
                if (a.typeName) return a.typeName.includes(typeName);
                return false;
            });
        },
        createNative(type, name, dir = '') {
            const am = Studio.assetManager;
            if (!am || !am.createNativeAsset) throw new Error("AssetManager createNativeAsset unavailable.");
            return am.createNativeAsset(type, name, dir);
        }
    },

    // ---------------------------------------------------------------------
    // Real-Time Project Snapshots (Context Injection for Gemini)
    // ---------------------------------------------------------------------
    getHierarchySnapshot() {
        const lines = [];
        let count = 0;
        this.traverseHierarchy((obj) => {
            count++;
            if (count > 40) return; // Cap to keep context compact
            const comps = this.listComponents(obj).map(c => c.getTypeName ? c.getTypeName() : 'Component');
            let posStr = "";
            if (obj.getTransform && obj.getTransform().getLocalPosition) {
                const p = obj.getTransform().getLocalPosition();
                posStr = ` [pos: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}]`;
            }
            lines.push(`• "${obj.name}"${posStr} (Components: ${comps.length > 0 ? comps.join(', ') : 'none'})`);
        });
        if (lines.length === 0) return "(Scene hierarchy is empty)";
        return lines.join('\n');
    },

    getAssetsSnapshot() {
        const all = this.assets.all;
        if (!all || all.length === 0) return "(No custom assets)";
        const names = all.slice(0, 25).map(a => `${a.name || 'Unnamed'}`);
        return names.join(', ');
    }
};

// Expose on globalThis for execution engine
if (typeof globalThis !== 'undefined') {
    globalThis.Studio = Studio;
}

// -------------------------------------------------------------------------
// Master System Prompt: The Ultimate Lens Studio 5.x Execution Agent
// -------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are the master Lens Studio 5.x Editor API execution agent.
You have FULL, UNRESTRICTED, GRANULAR CONTROL over the Lens Studio editor, its Scene Hierarchy, transforms, components, assets, lighting, cameras, materials, audio, physics, and UI.

CRITICAL RULES:
1. Output ONLY executable JavaScript code.
2. Absolutely NO markdown code fences (NO \`\`\`javascript or \`\`\`), NO preamble, NO conversation, NO explanations.
3. You are provided with the CURRENT SCENE HIERARCHY and ASSETS in each request. Inspect them to modify, query, or delete existing objects, or create new ones.
4. Execute via the Editor API:
   - To find an existing object:
     var obj = Studio.find("ObjectName");
   - To create a new object:
     var obj = Studio.createSceneObject("ObjectName", parentObj);
     // or: var obj = Studio.project.scene.createSceneObject("ObjectName");
   - To delete an object:
     Studio.delete("ObjectName"); // or obj.destroy();
   - To duplicate an object:
     var clone = Studio.duplicate("ObjectName", "Cloned_Name");

5. Component Manipulations:
   - 3D & 2D Text:
     var textComp = Studio.getOrAddComponent(obj, "Component.Text");
     textComp.text = "Hello World";
     textComp.size = 36;
     textComp.fillColor = new vec4(1, 0.8, 0, 1);
   - Lights:
     var light = Studio.getOrAddComponent(obj, "Component.LightSource");
     light.lightType = 0; // 0=Directional, 1=Point, 2=Ambient, 3=Spot
     light.color = new vec4(1, 1, 1, 1);
     light.intensity = 1.5;
     light.castShadows = true;
   - Cameras:
     var cam = Studio.getOrAddComponent(obj, "Component.Camera");
     cam.fov = 60.0;
     cam.near = 1.0;
     cam.far = 1000.0;
     cam.clearColor = new vec4(0, 0, 0, 0);
   - Mesh Visuals & Materials:
     var meshComp = Studio.getOrAddComponent(obj, "Component.RenderMeshVisual");
   - Face Tracking & Retouch:
     var head = Studio.getOrAddComponent(obj, "Component.Head");
     var retouch = Studio.getOrAddComponent(obj, "Component.FaceRetouchVisual");
   - Audio:
     var audio = Studio.getOrAddComponent(obj, "Component.AudioComponent");
     audio.volume = 0.8;
     audio.loop = true;
   - ScreenTransform (2D UI):
     var screenT = Studio.getOrAddComponent(obj, "Component.ScreenTransform");

6. Transform Controls:
   var t = obj.getTransform();
   t.setLocalPosition(new vec3(x, y, z));
   t.setLocalRotation(quat.fromEulerAngles(pitch, yaw, roll));
   t.setLocalScale(new vec3(sx, sy, sz));
   // Or helper: Studio.setTransform(obj, { position: [x, y, z], scale: [sx, sy, sz] });

7. Ensure all variables are cleanly declared with var/const/let and syntax is 100% valid.`;

// -------------------------------------------------------------------------
// Execution Engine: Safe Code Extraction & Grouped Execution
// -------------------------------------------------------------------------
/**
 * Strips out any markdown syntax, code fences, or backticks from model output.
 */
function stripMarkdown(rawText) {
    if (!rawText) return "";
    let code = rawText.trim();
    const codeBlockMatch = code.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        code = codeBlockMatch[1].trim();
    } else {
        code = code.replace(/^`+|`+$/g, '').trim();
    }
    return code;
}

/**
 * Safely executes generated Editor API code inside an Undo/Redo transaction group.
 */
function executeEditorScript(code, context, actionName = "Gemini AI Command") {
    const { Studio, scene, model, pluginSystem } = context;

    // Ensure globals are active
    if (typeof globalThis !== 'undefined') {
        globalThis.Studio = Studio;
        if (scene && typeof globalThis.scene === 'undefined') {
            globalThis.scene = scene;
        }
    }

    const scriptRunner = new Function(
        "Studio",
        "scene",
        "model",
        "pluginSystem",
        "vec3",
        "vec2",
        "vec4",
        "quat",
        "Color",
        `"use strict";
        try {
            ${code}
        } catch (err) {
            throw err;
        }`
    );

    const executeBlock = () => {
        return scriptRunner(
            Studio,
            scene,
            model,
            pluginSystem,
            FallbackVec3,
            FallbackVec2,
            FallbackVec4,
            FallbackQuat,
            FallbackVec4
        );
    };

    // If History stream is available, batch into a single Cmd+Z Undo entry
    const history = Studio.history;
    if (history && typeof history.executeAsGroup === 'function') {
        try {
            return history.executeAsGroup(actionName, executeBlock);
        } catch (hErr) {
            print(`[Gemini Assistant] History grouping note: ${hErr}. Falling back to direct run.`);
        }
    }

    return executeBlock();
}

// -------------------------------------------------------------------------
// Network Logic: Gemini API Requester with Scene Context Enrichment
// -------------------------------------------------------------------------
function requestGeminiGeneration(apiKey, userPrompt, onSuccess, onError) {
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
        onError(new Error("Please configure your Gemini API Key in the panel input before sending requests."));
        return;
    }

    const targetUrl = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

    // Build real-time situational snapshot of the open project
    const sceneSnapshot = Studio.getHierarchySnapshot();
    const assetSnapshot = Studio.getAssetsSnapshot();

    const contextualUserPrompt = `[USER REQUEST]
${userPrompt}

[CURRENT PROJECT SITUATION]
Existing Scene Objects & Components:
${sceneSnapshot}

Available Assets:
${assetSnapshot}`;

    const requestPayload = {
        system_instruction: {
            parts: [
                { text: SYSTEM_PROMPT }
            ]
        },
        contents: [
            {
                role: "user",
                parts: [
                    { text: contextualUserPrompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2500
        }
    };

    const payloadJson = JSON.stringify(requestPayload);

    // Primary: LensStudio:Network
    if (Network && Network.HttpRequest && Network.performHttpRequest) {
        try {
            const request = new Network.HttpRequest();
            request.url = targetUrl;
            request.method = Network.HttpRequest.Method.Post;
            request.contentType = "application/json";
            request.headers = {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            };
            request.body = payloadJson;

            Network.performHttpRequest(request, (response) => {
                if (!response) {
                    onError(new Error("Empty network response received."));
                    return;
                }
                if (response.error) {
                    onError(new Error("Network Error: " + response.error));
                    return;
                }

                const statusCode = response.statusCode;
                const responseBody = response.body ? response.body.toString() : "";

                if (statusCode >= 200 && statusCode < 300) {
                    try {
                        const parsedData = JSON.parse(responseBody);
                        const rawCandidateText = parsedData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        onSuccess(rawCandidateText);
                    } catch (jsonErr) {
                        onError(new Error("JSON Parse Error: " + jsonErr.message + "\n" + responseBody));
                    }
                } else {
                    onError(new Error(`Gemini API Error (HTTP ${statusCode}):\n${responseBody}`));
                }
            });
            return;
        } catch (netEx) {
            print("[Gemini Assistant] LensStudio:Network error: " + netEx);
        }
    }

    // Secondary fallback: Standard fetch
    if (typeof fetch !== "undefined") {
        fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: payloadJson
        })
        .then((res) => {
            if (!res.ok) {
                return res.text().then((txt) => {
                    throw new Error(`Gemini API HTTP ${res.status}: ${txt}`);
                });
            }
            return res.json();
        })
        .then((data) => {
            const rawCandidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            onSuccess(rawCandidateText);
        })
        .catch(onError);
        return;
    }

    onError(new Error("No compatible network interface found."));
}

// -------------------------------------------------------------------------
// Lens Studio 5.x PanelPlugin Implementation
// -------------------------------------------------------------------------
export class GeminiLensAssistantPanel extends PanelPlugin {
    static descriptor() {
        const d = new Descriptor();
        d.id = "com.gemini.lensassistant";
        d.name = "Gemini Lens Assistant";
        d.description = "Deep AI integration panel that directly inspects, builds, and modifies Lens Studio scenes in real-time.";
        d.defaultDockState = DockState.Attached;
        d.defaultSize = new Size(400, 580);
        d.minimumSize = new Size(300, 400);
        d.isUnique = true;
        d.menuActionHierarchy = ["Window", "Gemini Lens Assistant"];
        return d;
    }

    constructor(pluginSystem, descriptor) {
        super(pluginSystem, descriptor);
        this.connections = [];
        this.pluginSystem = pluginSystem;

        try {
            if (typeof Editor !== 'undefined' && Editor.Model && Editor.Model.IModel) {
                this.model = pluginSystem.findInterface(Editor.Model.IModel);
            }
        } catch (e) {
            print("[Gemini Assistant] Model interface lookup: " + e);
        }

        Studio.pluginSystem = pluginSystem;
        Studio.model = this.model;
        globalThis.Studio = Studio;
    }

    createWidget(parent) {
        const root = new Studio.ui.Widget(parent);
        const mainLayout = new Studio.ui.BoxLayout();
        mainLayout.setDirection(Studio.ui.Direction.TopToBottom);
        mainLayout.spacing = 6;
        root.layout = mainLayout;

        // Top Header & Status
        const headerContainer = new Studio.ui.Widget(root);
        const headerLayout = new Studio.ui.BoxLayout();
        headerLayout.setDirection(Studio.ui.Direction.LeftToRight);
        headerContainer.layout = headerLayout;

        const titleLabel = new Studio.ui.Label(headerContainer);
        titleLabel.text = "<b>✨ Gemini Lens Assistant</b> <small>(Deep Editor Control)</small>";
        headerLayout.addWidget(titleLabel);

        const statusLabel = new Studio.ui.Label(headerContainer);
        statusLabel.text = "<i>[Ready]</i>";
        headerLayout.addWidget(statusLabel);
        mainLayout.addWidget(headerContainer);

        // API Key Configuration row
        const keyContainer = new Studio.ui.Widget(root);
        const keyLayout = new Studio.ui.BoxLayout();
        keyLayout.setDirection(Studio.ui.Direction.LeftToRight);
        keyLayout.spacing = 6;
        keyContainer.layout = keyLayout;

        const keyLabel = new Studio.ui.Label(keyContainer);
        keyLabel.text = "API Key:";
        keyLayout.addWidget(keyLabel);

        const apiKeyInput = new Studio.ui.LineEdit(keyContainer);
        apiKeyInput.text = currentApiKey;
        apiKeyInput.placeholderText = "Enter Gemini API Key...";
        keyLayout.addWidget(apiKeyInput);

        if (apiKeyInput.onTextChanged) {
            this.connections.push(apiKeyInput.onTextChanged.connect(() => {
                currentApiKey = apiKeyInput.text ? apiKeyInput.text.trim() : "";
            }));
        }
        mainLayout.addWidget(keyContainer);

        // Scene Inspector & Control Toolbar
        const toolbarContainer = new Studio.ui.Widget(root);
        const toolbarLayout = new Studio.ui.BoxLayout();
        toolbarLayout.setDirection(Studio.ui.Direction.LeftToRight);
        toolbarLayout.spacing = 4;
        toolbarContainer.layout = toolbarLayout;

        const inspectBtn = new Studio.ui.PushButton(toolbarContainer);
        inspectBtn.text = "🔍 Inspect Hierarchy";
        toolbarLayout.addWidget(inspectBtn);

        const undoBtn = new Studio.ui.PushButton(toolbarContainer);
        undoBtn.text = "↩️ Undo";
        toolbarLayout.addWidget(undoBtn);

        const clearBtn = new Studio.ui.PushButton(toolbarContainer);
        clearBtn.text = "🧹 Clear Log";
        toolbarLayout.addWidget(clearBtn);

        mainLayout.addWidget(toolbarContainer);

        // Quick Preset Action Chips
        const presetContainer = new Studio.ui.Widget(root);
        const presetLayout = new Studio.ui.BoxLayout();
        presetLayout.setDirection(Studio.ui.Direction.LeftToRight);
        presetLayout.spacing = 4;
        presetContainer.layout = presetLayout;

        const presets = [
            { label: "+ 3D Text", prompt: "Create a 3D Text object named 'HeroTitle' with text 'Made with Gemini' and color gold at position (0, 0, -60)" },
            { label: "+ Directional Light", prompt: "Create a Directional Light named 'KeyLight' with warm sunlight color, intensity 2.0, and enabled shadows" },
            { label: "+ Camera", prompt: "Create a Perspective Camera named 'CinematicCamera' with 50 degree FOV" },
            { label: "+ Face Rig", prompt: "Create a Face Tracking Head component object named 'FaceRig' with FaceRetouch attached" }
        ];

        // Chat Console Area
        const chatLog = new Studio.ui.TextEdit(root);
        chatLog.readOnly = true;
        chatLog.placeholderText = "Editor operations and AI interaction log...";
        chatLog.plainText = "=== Gemini Lens Assistant (Lens Studio 5.x) ===\nDeep Editor API ready. Gemini has full real-time awareness of your scene hierarchy, components, and assets.\n\nTry commands like:\n• 'Change the light color to cyan and increase intensity to 3'\n• 'Scale HeroTitle by 1.5x'\n• 'Delete the object named MainCamera'\n• 'Duplicate KeyLight and position it at (20, 10, -50)'\n";
        mainLayout.addWidget(chatLog);

        const appendChat = (sender, message) => {
            const current = chatLog.plainText;
            chatLog.plainText = current + `\n[${sender}]:\n${message}\n`;
            if (chatLog.textCursor) {
                try {
                    const cursor = chatLog.textCursor;
                    cursor.movePosition(Studio.ui.TextCursor.MoveOperation.End, Studio.ui.TextCursor.MoveMode.MoveAnchor);
                    chatLog.textCursor = cursor;
                } catch (e) {}
            }
        };

        // Bottom Input Row
        const inputContainer = new Studio.ui.Widget(root);
        const inputLayout = new Studio.ui.BoxLayout();
        inputLayout.setDirection(Studio.ui.Direction.LeftToRight);
        inputLayout.spacing = 6;
        inputContainer.layout = inputLayout;

        const promptInput = new Studio.ui.LineEdit(inputContainer);
        promptInput.placeholderText = "Type any lens modification command...";
        inputLayout.addWidget(promptInput);

        const submitButton = new Studio.ui.PushButton(inputContainer);
        submitButton.text = "Send";
        inputLayout.addWidget(submitButton);

        mainLayout.addWidget(inputContainer);

        // Action Execution Handler
        const handleSend = (customPrompt) => {
            const promptText = customPrompt || (promptInput.text ? promptInput.text.trim() : "");
            if (!promptText) return;

            const activeKey = apiKeyInput.text ? apiKeyInput.text.trim() : currentApiKey;

            if (!customPrompt) {
                promptInput.text = "";
            }

            appendChat("User", promptText);
            statusLabel.text = "<i>[Thinking...]</i>";
            submitButton.text = "Generating...";
            submitButton.enabled = false;

            requestGeminiGeneration(
                activeKey,
                promptText,
                (rawResponse) => {
                    submitButton.text = "Send";
                    submitButton.enabled = true;
                    statusLabel.text = "<i>[Executing...]</i>";

                    const executableCode = stripMarkdown(rawResponse);
                    if (!executableCode) {
                        appendChat("Gemini", "No executable code received.");
                        statusLabel.text = "<i>[Ready]</i>";
                        return;
                    }

                    appendChat("Generated Script", executableCode);

                    try {
                        const executionContext = {
                            Studio: Studio,
                            scene: Studio.scene,
                            model: this.model,
                            pluginSystem: this.pluginSystem
                        };

                        executeEditorScript(executableCode, executionContext, `Gemini: ${promptText}`);
                        appendChat("Status", "✓ Executed successfully! Scene Hierarchy updated.");
                        statusLabel.text = "<i>[Success]</i>";
                    } catch (execError) {
                        appendChat("Execution Error", execError.message || String(execError));
                        statusLabel.text = "<i>[Error]</i>";
                    }
                },
                (networkError) => {
                    submitButton.text = "Send";
                    submitButton.enabled = true;
                    statusLabel.text = "<i>[Error]</i>";
                    appendChat("Error", networkError.message || String(networkError));
                }
            );
        };

        // Wire toolbar buttons
        if (inspectBtn.onClick) {
            this.connections.push(inspectBtn.onClick.connect(() => {
                const hierarchy = Studio.getHierarchySnapshot();
                const assets = Studio.getAssetsSnapshot();
                appendChat("Hierarchy Inspector", `Active Objects:\n${hierarchy}\n\nAssets:\n${assets}`);
            }));
        }

        if (undoBtn.onClick) {
            this.connections.push(undoBtn.onClick.connect(() => {
                const history = Studio.history;
                if (history && typeof history.undo === 'function') {
                    history.undo();
                    appendChat("System", "↩️ Reverted last Editor modification via Project History.");
                } else {
                    appendChat("System", "Undo is not available or no changes to undo in this session.");
                }
            }));
        }

        if (clearBtn.onClick) {
            this.connections.push(clearBtn.onClick.connect(() => {
                chatLog.plainText = "=== Gemini Lens Assistant ===\nLog cleared.\nReady for commands.\n";
                statusLabel.text = "<i>[Ready]</i>";
            }));
        }

        // Wire presets
        presets.forEach((p) => {
            const btn = new Studio.ui.PushButton(presetContainer);
            btn.text = p.label;
            if (btn.onClick) {
                this.connections.push(btn.onClick.connect(() => {
                    handleSend(p.prompt);
                }));
            }
            presetLayout.addWidget(btn);
        });
        mainLayout.addWidget(presetContainer);

        // Wire submit & return key
        if (submitButton.onClick) {
            this.connections.push(submitButton.onClick.connect(() => handleSend()));
        }
        if (promptInput.onReturnPressed) {
            this.connections.push(promptInput.onReturnPressed.connect(() => handleSend()));
        }

        return root;
    }

    deinit() {
        this.connections.forEach((c) => {
            if (c && typeof c.disconnect === "function") {
                c.disconnect();
            }
        });
        this.connections = [];
        super.deinit();
    }
}

export default GeminiLensAssistantPanel;
