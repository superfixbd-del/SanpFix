/**
 * Helper to call Gemini AI through our backend proxy
 */
export async function generateContentViaProxy(model: string, contents: any) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, contents }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Server responded with ${response.status}`);
  }

  return await response.json();
}
