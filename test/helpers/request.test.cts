import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {NodeApiError} from 'n8n-workflow'

import {nectainRequest} from '../../nodes/Nectain/helpers/request'
import type {FakeResponse} from '../_context.cjs'
import {
  apiRequest,
  createExecuteContext,
  downloadRequest,
  jsonResponse,
  problemResponse
} from '../_context.cjs'

async function rejection (response: FakeResponse, binary = false): Promise<NodeApiError> {
  const {ctx} = createExecuteContext({
    parameters: {},
    responses: [response]
  })
  try {
    await nectainRequest(ctx, {
      method: 'GET',
      url: '/api/v1/documents/10042',
      binary
    })
  } catch (error) {
    assert.ok(error instanceof NodeApiError)
    return error
  }

  assert.fail('The request did not fail')
}

describe('nectainRequest', () => {
  it('sends the request to the Base URL without its trailing slash', async () => {
    const {ctx, requests} = createExecuteContext({
      parameters: {},
      baseUrl: 'https://nectain.example.com/',
      responses: [jsonResponse([])]
    })

    await nectainRequest(ctx, {
      method: 'GET',
      url: '/api/v1/document-types'
    })

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/document-types'
      })
    ])
  })

  it('returns the body, headers, and status of a successful response', async () => {
    const response = jsonResponse([{code: 'invoice', id: 7, name: 'Invoice'}])
    const {ctx} = createExecuteContext({
      parameters: {},
      responses: [response]
    })

    const result = await nectainRequest(ctx, {
      method: 'GET',
      url: '/api/v1/document-types'
    })

    assert.deepEqual(result, response)
  })

  it('reads the body of a download as bytes', async () => {
    const {ctx, requests} = createExecuteContext({
      parameters: {},
      responses: [{
        statusCode: 200,
        headers: {'content-type': 'application/pdf'},
        body: Buffer.from('%PDF')
      }]
    })

    await nectainRequest(ctx, {
      method: 'GET',
      url: '/api/v1/documents/10042/primary-file/content',
      binary: true
    })

    assert.deepEqual(requests, [
      downloadRequest({
        method: 'GET',
        url: '/api/v1/documents/10042/primary-file/content'
      })
    ])
  })

  it('maps a Problem Details response with field errors to an API error', async () => {
    const error = await rejection(problemResponse(422, {
      title: 'Unprocessable Content',
      detail: 'The request could not be processed.',
      code: 'unprocessable_content',
      errors: [{
        code: 'reference_unavailable',
        message: 'The referenced value is unavailable.',
        pointer: '/documentType/code'
      }]
    }))

    assert.equal(error.message, 'Unprocessable Content (unprocessable_content)')
    assert.equal(
      error.description,
      'The request could not be processed.\n' +
        '/documentType/code: The referenced value is unavailable.'
    )
    assert.equal(error.httpCode, '422')
  })

  it('maps a rejected API key to an API error that names forbidden', async () => {
    const error = await rejection(problemResponse(403, {
      title: 'Forbidden',
      detail: 'The request has no authentication credential, ' +
        'or the user is not allowed to use the API.',
      code: 'forbidden'
    }))

    assert.equal(error.message, 'Forbidden (forbidden)')
    assert.equal(error.httpCode, '403')
  })

  it('maps an HTML error page to an API error with the status and the page text', async () => {
    const page = '<html><body><h1>503 Service Temporarily Unavailable</h1></body></html>'
    const error = await rejection({
      statusCode: 503,
      headers: {'content-type': 'text/html'},
      body: page
    })

    assert.equal(error.httpCode, '503')
    assert.equal(error.description, page)
  })

  it('reads the Problem Details of a failed download from its bytes', async () => {
    const problem = problemResponse(404, {
      title: 'Not Found',
      detail: 'The document has no primary file.',
      code: 'file_not_found'
    })
    const error = await rejection({
      ...problem,
      body: Buffer.from(JSON.stringify(problem.body))
    }, true)

    assert.equal(error.message, 'Not Found (file_not_found)')
    assert.equal(error.httpCode, '404')
  })
})
