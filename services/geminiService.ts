import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { SourceLanguage, TranslationResult } from "../types";

// Use Flash for OCR tasks (faster, higher rate limits)
const OCR_MODEL = "gemini-3-flash-preview";

// Translation Models
const TRANSLATION_MODEL_PRO = "gemini-3-pro-preview";
const TRANSLATION_MODEL_FLASH = "gemini-3-flash-preview";

// Helper: Wait function for backoff
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Get AI Client with dynamic key
const getAiClient = (apiKey?: string) => {
  // Priority: User Provided Key -> Environment Variable
  const finalKey = apiKey || process.env.API_KEY;

  if (!finalKey) {
     console.warn("No API Key found. Operations likely to fail if not handled upstream.");
  }

  return new GoogleGenAI({ apiKey: finalKey! });
};

// Helper: Check if error is related to quota/rate limits
const isQuotaError = (error: any): boolean => {
  const errorCode = error?.status || error?.code || error?.error?.code;
  const errorMessage = error?.message || JSON.stringify(error);
  
  return errorCode === 429 || 
         errorMessage.includes('429') || 
         errorMessage.toLowerCase().includes('quota') ||
         errorMessage.toLowerCase().includes('resource_exhausted');
};

// Helper: Retry logic with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  delay: number = 2000 
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (isQuotaError(error) && retries > 0) {
      console.warn(`Gemini API Rate Limited. Retrying in ${delay}ms... (${retries} retries left)`);
      await wait(delay);
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Helper function to extract raw text using Gemini (OCR)
export const extractTextFromImage = async (
  base64Image: string,
  mimeType: string,
  apiKey?: string
): Promise<string> => {
  const ai = getAiClient(apiKey);
  
  const prompt = `
    Perform high-accuracy OCR (Optical Character Recognition) on this image.
    1. Extract ALL text visible in the image exactly as it appears.
    2. Do NOT translate the text. Keep it in the original language (Korean, Spanish, etc.).
    3. Preserve the logical structure (line breaks) where possible.
    4. If there is no text, return an empty string.
    5. Return ONLY the raw extracted text. Do not add markdown or explanations.
  `;

  try {
    // Use OCR_MODEL (Flash) for extraction
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: OCR_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: prompt
          }
        ]
      }
    }));

    const text = response.text;
    if (!text) return "";
    return text.trim();

  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    if (isQuotaError(error)) {
        throw new Error("Gemini API Quota Exceeded (OCR). Please check your API key.");
    }
    throw new Error("Failed to extract text from image using Gemini.");
  }
};

export const translateImageContent = async (
  base64Image: string,
  mimeType: string,
  sourceLanguage: SourceLanguage,
  apiKey?: string,
  proApiKey?: string
): Promise<TranslationResult> => {
  
  // Client for Flash/Fallback attempts
  const flashClient = getAiClient(apiKey);
  
  // Client for Pro attempts
  const proClient = getAiClient(proApiKey || apiKey);

  let languageInstruction = "";
  if (sourceLanguage === SourceLanguage.KOREAN) {
    languageInstruction = "The text in the image is Korean.";
  } else if (sourceLanguage === SourceLanguage.SPANISH) {
    languageInstruction = "The text in the image is Spanish.";
  } else {
    languageInstruction = "Identify the language of the text in the image (it is likely Korean or Spanish).";
  }

  const prompt = `
    ${languageInstruction}
    Please perform the following steps:
    1. Transcribe the text found in the image.
    2. Split the text into logical segments (sentences, phrases, or bullet points) for easy reading.
    3. Translate each segment into English.
    
    IMPORTANT Translation Rules regarding Names, Titles, Honorifics & Consistency:
    1. **Strict Consistency**: You MUST maintain the exact same English term for a specific person's title, role, honorific, OR NAME throughout the translation.
    2. **Character Names**: 
         - Identify character names early.
         - Use the EXACT same spelling/romanization for the same character throughout the entire text.
         - Do NOT vary the spelling (e.g., do not switch between "Min-su" and "Minsu").
         - Do NOT Anglicize names (e.g., keep "Minji", do not change to "Minnie").
    3. **Specific Mappings**: 
         - Translate "sunbae" (or equivalent terms like 선배) strictly as "senior".
         - Translate "ajumma" (or equivalent terms like 아줌마) strictly as "ma'am".
         - **CRITICAL**: Translate "Section Chief" (or the Korean term 과장) strictly as "Deputy Manager". Do NOT use "Section Chief".
    4. **Professional Titles**: If a character is addressed by a professional title (Director, Team Leader, Teacher, Doctor, etc.), preserve that specific title in English consistently (except for 'Section Chief' which must be 'Deputy Manager').

    IMPORTANT formatting rule for English:
    - Output the English translation in lowercase.
    - **MANDATORY CAPITALIZATION EXCEPTIONS**:
      1. The first letter of the sentence/segment MUST be capitalized.
      2. The pronoun "I" MUST ALWAYS be capitalized (e.g., "I think...", "I am..."). NEVER output the pronoun "I" as "i".
    - Do not capitalize proper nouns (names, places, etc.) unless they are the first word.
    
    Return the output in the following JSON format ONLY (do not add Markdown code blocks around the JSON):
    {
      "detectedLanguage": "The detected source language (e.g. Korean, Spanish)",
      "segments": [
        {
          "source": "Original text segment 1",
          "target": "English translation 1"
        },
        {
          "source": "Original text segment 2",
          "target": "English translation 2"
        }
      ]
    }
  `;

  // Internal function to execute the request with a specific client
  const executeTranslation = async (model: string, client: GoogleGenAI) => {
    return await retryWithBackoff<GenerateContentResponse>(() => client.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    }));
  };

  try {
    let response: GenerateContentResponse;
    
    // STRATEGY: Try Pro first (using Pro Client), Fallback to Flash (using Flash Client)
    try {
      console.log(`Attempting translation with ${TRANSLATION_MODEL_PRO}...`);
      response = await executeTranslation(TRANSLATION_MODEL_PRO, proClient);
    } catch (error: any) {
      if (isQuotaError(error)) {
        console.warn(`Quota exceeded for ${TRANSLATION_MODEL_PRO}. Falling back to ${TRANSLATION_MODEL_FLASH}...`);
        response = await executeTranslation(TRANSLATION_MODEL_FLASH, flashClient);
      } else {
        throw error; // Re-throw non-quota errors
      }
    }

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse Gemini JSON:", text);
        const match = text.match(/```json\n([\s\S]*?)\n```/);
        if (match) {
            parsed = JSON.parse(match[1]);
        } else {
             throw new Error("Invalid JSON response from Gemini");
        }
    }
    
    // Validate structure roughly
    const segmentsRaw = Array.isArray(parsed.segments) ? parsed.segments : [];
    
    // Post-processing
    const segments = segmentsRaw.map((seg: any) => {
      let target = seg.target || "";
      
      // Rule 1: Always capitalize the first letter of the sentence
      if (target.length > 0) {
        target = target.charAt(0).toUpperCase() + target.slice(1);
      }

      // Rule 2: Always capitalize the pronoun "I" and its contractions
      target = target.replace(/\bi\b/g, 'I');

      return {
        source: seg.source,
        target: target
      };
    });

    const detectedLanguage = parsed.detectedLanguage || sourceLanguage;

    return {
      detectedLanguage,
      segments
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    if (isQuotaError(error)) {
        throw new Error("Gemini API Quota Exceeded. Please check your API key in Settings.");
    }
    
    throw new Error("Failed to process image. Please try again.");
  }
};