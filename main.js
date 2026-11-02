import PanelPlugin from 'LensStudio:PanelPlugin';
import { Descriptor, DockState, Size } from 'LensStudio:PanelPlugin';
import * as Ui from 'LensStudio:Ui';
import * as Network from 'LensStudio:Network';

/**
 * =========================================================================
 * Gemini Lens Assistant - Lens Studio 5.x Editor Plugin
 * =========================================================================
 * Embeds a custom AI chat panel inside the Lens Studio UI that connects to
 * the Gemini API and directly executes Editor API commands to build and
 * modify lenses in real-time.
 */

// -------------------------------------------------------------------------
// Active Gemini API Key
// -------------------------------------------------------------------------
// Supports loading from a local config.json (gitignored for security),
// the UI input field, or directly replacing the placeholder below.
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
// Lens Studio Editor API Studio Namespace Adapter
// -------------------------------------------------------------------------
const Studio = {
    ui: Ui,
    pluginSystem: null,
    model: null,
    get project() {
        if (this.model && this.model.project) {
            return this.model.project;
        }
        if (typeof Editor !== 'undefined' && Editor.Model && Editor.Model.project) {
            return Editor.Model.project;
        }
        return null;
    },
    get scene() {
        const proj = this.project;
        if (proj && proj.scene) {
            return proj.scene;
        }
        if (typeof globalThis !== 'undefined' && globalThis.scene) {
            return globalThis.scene;
        }
        return null;
    }
};

// Expose on globalThis for generated scripts
if (typeof globalThis !== 'undefined') {
    globalThis.Studio = Studio;
}

// -------------------------------------------------------------------------
// System Prompt Injection
// -------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a Lens Studio Editor API execution agent.
Your mission is to generate raw, valid, executable JavaScript code designed for the Lens Studio 5.x Editor API to build, inspect, and modify lenses according to the user's instructions.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid, executable JavaScript code.
2. Do NOT wrap code in markdown code blocks (do not use \`\`\`javascript or \`\`\`).
3. Do NOT provide explanations, preamble, commentary, or conversational text.
4. Directly utilize the Lens Studio Editor API:
   - Create Scene Objects:
     var obj = Studio.project.scene.createSceneObject("ObjectName");
     // or: var obj = scene.createSceneObject("ObjectName");
   - Manipulate Transform:
     var transform = obj.getTransform();
     transform.setLocalPosition(new vec3(0, 0, -50));
     transform.setLocalScale(new vec3(1, 1, 1));
     transform.setLocalRotation(quat.fromEulerAngles(0, 0, 0));
   - Set Parent / Hierarchy:
     childObj.setParent(parentObj);
   - Add & Configure Components:
     var textComp = obj.createComponent("Component.Text");
     if (textComp) { textComp.text = "Hello World"; textComp.size = 36; }
     var lightComp = obj.createComponent("Component.LightSource");
     var camComp = obj.createComponent("Component.Camera");
     var meshComp = obj.createComponent("Component.RenderMeshVisual");
     var headComp = obj.createComponent("Component.Head");
   - Access AssetManager:
     var assetManager = Studio.project.assetManager;
5. Ensure clean ES6/ES5 JavaScript syntax with properly declared variables.`;

// -------------------------------------------------------------------------
// Execution Engine: Markdown Stripper & Safe Code Runner
// -------------------------------------------------------------------------
/**
 * Strips out any markdown syntax, code fences, or backticks from model output.
 * @param {string} rawText
 * @returns {string} Clean JavaScript code
 */
function stripMarkdown(rawText) {
    if (!rawText) return "";
    let code = rawText.trim();

    // Match code enclosed in ```javascript ... ``` or ```js ... ``` or ``` ... ```
    const codeBlockMatch = code.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        code = codeBlockMatch[1].trim();
    } else {
        // Strip any leading/trailing backticks
        code = code.replace(/^`+|`+$/g, '').trim();
    }

    return code;
}

/**
 * Safely executes the generated Editor API script in the context of the active scene.
 * @param {string} code 
 * @param {object} context 
 * @returns {any} Result of script execution
 */
function executeEditorScript(code, context) {
    const { Studio, scene, model, pluginSystem } = context;

    // Ensure Studio and scene are available on globalThis
    if (typeof globalThis !== 'undefined') {
        globalThis.Studio = Studio;
        if (scene && typeof globalThis.scene === 'undefined') {
            globalThis.scene = scene;
        }
    }

    // Build runner function binding Studio, scene, and math helpers
    const scriptRunner = new Function(
        "Studio",
        "scene",
        "model",
        "pluginSystem",
        "vec3",
        "vec2",
        "vec4",
        "quat",
        `"use strict";
        try {
            ${code}
        } catch (err) {
            throw err;
        }`
    );

    return scriptRunner(
        Studio,
        scene,
        model,
        pluginSystem,
        typeof vec3 !== 'undefined' ? vec3 : undefined,
        typeof vec2 !== 'undefined' ? vec2 : undefined,
        typeof vec4 !== 'undefined' ? vec4 : undefined,
        typeof quat !== 'undefined' ? quat : undefined
    );
}

// -------------------------------------------------------------------------
// Network Logic: Gemini API Requester
// -------------------------------------------------------------------------
/**
 * Makes an HTTP request to the Gemini API endpoint.
 * @param {string} apiKey 
 * @param {string} userPrompt 
 * @param {function} onSuccess 
 * @param {function} onError 
 */
function requestGeminiGeneration(apiKey, userPrompt, onSuccess, onError) {
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
        onError(new Error("Please configure a valid Gemini API Key before sending requests."));
        return;
    }

    const targetUrl = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

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
                    { text: userPrompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
        }
    };

    const payloadJson = JSON.stringify(requestPayload);

    // Primary: LensStudio:Network module
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
                    onError(new Error("Network response was empty."));
                    return;
                }
                if (response.error) {
                    onError(new Error("Lens Studio Network Error: " + response.error));
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
                        onError(new Error("Failed to parse response JSON: " + jsonErr.message + "\nRaw: " + responseBody));
                    }
                } else {
                    onError(new Error(`Gemini API returned HTTP ${statusCode}:\n${responseBody}`));
                }
            });
            return;
        } catch (netEx) {
            print("[Gemini Assistant] LensStudio:Network exception: " + netEx);
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
                return res.text().then((errText) => {
                    throw new Error(`Gemini API returned HTTP ${res.status}: ${errText}`);
                });
            }
            return res.json();
        })
        .then((data) => {
            const rawCandidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            onSuccess(rawCandidateText);
        })
        .catch((fetchErr) => {
            onError(fetchErr);
        });
        return;
    }

    onError(new Error("No compatible network interface found (LensStudio:Network or fetch is unavailable)."));
}

// -------------------------------------------------------------------------
// Lens Studio 5.x PanelPlugin Implementation
// -------------------------------------------------------------------------
export class GeminiLensAssistantPanel extends PanelPlugin {
    /**
     * Plugin Descriptor configuration
     */
    static descriptor() {
        const d = new Descriptor();
        d.id = "com.gemini.lensassistant";
        d.name = "Gemini Lens Assistant";
        d.description = "AI chat panel that connects to Gemini and executes Editor API commands to build and modify lenses in real-time.";
        d.defaultDockState = DockState.Attached;
        d.defaultSize = new Size(380, 540);
        d.minimumSize = new Size(280, 360);
        d.isUnique = true;
        d.menuActionHierarchy = ["Window", "Gemini Lens Assistant"];
        return d;
    }

    constructor(pluginSystem, descriptor) {
        super(pluginSystem, descriptor);
        this.connections = [];
        this.pluginSystem = pluginSystem;

        // Resolve Model Interface from plugin system
        try {
            if (typeof Editor !== 'undefined' && Editor.Model && Editor.Model.IModel) {
                this.model = pluginSystem.findInterface(Editor.Model.IModel);
            }
        } catch (e) {
            print("[Gemini Assistant] Model interface lookup: " + e);
        }

        // Configure Studio namespace
        Studio.pluginSystem = pluginSystem;
        Studio.model = this.model;
        globalThis.Studio = Studio;
    }

    /**
     * Build the custom dockable widget using Studio.ui
     */
    createWidget(parent) {
        // Root container widget
        const root = new Studio.ui.Widget(parent);
        const mainLayout = new Studio.ui.BoxLayout();
        mainLayout.setDirection(Studio.ui.Direction.TopToBottom);
        mainLayout.spacing = 8;
        root.layout = mainLayout;

        // Top Header
        const headerLabel = new Studio.ui.Label(root);
        headerLabel.text = "<b>✨ Gemini Lens Assistant</b>";
        mainLayout.addWidget(headerLabel);

        // API Key configuration row (editable in UI)
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

        // Quick Preset Chips / Buttons
        const presetContainer = new Studio.ui.Widget(root);
        const presetLayout = new Studio.ui.BoxLayout();
        presetLayout.setDirection(Studio.ui.Direction.LeftToRight);
        presetLayout.spacing = 4;
        presetContainer.layout = presetLayout;

        const presets = [
            { label: "+ 3D Text", prompt: "Create a 3D Text object named 'Welcome' with text 'Hello Lens' at position (0, 0, -50)" },
            { label: "+ Light", prompt: "Create a Directional Light object named 'SunLight' pointing forward" },
            { label: "+ Camera", prompt: "Create a Perspective Camera object named 'MainCamera'" },
            { label: "+ Face Rig", prompt: "Create a Face Tracking Head component object named 'FaceTracker'" }
        ];

        // Scrollable Text Area for Chat Log
        const chatLog = new Studio.ui.TextEdit(root);
        chatLog.readOnly = true;
        chatLog.placeholderText = "Conversation history and executed commands...";
        chatLog.plainText = "=== Gemini Lens Assistant ===\nReady to build and modify lenses with Gemini AI.\nType a request below or click a quick action above.\n";
        mainLayout.addWidget(chatLog);

        // Helper to append messages to chat log
        const appendChat = (sender, message) => {
            const current = chatLog.plainText;
            chatLog.plainText = current + `\n[${sender}]:\n${message}\n`;

            if (chatLog.textCursor) {
                try {
                    const cursor = chatLog.textCursor;
                    cursor.movePosition(Studio.ui.TextCursor.MoveOperation.End, Studio.ui.TextCursor.MoveMode.MoveAnchor);
                    chatLog.textCursor = cursor;
                } catch (e) {
                    // Ignore cursor scroll errors
                }
            }
        };

        // Horizontal layout for text input and action buttons
        const inputContainer = new Studio.ui.Widget(root);
        const inputLayout = new Studio.ui.BoxLayout();
        inputLayout.setDirection(Studio.ui.Direction.LeftToRight);
        inputLayout.spacing = 6;
        inputContainer.layout = inputLayout;

        // Text input field for user prompts
        const promptInput = new Studio.ui.LineEdit(inputContainer);
        promptInput.placeholderText = "Describe what to build (e.g. 'Add a red spotlight')...";
        inputLayout.addWidget(promptInput);

        // Submit Button
        const submitButton = new Studio.ui.PushButton(inputContainer);
        submitButton.text = "Send";
        inputLayout.addWidget(submitButton);

        // Clear Chat Button
        const clearButton = new Studio.ui.PushButton(inputContainer);
        clearButton.text = "Clear";
        inputLayout.addWidget(clearButton);

        mainLayout.addWidget(inputContainer);

        // Action handler for sending prompt to Gemini & executing the result
        const handleSend = (customPrompt) => {
            const promptText = customPrompt || (promptInput.text ? promptInput.text.trim() : "");
            if (!promptText) {
                return;
            }

            // Sync API key from input field
            const activeKey = apiKeyInput.text ? apiKeyInput.text.trim() : currentApiKey;

            // Clear input field
            if (!customPrompt) {
                promptInput.text = "";
            }

            // Display user prompt in chat log
            appendChat("User", promptText);
            appendChat("System", "Contacting Gemini API...");

            submitButton.text = "Generating...";
            submitButton.enabled = false;

            // Send request to Gemini
            requestGeminiGeneration(
                activeKey,
                promptText,
                (rawResponse) => {
                    submitButton.text = "Send";
                    submitButton.enabled = true;

                    // Parse and strip markdown formatting
                    const executableCode = stripMarkdown(rawResponse);

                    if (!executableCode) {
                        appendChat("Gemini", "No executable code received.");
                        return;
                    }

                    appendChat("Generated Code", executableCode);

                    // Execute generated code via Editor API execution engine
                    try {
                        const executionContext = {
                            Studio: Studio,
                            scene: Studio.scene,
                            model: this.model,
                            pluginSystem: this.pluginSystem
                        };

                        executeEditorScript(executableCode, executionContext);
                        appendChat("Status", "✓ Executed successfully! Scene Hierarchy updated.");
                    } catch (execError) {
                        appendChat("Execution Error", execError.message || String(execError));
                    }
                },
                (networkError) => {
                    submitButton.text = "Send";
                    submitButton.enabled = true;
                    appendChat("Error", networkError.message || String(networkError));
                }
            );
        };

        // Hook up preset buttons
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

        // Hook up submit button
        if (submitButton.onClick) {
            this.connections.push(submitButton.onClick.connect(() => handleSend()));
        }

        // Hook up clear button
        if (clearButton.onClick) {
            this.connections.push(clearButton.onClick.connect(() => {
                chatLog.plainText = "=== Gemini Lens Assistant ===\nLog cleared.\nReady for commands.\n";
            }));
        }

        // Hook up Enter key on text input
        if (promptInput.onReturnPressed) {
            this.connections.push(promptInput.onReturnPressed.connect(() => handleSend()));
        }

        return root;
    }

    /**
     * Cleanup event connections on panel unloading
     */
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
