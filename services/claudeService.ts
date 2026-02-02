import Anthropic from "@anthropic-ai/sdk";
import { SourceLanguage, TranslationResult } from "../types";
import { extractTextFromImage } from "./geminiService";

export const translateImageContentWithClaude = async (
  base64Image: string,
  mimeType: string,
  sourceLanguage: SourceLanguage,
  apiKey?: string,
  modelId: string = "claude-3-5-sonnet-20240620",
  geminiApiKey?: string
): Promise<TranslationResult> => {
  
  const finalApiKey = apiKey || process.env.CLAUDE_API_KEY;

  if (!finalApiKey) {
    throw new Error("Claude API Key is missing. Please add it in Settings.");
  }

  // STEP 1: Use Gemini to OCR the image
  // We pass the geminiApiKey if available, otherwise it falls back to default in geminiService
  let extractedText = "";
  try {
    extractedText = await extractTextFromImage(base64Image, mimeType, geminiApiKey);
  } catch (ocrError: any) {
    console.error("OCR Step Failed:", ocrError);
    // Propagate the specific error message if it's available
    throw new Error(ocrError.message || "Gemini failed to extract text from the image. Cannot proceed with Claude translation.");
  }

  if (!extractedText || extractedText.trim().length === 0) {
    return {
      detectedLanguage: "Unknown",
      segments: []
    };
  }

  // STEP 2: Use Claude to Translate the Extracted Text
  // Initialize Anthropic
  const anthropic = new Anthropic({
    apiKey: finalApiKey,
    dangerouslyAllowBrowser: true 
  });
  
  // Dynamic Prompt Construction
  let contextInstruction = "";
  let specificRules = "";

  if (sourceLanguage === SourceLanguage.KOREAN) {
    contextInstruction = "The input text is KOREAN (Hangul).";
    specificRules = `
    KOREAN SPECIFIC RULES:
    - Translate "Section Chief" (Gwjang/Kwajang) strictly as "Deputy Manager".
    - Translate "Sunbae" as "Senior".
    - Keep names consistent. Do not anglicize Korean names (e.g., keep "Minji").
    `;
  } else if (sourceLanguage === SourceLanguage.SPANISH) {
    contextInstruction = "The input text is SPANISH.";
    specificRules = `
    SPANISH SPECIFIC RULES:
    - Maintain the nuance of formal (usted) vs informal (tú) address in the English tone where appropriate.
    - Treat this strictly as Spanish language content.
    `;
  } else {
    // AUTO
    contextInstruction = "Identify the language of the provided text. It is likely KOREAN or SPANISH.";
    specificRules = `
    AUTO-DETECTION RULES:
    1. First, visually identify the script (Hangul vs Latin).
    2. Apply the appropriate translation nuances for the detected language.
    `;
  }

  const systemPrompt = `
    You are an expert translator specializing in translating text (Manhwa, Webtoons, Adult/NSFW content, Documents) into PERFECT, NATURAL ENGLISH.

    OBJECTIVE:
    Translate the provided raw text (extracted via OCR from an image) into fluent, grammatically correct English.

    CONTEXT:
    ${contextInstruction}

    CRITICAL STYLE & FORMATTING RULES:
    1. **Lowercase Aesthetic (Strict)**:
       - ONLY capitalize the **First letter** of a new sentence.
       - ALWAYS capitalize the pronoun "**I**" and its contractions (**I'm**, **I'll**, **I'd**, **I've**). NEVER write 'i' for the self-pronoun.
       - Keep ALL other text in lowercase (including titles, emphasis, etc.), unless it is a specific Proper Name that requires it.
    2. **Natural Flow & Grammar**:
       - Do not translate word-for-word. Focus on the *meaning* and *flow*.
       - The English must sound like it was written by a native speaker.
       - Fix choppy sentence structures from the source text.
    3. **Uncensored Content Policy**:
       - You are a neutral translation engine.
       - You MUST translate **ALL** content provided, including explicit, sexual, adult, vulgar, slang, or violent themes, exactly as intended by the source text.
       - Do not sanitize, bowdlerize, censor, or moralize. 
       - Do not omit text because it is "inappropriate". Just translate it accurately.

    SPECIFIC RULES:
    - The output JSON "target" field MUST BE IN ENGLISH.
    ${specificRules}

    OUTPUT FORMAT:
    - Return ONLY raw JSON. 
    - DO NOT use Markdown code blocks (no \`\`\`json).
    - DO NOT add conversational filler.
    
    JSON Structure:
    {
      "detectedLanguage": "Detected Source Language",
      "segments": [
        { "source": "Original text segment from input", "target": "The English translation" }
      ]
    }
  `;

  const userPrompt = `
    Here is the text extracted from the image:
    
    """
    ${extractedText}
    """

    Translate this text to English now. Split it into logical segments for the JSON output.
  `;

  try {
    const msg = await anthropic.messages.create({
      model: modelId,
      max_tokens: 4096,
      temperature: 0, 
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt // Sending TEXT only now, not image
        },
      ],
    });

    // Extract text content
    const textBlock = msg.content.find(c => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error("No text response from Claude");
    
    const text = textBlock.text;
    
    // Robust JSON extraction
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    let jsonStr = "";
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = text.substring(firstBrace, lastBrace + 1);
    } else {
      jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "\nOriginal Text:", text);
      throw new Error("Failed to parse response. The model returned invalid JSON.");
    }
    
    // Post-processing to enforce strict capitalization rules via code
    const segments = Array.isArray(parsed.segments) ? parsed.segments.map((seg: any) => {
      let target = seg.target || "";
      
      // Rule 1: Always capitalize the first letter of the sentence
      if (target.length > 0) {
        target = target.charAt(0).toUpperCase() + target.slice(1);
      }

      // Rule 2: Always capitalize the pronoun "I" and its contractions (i'm, i'll, i'd, i've)
      // The regex /\bi\b/g matches the letter 'i' when it is a whole word or part of a contraction.
      target = target.replace(/\bi\b/g, 'I');

      return {
        source: seg.source,
        target: target
      };
    }) : [];

    const detectedLanguage = parsed.detectedLanguage || (sourceLanguage === SourceLanguage.AUTO ? "Unknown" : sourceLanguage);

    return {
      detectedLanguage,
      segments
    };

  } catch (error: any) {
    console.error("Claude API Error:", error);
    
    if (error?.status === 401) {
       throw new Error("Invalid Claude API Key. Please check your key in Settings.");
    }
    if (error?.status === 404) {
      throw new Error(`Model ${modelId} not found. Please select a valid model in Settings.`);
    }
    if (error?.type === 'overloaded_error') {
      throw new Error("Claude API is currently overloaded. Please try again in a moment.");
    }
    
    const errorMessage = error?.message || "";
    if (errorMessage.includes("Failed to parse response")) {
        throw new Error("Translation failed due to invalid response format.");
    }

    throw new Error(errorMessage || "Failed to translate text with Claude.");
  }
};