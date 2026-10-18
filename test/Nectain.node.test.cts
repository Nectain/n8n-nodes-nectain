import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {NodeApiError, NodeOperationError} from 'n8n-workflow'

import {Nectain} from '../nodes/Nectain/Nectain.node.js'

import {createExecuteContext, jsonResponse, NOT_FOUND} from './_context.cjs'

const DOCUMENT = {
  createdAt: '2026-09-21T10:15:00.000Z',
  displayName: 'INV-2026-001 - Invoice #INV-2026-001',
  documentNumber: 'INV-2026-001',
  documentType: {code: 'invoice', id: 7},
  id: 10042,
  state: {code: 'draft', id: 1},
  title: 'Invoice #INV-2026-001'
}

function twoDocumentGets (continueOnFail: boolean) {
  return createExecuteContext({
    parameters: {
      resource: 'document',
      operation: 'get',
      options: {}
    },
    itemParameters: [
      {documentId: '10041'},
      {documentId: '10042'}
    ],
    items: [{json: {}}, {json: {}}],
    responses: [NOT_FOUND, jsonResponse(DOCUMENT)],
    continueOnFail
  })
}

describe('Nectain node execute', () => {
  it('outputs the error of a failed item and continues with Continue on Fail', async () => {
    const {ctx} = twoDocumentGets(true)

    const output = await new Nectain().execute.call(ctx)

    assert.deepEqual(output, [[
      {
        json: {error: 'Not Found (not_found)'},
        pairedItem: {item: 0}
      },
      {
        json: DOCUMENT,
        pairedItem: {item: 1}
      }
    ]])
  })

  it('fails with the API error and the item index without Continue on Fail', async () => {
    const {ctx, requests} = twoDocumentGets(false)

    await assert.rejects(() => new Nectain().execute.call(ctx), (error: unknown) => {
      assert.ok(error instanceof NodeApiError)
      assert.equal(error.httpCode, '404')
      assert.equal(error.context.itemIndex, 0)

      return true
    })
    assert.equal(requests.length, 1)
  })

  it('fails on an operation the node does not define', async () => {
    const {ctx} = createExecuteContext({
      parameters: {resource: 'document', operation: 'delete'}
    })

    await assert.rejects(() => new Nectain().execute.call(ctx), (error: unknown) => {
      assert.ok(error instanceof NodeOperationError)
      assert.match(error.message, /"delete" of the resource "document"/)

      return true
    })
  })
})
