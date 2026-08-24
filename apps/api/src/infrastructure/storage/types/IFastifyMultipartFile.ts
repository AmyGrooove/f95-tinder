import type { Readable } from "node:stream"

interface IFastifyMultipartFile {
  fieldname: string
  file: Readable
  filename: string
  mimetype: string
  type: "file"
}

export type { IFastifyMultipartFile }
