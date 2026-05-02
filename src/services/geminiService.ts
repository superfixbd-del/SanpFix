async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calls Gemini AI through our backend proxy with automatic retry on 429 (Rate Limit) errors.
 */
export async function callGeminiWithRetry(modelName: string, contents: any, maxRetries = 4) {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: modelName, contents }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for Rate Limit Error (429)
        if (response.status === 429 || (errorData.error && errorData.error.includes('429'))) {
          const waitTime = Math.pow(2, i) * 3000 + Math.random() * 1000; // Exponential backoff: 3s, 6s, 12s...
          console.warn(`Gemini API Rate Limit (429). Retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1}/${maxRetries})`);
          await delay(waitTime);
          continue;
        }
        
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      lastError = error;
      
      // If it's a fetch error or other unexpected error, don't retry unless it's explicitly a rate limit
      if (error?.message?.includes('429')) {
        const waitTime = Math.pow(2, i) * 3000 + Math.random() * 1000;
        await delay(waitTime);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}
