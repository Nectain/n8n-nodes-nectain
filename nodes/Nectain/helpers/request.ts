import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INode,
  JsonObject
} from 'n8n-workflow'
import {NodeApiError} from 'n8n-workflow'

export type NectainContext = IExecuteFunctions | ILoadOptionsFunctions

export interface NectainRequest {
  method: IHttpRequestMethods
  /**
   * Root-relative path, such as `/api/v1/documents`,
   * so a `pagination.next` link of a response is requested as it is.
   */
  url: string
  qs?: IDataObject
  headers?: IDataObject
  body?: Buffer | string
  /** Read the response body as bytes, for file downloads. */
  binary?: boolean
}

export interface NectainResponse {
  body: unknown
  headers: IDataObject
  statusCode: number
}

interface ProblemDetails {
  code: string
  title: string
  detail: string
  errors?: Array<{code: string, message: string, pointer?: string}>
}

export function normalizeBaseUrl (baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

/** The `select` query parameter of the Fields option, absent when the option is empty. */
export function selectQuery (options: {select?: string}): IDataObject {
  return options.select
    ? {select: options.select}
    : {}
}

export async function nectainRequest (
  ctx: NectainContext,
  request: NectainRequest
): Promise<NectainResponse> {
  const credentials = await ctx.getCredentials<{baseUrl: string}>('nectainApi')
  const {binary, ...rest} = request
  const options: IHttpRequestOptions = {
    ...rest,
    baseURL: normalizeBaseUrl(credentials.baseUrl),
    returnFullResponse: true,
    // The status is mapped below, so a Problem Details body reaches the error unchanged
    ignoreHttpStatusErrors: true,
    ...(binary === true
      ? {encoding: 'arraybuffer'}
      : {json: true})
  }

  const response = await ctx.helpers.httpRequestWithAuthentication.call(
    ctx,
    'nectainApi',
    options
  ) as NectainResponse
  if (response.statusCode < 200 || response.statusCode > 299) {
    throw toApiError(ctx.getNode(), response)
  }

  return response
}

export function toApiError (node: INode, response: NectainResponse): NodeApiError {
  const httpCode = String(response.statusCode)

  const problem = readProblem(response)
  if (problem === undefined) {
    const text = bodyText(response.body)
    return new NodeApiError(node, {body: text}, {
      description: text,
      httpCode
    })
  }

  const lines = [problem.detail]
  for (const error of problem.errors ?? []) {
    const line = error.pointer === undefined
      ? error.message
      : `${error.pointer}: ${error.message}`
    lines.push(line)
  }

  return new NodeApiError(node, problem as unknown as JsonObject, {
    message: `${problem.title} (${problem.code})`,
    description: lines.join('\n'),
    httpCode
  })
}

function readProblem (response: NectainResponse): ProblemDetails | undefined {
  const contentType = response.headers['content-type']
  if (typeof contentType !== 'string' || !contentType.startsWith('application/problem+json')) {
    return undefined
  }

  // A download reads every body as bytes, its error too
  const body = Buffer.isBuffer(response.body)
    ? JSON.parse(response.body.toString('utf8'))
    : response.body
  return body as ProblemDetails
}

function bodyText (body: unknown): string {
  if (Buffer.isBuffer(body)) {
    return body.toString('utf8')
  }
  if (typeof body === 'string') {
    return body
  }

  return JSON.stringify(body)
}
