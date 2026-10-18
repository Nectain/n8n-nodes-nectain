import type {IDataObject, IExecuteFunctions, INodeExecutionData} from 'n8n-workflow'

import type {NectainResponse} from './request'

/**
 * Reads the file name of a download.
 * The server writes `filename` as an ASCII fallback with `_` in place of other characters,
 * followed by `filename*` with the exact UTF-8 name whenever the two differ.
 */
export function fileNameFromHeaders (headers: IDataObject): string | undefined {
  const disposition = headers['content-disposition']
  if (typeof disposition !== 'string') {
    return undefined
  }

  const extended = /filename\*=UTF-8''([^;\s]+)/i.exec(disposition)
  if (extended !== null) {
    return decodeURIComponent(extended[1])
  }

  const plain = /filename="([^"]*)"/i.exec(disposition)
  return plain === null ? undefined : plain[1]
}

/** Outputs a downloaded file, named by `fallbackName` when the response does not name it. */
export async function toBinaryItem (
  ctx: IExecuteFunctions,
  response: NectainResponse,
  binaryPropertyName: string,
  fallbackName: string
): Promise<INodeExecutionData> {
  const binaryData = await ctx.helpers.prepareBinaryData(
    response.body as Buffer,
    fileNameFromHeaders(response.headers) ?? fallbackName,
    response.headers['content-type'] as string
  )

  return {
    json: {},
    binary: {[binaryPropertyName]: binaryData}
  }
}
