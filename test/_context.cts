import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INode,
  INodeExecutionData
} from 'n8n-workflow'

export const BASE_URL = 'https://nectain.example.com'

export const NODE: INode = {
  id: '6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  name: 'Nectain',
  type: 'n8n-nodes-nectain.nectain',
  typeVersion: 1,
  position: [0, 0],
  parameters: {}
}

export interface FakeResponse {
  statusCode: number
  headers: IDataObject
  body: unknown
}

export function jsonResponse (body: unknown, statusCode = 200): FakeResponse {
  return {
    statusCode,
    headers: {'content-type': 'application/json; charset=utf-8'},
    body
  }
}

/** A Problem Details response with the title and detail the server writes for the code. */
export function problemResponse (statusCode: number, problem: IDataObject): FakeResponse {
  return {
    statusCode,
    headers: {'content-type': 'application/problem+json; charset=utf-8'},
    body: {type: 'about:blank', ...problem}
  }
}

export const NOT_FOUND = problemResponse(404, {
  title: 'Not Found',
  detail: 'The requested resource was not found.',
  code: 'not_found'
})

/** The options of a JSON request as the request helper passes them to n8n. */
export function apiRequest (options: Partial<IHttpRequestOptions>): IHttpRequestOptions {
  return {
    url: '',
    ...options,
    baseURL: BASE_URL,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
    json: true
  }
}

/** The options of a download as the request helper passes them to n8n. */
export function downloadRequest (options: Partial<IHttpRequestOptions>): IHttpRequestOptions {
  return {
    url: '',
    ...options,
    baseURL: BASE_URL,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
    encoding: 'arraybuffer'
  }
}

export function binaryItem (
  fileName: string,
  mimeType: string,
  content: string
): INodeExecutionData {
  return {
    json: {},
    binary: {
      data: {
        data: Buffer.from(content).toString('base64'),
        fileName,
        mimeType
      }
    }
  }
}

/** Splits a recorded multipart request into the headers and the text of each part. */
export function multipartParts (request: IHttpRequestOptions): Array<{head: string, data: string}> {
  const contentType = String((request.headers as IDataObject)['Content-Type'])
  const boundary = contentType.split('boundary=')[1]
  const text = (request.body as Buffer).toString('utf8')

  return text
    .split(`--${boundary}`)
    .slice(1, -1)
    .map(part => {
      const separator = part.indexOf('\r\n\r\n')

      return {
        head: part.slice(2, separator),
        data: part.slice(separator + 4, -2)
      }
    })
}

function createHttp (responses: Array<FakeResponse | Error>) {
  const requests: IHttpRequestOptions[] = []
  const queue = [...responses]

  async function httpRequestWithAuthentication (
    credentialType: string,
    options: IHttpRequestOptions
  ) {
    if (credentialType !== 'nectainApi') {
      throw new Error(`Unexpected credential ${credentialType}`)
    }

    requests.push(options)
    const response = queue.shift()
    if (response === undefined) {
      throw new Error(`No response for ${String(options.method)} ${options.url}`)
    }
    if (response instanceof Error) {
      throw response
    }

    return response
  }

  return {
    requests,
    httpRequestWithAuthentication
  }
}

export interface ExecuteOptions {
  parameters: IDataObject
  /** Parameters that differ per input item, merged over `parameters`. */
  itemParameters?: IDataObject[]
  items?: INodeExecutionData[]
  responses?: Array<FakeResponse | Error>
  continueOnFail?: boolean
  baseUrl?: string
}

export function createExecuteContext (options: ExecuteOptions) {
  const items: INodeExecutionData[] = options.items ?? [{json: {}}]
  const http = createHttp(options.responses ?? [])
  const ctx = {
    getInputData: () => items,
    getNodeParameter (name: string, itemIndex: number) {
      const parameters: IDataObject = {
        ...options.parameters,
        ...options.itemParameters?.[itemIndex]
      }
      // n8n throws for a parameter that is not set, such as one hidden by its display options
      if (!(name in parameters)) {
        throw new Error(`Could not get parameter "${name}"`)
      }

      return parameters[name]
    },
    getNode: () => NODE,
    getCredentials: async () => ({
      baseUrl: options.baseUrl ?? BASE_URL,
      apiKey: 'ncapi_test'
    }),
    continueOnFail: () => options.continueOnFail ?? false,
    helpers: {
      httpRequestWithAuthentication: http.httpRequestWithAuthentication,
      assertBinaryData (itemIndex: number, name: string) {
        const binaryData = items[itemIndex].binary?.[name]
        if (binaryData === undefined) {
          throw new Error(`No binary data in "${name}"`)
        }

        return binaryData
      },
      async getBinaryDataBuffer (itemIndex: number, name: string) {
        return Buffer.from(items[itemIndex].binary?.[name].data ?? '', 'base64')
      },
      async prepareBinaryData (data: Buffer, fileName?: string, mimeType?: string) {
        return {
          data: data.toString('base64'),
          fileName,
          mimeType
        }
      }
    }
  }

  return {
    ctx: ctx as unknown as IExecuteFunctions,
    requests: http.requests
  }
}

export function createLoadOptionsContext (
  current: IDataObject,
  responses: Array<FakeResponse | Error>
) {
  const http = createHttp(responses)
  const ctx = {
    getCurrentNodeParameter: (name: string) => current[name],
    getNode: () => NODE,
    getCredentials: async () => ({
      baseUrl: BASE_URL,
      apiKey: 'ncapi_test'
    }),
    helpers: {
      httpRequestWithAuthentication: http.httpRequestWithAuthentication
    }
  }

  return {
    ctx: ctx as unknown as ILoadOptionsFunctions,
    requests: http.requests
  }
}
