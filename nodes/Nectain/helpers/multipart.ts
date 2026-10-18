import {randomBytes} from 'node:crypto'

import type {IDataObject, IExecuteFunctions} from 'n8n-workflow'

/** The name of the file part, which `primaryFile.contentPart` or a `files` item references. */
export const FILE_PART = 'file'

export interface MultipartPart {
  name: string
  data: Buffer | string
  fileName?: string
  contentType?: string
}

export interface MultipartBody {
  body: Buffer
  contentType: string
}

export interface DocumentJson {
  documentType: IDataObject
  title?: string
  folder?: IDataObject
  attributes?: IDataObject
  participants?: IDataObject
  primaryFile?: IDataObject
}

export interface JobJson {
  template: IDataObject
  files: IDataObject[]
  autoCreateDocument: boolean
  name?: string
}

/**
 * The server parses each part's headers as UTF-8 and reads the file name from `filename` only:
 * a part with `filename*` is rejected with `400`, and a part without `filename` is not a file.
 */
export function buildMultipart (parts: MultipartPart[]): MultipartBody {
  const boundary = `n8n-nectain-${randomBytes(16).toString('hex')}`

  const chunks: Buffer[] = []
  for (const part of parts) {
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${quote(part.name)}"`
    if (part.fileName !== undefined) {
      head += `; filename="${quote(part.fileName)}"`
    }
    if (part.contentType !== undefined) {
      head += `\r\nContent-Type: ${part.contentType}`
    }
    chunks.push(
      Buffer.from(`${head}\r\n\r\n`),
      Buffer.from(part.data),
      Buffer.from('\r\n')
    )
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`
  }
}

/**
 * Builds a request of a JSON part and the file of a binary field of the input item.
 * Binary data can lack a file name, and the server needs one to accept the file part,
 * so the field name stands in for it.
 */
export async function jsonWithFile (
  ctx: IExecuteFunctions,
  itemIndex: number,
  binaryPropertyName: string,
  jsonPart: string,
  json: string
): Promise<MultipartBody> {
  const binaryData = ctx.helpers.assertBinaryData(itemIndex, binaryPropertyName)
  const bytes = await ctx.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName)

  return buildMultipart([
    {
      name: jsonPart,
      contentType: 'application/json',
      data: json
    },
    {
      name: FILE_PART,
      fileName: binaryData.fileName ?? binaryPropertyName,
      contentType: binaryData.mimeType,
      data: bytes
    }
  ])
}

/**
 * An `Idempotency-Key` retry is accepted only with the same JSON text,
 * so the members are written in this fixed order whatever order the caller built them in.
 */
export function documentJson (document: DocumentJson): string {
  return JSON.stringify({
    documentType: document.documentType,
    title: document.title,
    folder: document.folder,
    attributes: document.attributes,
    participants: document.participants,
    primaryFile: document.primaryFile
  })
}

/** Writes the members in a fixed order, for the reason given at {@link documentJson}. */
export function jobJson (job: JobJson): string {
  return JSON.stringify({
    template: job.template,
    files: job.files,
    autoCreateDocument: job.autoCreateDocument,
    name: job.name
  })
}

function quote (value: string): string {
  return value.replace(/[\\"]/g, '\\$&')
}
