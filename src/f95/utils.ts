const mergeUniqueStringArrays = (firstArray: string[], secondArray: string[]) => {
  const uniqueValueSet = new Set<string>()

  for (const value of firstArray) {
    uniqueValueSet.add(value)
  }

  for (const value of secondArray) {
    uniqueValueSet.add(value)
  }

  return Array.from(uniqueValueSet)
}

const removeStringFromArray = (sourceArray: string[], valueToRemove: string) => {
  return sourceArray.filter((value) => value !== valueToRemove)
}

const isStringArray = (unknownValue: unknown): unknownValue is string[] => {
  if (!Array.isArray(unknownValue)) {
    return false
  }

  for (const item of unknownValue) {
    if (typeof item !== 'string') {
      return false
    }
  }

  return true
}

const downloadJsonFile = (fileName: string, data: unknown) => {
  const jsonText = JSON.stringify(data, null, 2)
  const fileBlob = new Blob([jsonText], { type: 'application/json;charset=utf-8' })
  const objectUrl = URL.createObjectURL(fileBlob)

  const linkElement = document.createElement('a')
  linkElement.href = objectUrl
  linkElement.download = fileName
  document.body.appendChild(linkElement)
  linkElement.click()
  linkElement.remove()

  URL.revokeObjectURL(objectUrl)
}

const readFileAsText = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const fileReader = new FileReader()

    fileReader.onload = () => {
      const resultText = typeof fileReader.result === 'string' ? fileReader.result : ''
      resolve(resultText)
    }

    fileReader.onerror = () => {
      reject(new Error('File read error'))
    }

    fileReader.readAsText(file)
  })
}

const safeJsonParse = <T,>(jsonText: string): T | null => {
  try {
    return JSON.parse(jsonText) as T
  } catch {
    return null
  }
}

export { mergeUniqueStringArrays, removeStringFromArray, isStringArray, downloadJsonFile, readFileAsText, safeJsonParse }
