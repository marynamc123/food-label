# FoodLabel AI

FoodLabel AI is a specialized, regulatory-compliant web application designed for food translators, manufacturers, and importers to translate, normalize, and standardize raw food ingredient lists from foreign languages into professional Hebrew terminology.

## What it does

- **Dynamic Additive Grouping**: Collapses consecutive or matching food additives belonging to the same functional group into standard Hebrew plural forms (e.g., `חומרים משמרים (E202, E281)`).
- **Contextual Category Translation**: Translates additives according to their specified category role (e.g., translating E475 as `חומר מונע התגיישות` if listed under `Anti-caking Agents`, rather than its default chemical role).
- **Intelligent Compound Splitter**: Automatically parses compound blocks like `Thickeners (Acetylated Distarch Adipate, Guar Gum)` into individual rows inside the analysis table to ensure no sub-ingredients are omitted.
- **Embedded E-Number Database**: Features a built-in offline registry of common food additives and starches (E120, E1422, E1450, E1520, etc.) for zero-key local fallback translations.
- **Interactive Label Editor**: Allows users to manually drag-and-drop, delete, or edit Hebrew names, adjusting the final label in real time.
- **Light & Dark Themes**: High-contrast, modern UI featuring sleek transitions, toast alerts, and a fully responsive layout.

## Live link

[[https://your-username.github.io/foodlabel-ai/](https://marynamc123.github.io/food-label/)]

## How to use it

1. **Open the App**: Open the [Live Link][(https://marynamc123.github.io/food-label/)] in any modern web browser (or double-click the `index.html` file to run it locally).
2. **Configure Translation Mode**: 
   - By default, the application runs in **Offline Demo Mode** using local dictionaries.
   - For high-fidelity AI translation, open the **API Settings (הגדרות API)** overlay and enter your Google Gemini API key.
3. **Translate and Polish**: Paste your raw ingredient list into the input box, click **Translate**, and use the interactive table to rearrange, delete, or manually edit ingredients before copying or exporting your final Hebrew label.

> [!IMPORTANT]
> **🔒 API Key Security:**
> To prevent billing charges or key exposure, your Google Gemini API key is **never hardcoded** in any source file in this repository. It is saved purely inside your browser's local storage (`localStorage`) and sent directly to Google's official Gemini endpoint at runtime. It is 100% safe to publish this repository to GitHub.

## Known limitations

- **Offline Database Scope**: The offline heuristic translator is limited to the ~150 common food additives, starches, and standard ingredients defined in the local registry (`database.js`). Unknown ingredients will fall back to basic word-by-word mapping.
- **Gemini API Key Required for AI**: Full contextual and compound translation capabilities require an active internet connection and a user-provided Google Gemini API key.
- **Source Languages**: Optimized for translating lists from European languages (English, French, German, Italian, Spanish) to Hebrew; translations from other languages may have lower accuracy.
- **Browser Cache Dependent**: Translation history and API settings are saved in the browser's local cache; clearing your browser data will clear this saved data.
