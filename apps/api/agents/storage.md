# Storage and images

Read for object storage, bucket startup, presigned URLs or image-upload endpoints. Configuration is in [runtime](runtime.md).

[StorageModule](../src/infrastructure/storage/storage.module.ts) builds an AWS S3 client from `GARAGE_*` configuration with path-style access and checksums set to `WHEN_REQUIRED`. It exports `StorageService` and `StorageHealthService`, and provides the upload interceptor and image processor internally.

[StorageService](../src/infrastructure/storage/services/storageService/core/storage.service.ts) uses the app name as bucket. At module initialization it performs HeadBucket. Only recognized not-found errors can trigger automatic bucket creation, and only outside production. In production, a missing bucket fails initialization. Other initialization errors also fail rather than silently creating a bucket.

Public APIs are `upload`, `download`, `delete`, `deleteMany`, `isExists`, `presignedReadUrl`, `presignedWriteUrl` and `createPublicUrl`. Upload sends PutObject followed by HeadObject and returns path, size, MIME type and optional public URL. Download returns a Node Readable stream. `createPublicUrl` uses the configured public base and encodes each path segment. It returns undefined when the path or public base is missing. A recognized 404 yields false for `isExists`; other errors become ServiceUnavailableException and are logged. [StorageHealthService](../src/infrastructure/storage/services/storageHealthService/core/storageHealth.service.ts) checks HeadBucket.

## Multipart pipeline

Use [ImageUpload(field, options)](../src/infrastructure/storage/decorators/ImageUpload/core/ImageUpload.ts) with an explicit object path and [UploadedImage](../src/infrastructure/storage/decorators/UploadedImage/core/UploadedImage.ts) to obtain processed metadata. The former applies [ImageUploadInterceptor](../src/infrastructure/storage/services/imageUploadInterceptor/core/imageUpload.interceptor.ts); ensure the consuming module can resolve the relevant providers.

The interceptor requires exactly one file under the selected field, reads it with a byte limit, normalizes multipart text fields and processes the image before the controller runs. Defaults are 5 MiB, width/height 4,000 and 16,000,000 pixels. Invalid multipart input such as a missing boundary or an extra file returns 400. Exceeding the file-size limit returns 413. Bootstrap multipart limits remain an additional boundary.

[ImageProcessingService](../src/infrastructure/storage/services/imageProcessingService/core/imageProcessing.service.ts) checks declared and decoded MIME types, requires a match, validates dimensions/pixel count, rotates according to metadata, resizes without enlargement and emits WebP. Supported MIME types and quality are maintained in existing storage constants.

The uploaded key is `<configuredPath>/<randomUUID>.webp`; metadata is stored in `request.processedUploads`, while normalized fields are merged into `request.body`. If downstream handling throws, the interceptor attempts to delete the object and rethrows the original error. Cleanup errors are swallowed; this is best-effort compensation, not an atomic database/storage transaction.

After a successful avatar or poster update, the endpoint publishes a media change and awaits its cleanup subscriber. The subscriber attempts to delete the previous managed object without changing the HTTP result on storage failure. See the [avatar and collection routes](endpoints.md#ownership-and-composition) for the publishers and write conditions.
