export async function safeJsonResponse<T>(response: Response, fallbackMessage = "Unexpected response from the server") {
  const text = await response.text();

  if (!text) {
    if (!response.ok) {
      throw new Error(fallbackMessage);
    }
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    if (!response.ok) {
      throw new Error(text.slice(0, 200) || fallbackMessage);
    }
    throw new Error(`Expected a JSON response, but received an unexpected response from the server.`);
  }
}
