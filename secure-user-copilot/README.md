# Secure Co-pilot 🛡

*Proactive, Privacy-First AI Assistant for Sensitive Text Fields*

---

## Overview

Cloud-based AI tools like ChatGPT are amazing, but they can’t safely touch sensitive professional data (performance reviews, contracts, patient notes, etc.). Secure Co-pilot solves this problem by providing *real-time, client-side AI suggestions* *without ever sending data to the cloud*.

This is a *Chrome extension* that acts as a "data-blind" AI co-pilot. It:

- Monitors text inputs and contenteditable fields.
- Detects unprofessional or casual writing.
- Suggests professional rewrites or grammar fixes *proactively*.
- Runs entirely on-device (client-side) for *maximum privacy*.

---

## Key Features

| Feature | Description |
|---------|-------------|
| *Proactive AI* | Suggests improvements as you type instead of waiting for corrections. |
| *Privacy-first* | Data never leaves the user’s device; no cloud calls required for fallback logic. |
| *AI Chaining* | Triage → Rewriter → Proofreader using Chrome built-in AI APIs (Gemini Nano). |
| *Popup Dashboard* | Toggle extension on/off, choose AI mode (Auto / Professional / Grammar), and view activity. |
| *Fallback Logic* | Regex-based quick classifier and rewrite/proofread for offline use. |
| *Multi-Field Support* | Works on textareas and contenteditable elements across any website. |

---

## APIs Used

- chrome.ai.prompt → Triage classification (Professional / Casual / Problematic)
- chrome.ai.rewriter → Suggest professional rewrites
- chrome.ai.proofreader → Grammar fixes
- chrome.storage.local → Persistent user settings (enable/disable, AI mode)
- chrome.runtime.sendMessage → Communication between content script, service worker, and popup

Fallbacks are implemented for users without Early Preview access or unsupported browsers.

---

## Project Structure