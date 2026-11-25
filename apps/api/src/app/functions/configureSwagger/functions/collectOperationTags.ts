import type { OpenAPIObject } from "@nestjs/swagger"

import { API_ENDPOINT_TAGS_EXTENSION } from "@infrastructure/logger/decorators/ApiEndpoint"
import type { ApiEndpointTag } from "@infrastructure/logger/decorators/ApiEndpoint"

type OperationWithTagDefinitions = {
  [API_ENDPOINT_TAGS_EXTENSION]: ApiEndpointTag[]
}

const collectOperationTags = (document: OpenAPIObject) => {
  const tags = new Map(document.tags?.map((tag) => [tag.name, tag]))
  const pathItems = [
    ...Object.values(document.paths),
    ...Object.values(document.webhooks ?? {}),
  ]

  for (const { additionalOperations, ...pathItem } of pathItems) {
    const fields: unknown[] = [
      ...Object.values(pathItem),
      ...Object.values(additionalOperations ?? {}),
    ]

    for (const field of fields) {
      if (
        !field ||
        typeof field !== "object" ||
        !(API_ENDPOINT_TAGS_EXTENSION in field)
      ) {
        continue
      }

      const operation = field as Partial<OperationWithTagDefinitions>

      for (const { name, parent } of operation[API_ENDPOINT_TAGS_EXTENSION] ??
        []) {
        const tag = tags.get(name)
        if (parent && tag?.parent && parent !== tag.parent) {
          throw new Error(`Swagger tag "${name}" has conflicting parents`)
        }
        if (parent && !tags.has(parent)) {
          tags.set(parent, { name: parent })
        }
        tags.set(name, { ...tag, name, parent: parent ?? tag?.parent })
      }

      delete operation[API_ENDPOINT_TAGS_EXTENSION]
    }
  }

  for (const tag of tags.values()) {
    const visited = new Set([tag.name])
    let parent = tag.parent

    while (parent) {
      if (visited.has(parent)) {
        throw new Error(
          `Swagger tag "${tag.name}" has a circular parent reference`,
        )
      }
      visited.add(parent)
      parent = tags.get(parent)?.parent
    }
  }

  if (tags.size) {
    document.tags = [...tags.values()]
  }
}

export { collectOperationTags }
