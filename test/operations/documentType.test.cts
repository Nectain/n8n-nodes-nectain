import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import type {IDataObject} from 'n8n-workflow'

import {Nectain} from '../../nodes/Nectain/Nectain.node.js'
import {apiRequest, createExecuteContext, jsonResponse} from '../_context.cjs'

const DOCUMENT_TYPES = [
  {code: 'contract', id: 12, name: 'Contract'},
  {code: 'invoice', id: 7, name: 'Invoice'},
  {code: 'act', id: 15, name: 'Act'}
]

const INVOICE = {
  code: 'invoice',
  id: 7,
  name: 'Invoice',
  createdAt: '2026-01-15T09:30:00.000Z',
  attributes: [
    {code: 'amount', dataType: 'number', id: 1421, name: 'Amount', subtype: 'money'}
  ],
  roles: [{
    allowGroups: false,
    allowMultiple: false,
    id: 11,
    role: {code: 'author', description: null, id: 44, name: 'Author'}
  }],
  states: [{
    id: 7,
    state: {code: 'draft', description: null, id: 5, name: 'Draft'}
  }]
}

async function run (parameters: IDataObject, response: unknown) {
  const {ctx, requests} = createExecuteContext({
    parameters: {resource: 'documentType', ...parameters},
    responses: [jsonResponse(response)]
  })
  const [items] = await new Nectain().execute.call(ctx)

  return {
    items,
    requests
  }
}

describe('Document Type operations', () => {
  it('gets a document type by code', async () => {
    const {items, requests} = await run({
      operation: 'get',
      documentType: {__rl: true, mode: 'code', value: 'invoice'},
      options: {}
    }, INVOICE)

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/document-types/invoice',
        qs: {by: 'code'}
      })
    ])
    assert.deepEqual(items, [{
      json: INVOICE,
      pairedItem: {item: 0}
    }])
  })

  it('gets a document type by ID with the selected fields', async () => {
    const {requests} = await run({
      operation: 'get',
      documentType: {__rl: true, mode: 'id', value: '7'},
      options: {select: 'code,name'}
    }, {code: 'invoice', name: 'Invoice'})

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/document-types/7',
        qs: {select: 'code,name'}
      })
    ])
  })

  it('gets the creatable document types of a folder, one item per type', async () => {
    const {items, requests} = await run({
      operation: 'getAll',
      filters: {
        onlyCreatable: true,
        folder: {__rl: true, mode: 'path', value: '/Repository/Finance'}
      }
    }, DOCUMENT_TYPES)

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/document-types',
        qs: {onlyCreatable: true, 'folder.path': '/Repository/Finance'}
      })
    ])
    assert.deepEqual(items.map(item => item.json), DOCUMENT_TYPES)
  })

  it('filters the document types by a folder ID', async () => {
    const {requests} = await run({
      operation: 'getAll',
      filters: {
        folder: {__rl: true, mode: 'id', value: '55'}
      }
    }, [])

    assert.deepEqual(requests[0].qs, {'folder.id': '55'})
  })
})
