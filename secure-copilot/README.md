# Secure Co-pilot 🛡️

**Your Private, Proactive AI Writing Assistant**

> A Chrome Extension built for the Google Chrome Built-in AI Challenge 2025

> Secure Co-pilot is a powerful Chrome extension that helps you write professionally and effectively, with a core focus on privacy. It provides real-time suggestions for grammar, tone, and clarity, ensuring your sensitive data never leaves your computer.

---
## 🚀 Overview
*Secure Co-pilot* is a context-aware AI assistant integrated directly into Chrome.
It helps users rewrite, refine, and enhance text inside any webpage's text fields — securely and privately.
Unlike cloud-based tools, this extension leverages *on-device AI APIs* (chrome.ai) to ensure zero data leakage.

## ✨ Key Features

-   **Proactive Suggestions:** A subtle 🛡️ icon appears next to your text field, offering rewrites or grammar corrections as you type.
-   **Three Powerful Modes:**
    -   **Auto Mode:** Intelligently detects tone (casual, unprofessional) and suggests improvements.
    -   **Professional Mode:** Actively rewrites text to be more formal, constructive, and suitable for a business context.
    -   **Grammar Mode:** Focuses solely on correcting grammar and spelling mistakes.
-   **Complete User Control:** Easily switch modes, disable the extension on specific websites, or turn it off entirely from the popup menu.
    -   Enable / Disable globally or per-site
    -   Block or unblock specific sites
    -   "Clear Data" option removes all stored preferences
    -   Clean, Minimal UI — Suggestion bubble appears neatly above text fields without disturbing the page layout.
    -   Offline-Ready — runs fully offline once installed

-   **Works Everywhere:** Enhances your writing in `textarea` elements and `contenteditable` divs across the web.
-   **100% On-Device Processing:** All AI analysis happens locally on your machine, even when you're offline.
-   **Fallback Support:** If Chrome's AI APIs are unavailable, the extension uses built-in local logic for basic suggestions.

## 🔒 Privacy is Paramount

This extension was built for professionals who handle sensitive information. For the Google Chrome review team and our users, we want to be crystal clear:

**No user data is ever sent to an external server. All processing is done on your local device.**

How is this possible?
-   **`chrome.ai` API:** We use Chrome's built-in, on-device AI models (part of Project Gemini Nano) for all suggestions. This allows for powerful AI assistance without a connection to the cloud.
-   **`chrome.storage.local`:** All settings, including your list of disabled websites, are stored securely on your machine, not synced to the cloud.
-   **No Network Requests:** The extension's core functionality makes no network requests with your text.
-   **Fallback Logic:** When AI APIs are unavailable, local JavaScript functions handle classification and suggestions without external calls.

## 🚀 How to Use

1.  **Start Typing:** Begin writing in any supported text field on any website.
2.  **See the Icon:** The 🛡️ icon will appear in the top-right of the text field once you've written enough text (minimum 10 characters).
3.  **Hover to View:** Hover over the icon to see the AI-powered suggestion in a tooltip.
4.  **Accept or Dismiss:** Click "Accept" to replace your text with the suggestion, or "Dismiss" to keep your original text.
5.  **Customize:** Click the extension icon in your Chrome toolbar to open the popup and change modes or disable the extension for the current site.

## 📦 Installation

### Recommended: From the Chrome Web Store
*(Link will be here once published)*

### For Developers: Local Installation
1.  Clone this repository: `git clone https://github.com/ChandanLabs/secure-copilot.git`
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" in the top-right corner.
4.  Click "Load unpacked".
5.  Select the `secure-copilot` directory from the cloned repository.

### Testing the Extension
-   Open the included `demo.html` file in Chrome to test functionality on sample textareas.
-   The extension will show suggestions for casual or problematic text, and grammar corrections for professional text.

## 🛠️ Technology and Permissions

This extension is built with Manifest V3, ensuring it meets modern standards for security and performance.

-   **`ai`:** The core permission required to access Chrome's on-device AI models (with trial tokens for experimental features).
-   **`storage`:** Used to save your personal settings (mode, disabled sites) locally on your machine.
-   **`activeTab` & `host_permissions`:** Required for the content script to run on web pages and detect text fields. The extension is designed to be active only when you need it, and you can disable it on any site via the popup.
-   **`scripting`:** Allows the extension to inject content scripts dynamically.

### File Structure
-   `manifest.json`: Extension configuration and permissions.
-   `service-worker.js`: Background script handling AI processing and messaging.
-   `content.js`: Content script that attaches to web pages and shows suggestion UI.
-   `popup/`: Popup interface for settings (HTML, CSS, JS).
-   `options.html`: Full options page for advanced settings.
-   `onboarding.html`: Welcome page shown on first install.
-   `demo.html`: Test page with sample textareas.
-   `icons/`: Extension icons in multiple sizes.

## 🤝 Feedback & Contributions

This project is open source! If you have feedback, find a bug, or want to contribute, please [open an issue](https://github.com/ChandanLabs/secure-copilot/issues) on our GitHub repository.

## 📄 License

This project is licensed under the MIT License.
