const getResponseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const parsedJson = (await response.json()) as { error?: unknown }

    if (typeof parsedJson.error === 'string' && parsedJson.error.trim()) {
      return parsedJson.error
    }
  } catch {
    return `Network error: ${response.status}`
  }

  return `Network error: ${response.status}`
}

export { getResponseErrorMessage }
