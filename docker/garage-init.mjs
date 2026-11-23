const {
  APP_NAME: bucketName,
  GARAGE_ACCESS_KEY_ID: accessKeyId,
  GARAGE_SECRET_ACCESS_KEY: secretAccessKey,
  GARAGE_ADMIN_TOKEN: adminToken,
} = process.env

if (!bucketName || !accessKeyId || !secretAccessKey || !adminToken) {
  throw new Error("Garage setup requires APP_NAME, GARAGE_ACCESS_KEY_ID, GARAGE_SECRET_ACCESS_KEY and GARAGE_ADMIN_TOKEN")
}

async function garageRequest(endpoint, { query, body, allowMissing = false } = {}) {
  const url = new URL(`/v2/${endpoint}`, "http://garage:3903")
  if (query) {
    url.search = new URLSearchParams(query).toString()
  }

  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (allowMissing && response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Garage ${endpoint} failed (HTTP ${response.status})`)
  }

  return response.json()
}

const { layoutVersion, nodes } = await garageRequest("GetClusterStatus")

if (layoutVersion === 0) {
  const node = nodes.find(({ isUp }) => isUp)

  if (!node) {
    throw new Error("Garage has no active storage node")
  }

  await garageRequest("UpdateClusterLayout", {
    body: { roles: [{ id: node.id, zone: "local", capacity: 1_000_000_000, tags: [] }] },
  })
  await garageRequest("ApplyClusterLayout", { body: { version: 1 } })
}

const key = await garageRequest("GetKeyInfo", { query: { id: accessKeyId }, allowMissing: true })

if (!key) {
  await garageRequest("ImportKey", { body: { accessKeyId, secretAccessKey, name: "bisky-local" } })
}

const bucket =
  (await garageRequest("GetBucketInfo", { query: { globalAlias: bucketName }, allowMissing: true })) ??
  (await garageRequest("CreateBucket", { body: { globalAlias: bucketName } }))

await garageRequest("AllowBucketKey", {
  body: {
    bucketId: bucket.id,
    accessKeyId,
    permissions: { read: true, write: true, owner: true },
  },
})

if (!bucket.websiteAccess) {
  await garageRequest("UpdateBucket", {
    query: { id: bucket.id },
    body: { websiteAccess: { enabled: true, indexDocument: "index.html" } },
  })
}
