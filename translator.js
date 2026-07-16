// translator.js - AI & Heuristic Translation Service for FoodLabel AI

// Local aliases for global variables loaded from database.js
var lookupIngredient = window.lookupIngredient;
var eNumbersRegistry = window.eNumbersRegistry;
var standardIngredientsMap = window.standardIngredientsMap;

// System persona and translation constraints
const SYSTEM_INSTRUCTION = `
You are FoodLabel AI, a specialized, domain-specific translation and food-science expert agent. 
Your core objective is to take a raw ingredient list of a food product written in a foreign language (e.g., English, Italian, German) and translate, normalize, and standardize it into professional Hebrew terminology according to local regulations.

Workflow & Chain-of-Thought (CoT) to execute:
1. Parse the input text, handling potential spelling errors, missing commas, or malformed syntax.
2. Identify core ingredients, chemical descriptions, food additives, and allergen statements.
3. Map chemical names and additives to their standardized European local classifications (E-numbers).
4. Determine the industrial functional role of each identified additive (e.g., מווסת חומציות, חומר משמר).
5. Translate the final names into standardized Hebrew technical terms (incorporating proper prefixes and E-numbers where applicable).
   - Standard mapping rule: "Citric Acid" -> Hebrew translation: "מווסת חומציות (E330)", Functional Role: "מווסת חומציות", e_number: "E330".
   - Standard mapping rule: "Soy Lecithin" -> Hebrew translation: "מתחלב (לציטין סויה)" or "מתחלב (E322)", Functional Role: "מתחלב", e_number: "E322".
6. Split compound blocks like "Thickeners (Acetylated Distarch Adipate, Guar Gum)" or "Emulsifiers (Soy Lecithin, E471)" into separate, individual ingredient rows so that no sub-ingredients are omitted.
7. Extract all allergens that the product actually contains (e.g., Gluten from wheat/barley, Soy, Milk, Eggs, Peanuts, Sesame, Tree nuts, Fish, Sulfites) and translate them into a list of standardized Hebrew allergen names under 'contains_allergens'.
8. Extract all allergens that the product may contain or has traces of (e.g. from statements like "may contain traces of tree nuts, milk") and translate them under 'may_contain_allergens'.

Crucial Mapping Rules:
- Plain "Sugar" (generic/plain) MUST always be translated to "סוכר לבן" in Hebrew, unless it is specified as another type of sugar (e.g., "Brown Sugar" -> "סוכר חום", "Cane Sugar" -> "סוכר קנים").
- Flavorings translation: "Artificial flavor / Artificial flavoring / Flavoring / Artificial flavors" MUST be translated to "חומר טעם וריח מלאכותי" (singular) or "חומרי טעם וריח מלאכותיים" (plural) in Hebrew, and NEVER contain the words "סינטטי" or "סינתטי".
- If an ingredient in the original text has a percentage associated with it (e.g., "Compound Chocolate (53%)" or "Cocoa Powder (16%)"), you MUST keep the percentage suffix in the translated Hebrew text (e.g., "שוקולד צימקאו (53%)", "אבקת קקאו (16%)"). Do not drop or omit the percentage!
- Speed & Conciseness Constraint: Keep the 'details' field extremely brief (maximum 10 words). For standard, non-additive ingredients (e.g. Water, Sugar, Salt, Wheat Flour), you MUST set 'details' to an empty string (""). This will optimize output generation time.

Reference Data & Constraints:
- You must maintain absolute deterministic accuracy. Do not hallucinate chemical names or cross-contaminate structurally close chemical formulas.
- If an ingredient is a standard chemical/additive, it must be mapped to its correct E-number and functional role.
- If it is a generic ingredient, translate it accurately to Hebrew, leave 'e_number' and 'role' as null or empty string, and set 'details' to an empty string ("").
- Ensure Hebrew texts use proper RTL character formatting and Hebrew vocabulary matching Israel's Ministry of Health food labeling standards.
`;

/**
 * Normalizes input text and splits it into discrete ingredients based on commas, 
 * semicolons, and parentheses (while keeping parenthesized groups together).
 * @param {string} text 
 * @returns {string[]}
 */
window.splitIngredients = function(text) {
  // Clean raw prefixes like "Ingredients:" or "Ingredients/Zutaten:"
  let cleanText = text.replace(/^(ingredients|ingrédients|zutaten|ingredientes|רכיבים)\s*[:\-\/]/i, "").trim();
  
  const list = [];
  let current = "";
  let parenDepth = 0;
  
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char === "(" || char === "[" || char === "{") parenDepth++;
    if (char === ")" || char === "]" || char === "}") parenDepth--;
    
    if ((char === "," || char === ";") && parenDepth === 0) {
      if (current.trim()) list.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) list.push(current.trim());
  
  return list.map(item => item.replace(/\s+/g, " "));
}

/**
 * Fallback Local Heuristic Translator (Demo Mode)
 * Uses the database mapping matrix to translate ingredients without calling the API.
 * @param {string} text 
 * @returns {object}
 */
window.translateLocally = function(text) {
  const rawItems = splitIngredients(text);
  const expandedItems = [];
  
  // Local compound splitting logic
  rawItems.forEach(item => {
    let cleanItem = item.replace(/\s*\(\s*\d+\s*%\s*\)/g, "").trim();
    const compoundMatch = cleanItem.match(/^([A-Za-z\s\-]+)\s*\(([^)]+)\)$/);
    if (compoundMatch) {
      const category = compoundMatch[1].trim().toLowerCase();
      const knownCategories = ["thickeners", "emulsifiers", "stabilizers", "preservatives", "acids", "antioxidants", "sweeteners", "colors", "gelling agents", "raising agents"];
      if (knownCategories.includes(category) || category.includes("agent") || category.includes("thickener")) {
        const parts = compoundMatch[2].split(",").map(p => p.trim());
        expandedItems.push(...parts);
        return;
      }
    }
    expandedItems.push(item);
  });

  const ingredients = expandedItems.map(item => {
    let cleanItem = item.replace(/\s*\(\s*\d+\s*%\s*\)/g, "")
                        .replace(/\s*\(\s*(?:E|INS)?\s*-?\s*\d{3,4}(?:\([a-zA-Z0-9]\))?[a-zA-Z0-9]?\s*\)/gi, "")
                        .trim();
    let pctMatch = item.match(/\(\s*\d+\s*%\s*\)/);
    let numInParen = item.match(/\(\s*(?:E|INS)?\s*-?\s*(\d{3,4}(?:\([a-zA-Z0-9]\))?[a-zA-Z0-9]?)\s*\)/i);

    const match = lookupIngredient(cleanItem);
    if (match) {
      let translated = match.hebrew_name;
      if (numInParen && !translated.includes(numInParen[1])) {
        translated = `${translated} ${numInParen[0]}`;
      }
      if (pctMatch) {
        translated = `${translated} ${pctMatch[0]}`;
      }
      return {
        original_text: item,
        translated_text: translated,
        e_number: match.e_number,
        role: match.role,
        details: match.details
      };
    }

    // Default heuristics if not in database
    let translated = cleanItem;
    // Simple word-by-word replacement if possible
    const words = cleanItem.split(/\s+/);
    const translatedWords = words.map(w => {
      const wClean = w.toLowerCase().replace(/[^a-z]/g, "");
      return standardIngredientsMap[wClean] || w;
    });
    translated = translatedWords.join(" ");
    if (numInParen) {
      translated = `${translated} ${numInParen[0]}`;
    }
    if (pctMatch) {
      translated = `${translated} ${pctMatch[0]}`;
    }

    return {
      original_text: item,
      translated_text: translated,
      e_number: null,
      role: null,
      details: "רכיב מזון. לא נמצא זיהוי מזהה חומר מוסף (E-number) במאגר המקומי."
    };
  });

  // Local allergen extraction logic
  const lowerText = text.toLowerCase();
  const containsAllergens = [];
  const mayContainAllergens = [];

  const allergenMap = [
    { key: "wheat", val: "גלוטן (חיטה)" },
    { key: "barley", val: "גלוטן (שעורה)" },
    { key: "oat", val: "גלוטן (שיבולת שועל)" },
    { key: "rye", val: "גלוטן (שיפון)" },
    { key: "gluten", val: "גלוטן" },
    { key: "soy", val: "סויה" },
    { key: "soya", val: "סויה" },
    { key: "milk", val: "חלב" },
    { key: "whey", val: "חלב" },
    { key: "butter", val: "חלב" },
    { key: "lactose", val: "חלב" },
    { key: "dairy", val: "חלב" },
    { key: "egg", val: "ביצים" },
    { key: "peanut", val: "בוטנים" },
    { key: "sesame", val: "שומשום" },
    { key: "almond", val: "אגוזים (שקד)" },
    { key: "hazelnut", val: "אגוזים (אגוז לוז)" },
    { key: "cashew", val: "אגוזים (אגוז קשיו)" },
    { key: "pecan", val: "אגוזים (אגוז פקאן)" },
    { key: "walnut", val: "אגוזים (אגוז מלך)" },
    { key: "pistachio", val: "אגוזים (פיסטוק)" },
    { key: "macadamia", val: "אגוזים (מקדמיה)" },
    { key: "mustard", val: "חרדל" },
    { key: "celery", val: "סלרי" },
    { key: "fish", val: "דגים" },
    { key: "sulfite", val: "גופרית דו-חמצנית" },
    { key: "sulphite", val: "גופרית דו-חמצנית" }
  ];

  let containsPart = lowerText;
  let mayContainPart = "";
  const mayContainIndex = lowerText.search(/may contain|traces|facility|shared equipment/);
  if (mayContainIndex !== -1) {
    containsPart = lowerText.substring(0, mayContainIndex);
    mayContainPart = lowerText.substring(mayContainIndex);
  }

  allergenMap.forEach(item => {
    const reg = new RegExp("\\b" + item.key + "\\w*\\b");
    if (reg.test(containsPart)) {
      if (!containsAllergens.includes(item.val)) containsAllergens.push(item.val);
    }
    if (mayContainPart && reg.test(mayContainPart)) {
      if (!mayContainAllergens.includes(item.val) && !containsAllergens.includes(item.val)) {
        mayContainAllergens.push(item.val);
      }
    }
  });

  return { 
    ingredients, 
    contains_allergens: containsAllergens, 
    may_contain_allergens: mayContainAllergens 
  };
}

/**
 * AI-powered Translation using Gemini API
 * @param {string} text 
 * @param {string} apiKey 
 * @param {function} progressCallback 
 * @returns {Promise<object>}
 */
window.translateWithGemini = async function(text, apiKey, modelName = "gemini-1.5-flash", progressCallback = () => {}) {
  try {
    progressCallback("Preparing translation engine...", 10);
    
    const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    progressCallback("Analyzing ingredients & additives...", 40);

    const promptText = `
Translate and standardize this ingredient list according to the schema:
"${text}"
`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            ingredients: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  original_text: { 
                    type: "STRING", 
                    description: "The raw text fragment from the input, preserving percentages (e.g. 'Compound Chocolate (53%)')" 
                  },
                  translated_text: { 
                    type: "STRING", 
                    description: "The standardized Hebrew translation, preserving percentages (e.g. 'שוקולד צימקאו (53%)' or 'סוכר לבן')" 
                  },
                  e_number: { 
                    type: "STRING", 
                    description: "The official E-number like 'E330', or empty string if not applicable" 
                  },
                  role: { 
                    type: "STRING", 
                    description: "The industrial functional role in Hebrew like 'מווסת חומציות', or empty string" 
                  },
                  details: { 
                    type: "STRING", 
                    description: "Concise details under 10 words for E-numbers, or empty string for standard ingredients" 
                  }
                },
                required: ["original_text", "translated_text", "e_number", "role", "details"]
              }
            },
            contains_allergens: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Allergens this product contains, translated to standard Hebrew (e.g., 'גלוטן (חיטה)', 'סויה', 'חלב')"
            },
            may_contain_allergens: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Allergens this product may contain traces of, translated to standard Hebrew (e.g., 'בוטנים', 'אגוזים')"
            }
          },
          required: ["ingredients", "contains_allergens", "may_contain_allergens"]
        }
      }
    };

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Server error (${response.status})`;
      throw new Error(`Gemini connection error: ${errorMessage}`);
    }

    progressCallback("Verifying against database registry...", 75);
    const data = await response.json();
    
    // Parse the output string
    let result;
    try {
      if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
        const candidate = data.candidates?.[0];
        const finishReason = candidate?.finishReason || "UNKNOWN";
        throw new Error(`Gemini translation blocked. Reason: ${finishReason}`);
      }
      let rawJson = data.candidates[0].content.parts[0].text.trim();
      if (rawJson.startsWith("```")) {
        rawJson = rawJson.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
      }
      result = JSON.parse(rawJson);
    } catch (e) {
      console.error("Gemini parse error details:", e, data);
      throw new Error(e.message.includes("blocked") ? e.message : "Received malformed JSON structure from Gemini. Please try again.");
    }

    progressCallback("Normalizing translations...", 90);

    // Deterministic validation: Cross check E-numbers with our local registry
    if (result && Array.isArray(result.ingredients)) {
      result.ingredients = result.ingredients.map(ing => {
        // Enforce deterministic values from database for mapped additives
        if (ing.e_number) {
          const eNumClean = ing.e_number.trim().toUpperCase().replace(/\s+/g, "");
          if (eNumbersRegistry[eNumClean]) {
            const dbData = eNumbersRegistry[eNumClean];
            ing.e_number = eNumClean;
            ing.role = dbData.role;
            ing.details = dbData.details || ing.details;
          }
        }
        // Clean any accidental typos like "ריריח" / "וריריח" from the AI translation
        if (ing.translated_text) {
          ing.translated_text = ing.translated_text.replace(/ו?ריריח/g, match => match.startsWith('ו') ? 'וריח' : 'ריח');
          ing.translated_text = ing.translated_text
            .replace(/חומרי טעם וריח סינ[תט]יים/g, "חומרי טעם וריח מלאכותיים")
            .replace(/חומר טעם וריח סינ[תט]י/g, "חומר טעם וריח מלאכותי");
        }
        if (ing.role) {
          ing.role = ing.role.replace(/ו?ריריח/g, match => match.startsWith('ו') ? 'וריח' : 'ריח');
          ing.role = ing.role
            .replace(/חומרי טעם וריח סינ[תט]יים/g, "חומרי טעם וריח מלאכותיים")
            .replace(/חומר טעם וריח סינ[תט]י/g, "חומר טעם וריח מלאכותי");
        }
        if (ing.details) {
          ing.details = ing.details.replace(/ו?ריריח/g, match => match.startsWith('ו') ? 'וריח' : 'ריח');
        }

        const numMatch = ing.original_text ? ing.original_text.match(/\(\s*(?:E|INS)?\s*-?\s*(\d{3,4}(?:\([a-zA-Z0-9]\))?[a-zA-Z0-9]?)\s*\)/i) : null;
        if (numMatch) {
          const numStr = numMatch[1];
          if (ing.translated_text && !ing.translated_text.includes(numStr)) {
            ing.translated_text = `${ing.translated_text} (${numStr})`;
          }
        } else if (ing.e_number) {
          const cleanNum = ing.e_number.replace(/^E/i, "").toLowerCase();
          const rawInput = text.toLowerCase();
          const escapedCleanNum = cleanNum.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          if (rawInput.includes(cleanNum)) {
            const regex = new RegExp(`\\b((?:E|INS)?\\s*-?\\s*${escapedCleanNum})\\b`, 'i');
            const match = text.match(regex);
            const formatNum = match ? match[1] : cleanNum;
            if (ing.translated_text && !ing.translated_text.includes(formatNum)) {
              ing.translated_text = `${ing.translated_text} (${formatNum})`;
            }
          }
        }
        return ing;
      });
    }

    if (result) {
      if (Array.isArray(result.contains_allergens)) {
        result.contains_allergens = result.contains_allergens.map(a => a.replace(/ו?ריריח/g, match => match.startsWith('ו') ? 'וריח' : 'ריח'));
      }
      if (Array.isArray(result.may_contain_allergens)) {
        result.may_contain_allergens = result.may_contain_allergens.map(a => a.replace(/ו?ריריח/g, match => match.startsWith('ו') ? 'וריח' : 'ריח'));
      }
    }

    progressCallback("Translation completed!", 100);
    return result;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}
