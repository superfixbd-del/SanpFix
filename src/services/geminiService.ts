import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY || '' 
});

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calls Gemini API with automatic retry on 429 (Rate Limit) errors.
 */
export async function callGeminiWithRetry(modelName: string, contents: any, maxRetries = 3) {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // @ts-ignore - Using the models.generateContent pattern that was working
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents
      });
      return response;
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      
      // Check for Rate Limit Error (429)
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('too many requests')) {
        const waitTime = Math.pow(2, i) * 2000 + Math.random() * 1000; // Exponential backoff: 2s, 4s, 8s...
        console.warn(`Gemini API Rate Limit (429). Retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(waitTime);
        continue;
      }
      
      // If it's not a 429, don't retry and throw immediately
      throw error;
    }
  }
  
  throw lastError;
}
