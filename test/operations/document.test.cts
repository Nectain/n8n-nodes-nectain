import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import type {IDataObject, INodeExecutionData} from 'n8n-workflow'
import {NodeApiError} from 'n8n-workflow'

import {Nectain} from '../../nodes/Nectain/Nectain.node.js'
import type {FakeResponse} from '../_context.cjs'
import {
  apiRequest,
  binaryItem,
  createExecuteContext,
  downloadRequest,
  jsonResponse,
  multipartParts,
  problemResponse
} from '../_context.cjs'

const DOCUMENT = {
  createdAt: '2026-09-21T10:15:00.000Z',
  displayName: 'INV-2026-001 - Invoice #INV-2026-001',
  documentNumber: 'INV-2026-001',
  documentType: {code: 'invoice', id: 7},
  folder: {id: 55, path: '/Repository/Finance/Invoices'},
  id: 10042,
  state: {code: 'draft', id: 1},
  title: 'Invoice #INV-2026-001'
}

const INVOICE_ATTRIBUTES = {
  attributes: [
    {code: 'amount', dataType: 'number', id: 1421, name: 'Amount', subtype: 'money'},
    {
      code: 'supplier',
      dataType: 'reference',
      id: 1426,
      name: 'Supplier',
      reference: {dictionary: {code: 'suppliers', id: 301}, kind: 'userDictionary'}
    }
  ]
}

const FILE_NOT_FOUND = problemResponse(404, {
  title: 'Not Found',
  detail: 'The document has no primary file.',
  code: 'file_not_found'
})

const PRIMARY_FILE = '/api/v1/documents/10042/primary-file/content'

const CREATE = {
  resource: 'document',
  operation: 'create',
  documentType: {
    __rl: true,
    mode: 'list',
    value: 'invoice',
    cachedResultName: 'Invoice'
  },
  binaryPropertyName: '',
  attributesInput: 'mapper',
  attributes: {mappingMode: 'defineBelow', value: null},
  participants: {},
  additionalFields: {}
}

function mapped (value: IDataObject): IDataObject {
  return {
    mappingMode: 'defineBelow',
    value
  }
}

function bodyOf (request: {body?: unknown}): IDataObject {
  return JSON.parse(request.body as string) as IDataObject
}

async function run (
  parameters: IDataObject,
  responses: FakeResponse[],
  items: INodeExecutionData[] = [{json: {}}]
) {
  const {ctx, requests} = createExecuteContext({
    parameters,
    responses,
    items
  })
  const [output] = await new Nectain().execute.call(ctx)

  return {
    output,
    requests
  }
}

describe('Document Create', () => {
  it('creates a document from metadata with the attribute values of its type', async () => {
    const {output, requests} = await run({
      ...CREATE,
      attributes: mapped({amount: 1250.5}),
      additionalFields: {title: 'Invoice #INV-2026-001'}
    }, [
      jsonResponse(INVOICE_ATTRIBUTES),
      jsonResponse(DOCUMENT, 201)
    ])

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/document-types/invoice',
        qs: {by: 'code', select: 'attributes'}
      }),
      apiRequest({
        method: 'POST',
        url: '/api/v1/documents',
        headers: {'Content-Type': 'application/json'},
        body: '{"documentType":{"code":"invoice"},"title":"Invoice #INV-2026-001",' +
          '"attributes":{"amount":1250.5}}'
      })
    ])
    assert.deepEqual(output, [{
      json: DOCUMENT,
      pairedItem: {item: 0}
    }])
  })

  it('sends the folder by path and a participant by name', async () => {
    const {requests} = await run({
      ...CREATE,
      participants: {
        participant: [{role: 'approver', kind: 'principal', name: 'jdoe', code: ''}]
      },
      additionalFields: {
        folder: {__rl: true, mode: 'path', value: '/Repository/Finance/Invoices'}
      }
    }, [jsonResponse(DOCUMENT, 201)])

    assert.deepEqual(bodyOf(requests[0]), {
      documentType: {code: 'invoice'},
      folder: {path: '/Repository/Finance/Invoices'},
      participants: {approver: [{kind: 'principal', name: 'jdoe'}]}
    })
  })

  it('sends an organization unit participant by code', async () => {
    const {requests} = await run({
      ...CREATE,
      participants: {
        participant: [{
          role: 'approver',
          kind: 'organizationObject',
          name: '',
          code: 'finance-dept'
        }]
      }
    }, [jsonResponse(DOCUMENT, 201)])

    assert.deepEqual(bodyOf(requests[0]).participants, {
      approver: [{kind: 'organizationObject', code: 'finance-dept'}]
    })
  })

  it('sends a reference attribute by code or by ID and reads the types once per type', async () => {
    const {ctx, requests} = createExecuteContext({
      parameters: CREATE,
      itemParameters: [
        {attributes: mapped({supplier: 'finance-dept'})},
        {attributes: mapped({supplier: '42'})}
      ],
      items: [{json: {}}, {json: {}}],
      responses: [
        jsonResponse(INVOICE_ATTRIBUTES),
        jsonResponse(DOCUMENT, 201),
        jsonResponse(DOCUMENT, 201)
      ]
    })

    await new Nectain().execute.call(ctx)

    assert.deepEqual(requests.map(request => request.url), [
      '/api/v1/document-types/invoice',
      '/api/v1/documents',
      '/api/v1/documents'
    ])
    assert.deepEqual(bodyOf(requests[1]).attributes, {supplier: {code: 'finance-dept'}})
    assert.deepEqual(bodyOf(requests[2]).attributes, {supplier: {id: 42}})
  })

  it('sends the attributes JSON unchanged', async () => {
    const attributes = '{"contract":' +
      '{"url":"https://example.com/contract.pdf","caption":"Signed contract"}}'
    const {requests} = await run({
      ...CREATE,
      attributesInput: 'json',
      attributesJson: attributes
    }, [jsonResponse(DOCUMENT, 201)])

    assert.equal(requests[0].body, `{"documentType":{"code":"invoice"},"attributes":${attributes}}`)
  })

  it('sends the primary file and the metadata in one multipart request', async () => {
    const {output, requests} = await run(
      {...CREATE, binaryPropertyName: 'data'},
      [jsonResponse(DOCUMENT, 201)],
      [binaryItem('contract.pdf', 'application/pdf', '%PDF-1.7 contract')]
    )

    assert.match(
      String((requests[0].headers as IDataObject)['Content-Type']),
      /^multipart\/form-data; boundary=/
    )
    assert.deepEqual(multipartParts(requests[0]), [
      {
        head: 'Content-Disposition: form-data; name="document"\r\n' +
          'Content-Type: application/json',
        data: '{"documentType":{"code":"invoice"},"primaryFile":{"contentPart":"file"}}'
      },
      {
        head: 'Content-Disposition: form-data; name="file"; filename="contract.pdf"\r\n' +
          'Content-Type: application/pdf',
        data: '%PDF-1.7 contract'
      }
    ])
    assert.deepEqual(output, [{
      json: DOCUMENT,
      pairedItem: {item: 0}
    }])
  })

  it('sends the idempotency key as a header', async () => {
    const {requests} = await run({
      ...CREATE,
      additionalFields: {idempotencyKey: '9b2f0c7e-3d4a-4f1b-8c6e-2a5d7e9f1b3c'}
    }, [jsonResponse(DOCUMENT, 201)])

    assert.deepEqual(requests[0].headers, {
      'Idempotency-Key': '9b2f0c7e-3d4a-4f1b-8c6e-2a5d7e9f1b3c',
      'Content-Type': 'application/json'
    })
  })
})

describe('Document Get, Download File, and Replace File', () => {
  it('gets a document with the selected fields', async () => {
    const document = {
      id: 10042,
      title: 'Invoice #INV-2026-001',
      attributes: {amount: 1250.5}
    }
    const {output, requests} = await run({
      resource: 'document',
      operation: 'get',
      documentId: '10042',
      options: {select: 'id,title,attributes(amount)'}
    }, [jsonResponse(document)])

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/documents/10042',
        qs: {select: 'id,title,attributes(amount)'}
      })
    ])
    assert.deepEqual(output[0].json, document)
  })

  it('downloads the primary file with the name and media type from the response', async () => {
    const {output, requests} = await run({
      resource: 'document',
      operation: 'downloadFile',
      documentId: '10042',
      binaryPropertyName: 'file'
    }, [{
      statusCode: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="contract.pdf"'
      },
      body: Buffer.from('%PDF-1.7 contract')
    }])

    assert.deepEqual(requests, [
      downloadRequest({
        method: 'GET',
        url: PRIMARY_FILE
      })
    ])
    assert.deepEqual(output, [{
      json: {},
      binary: {
        file: {
          data: Buffer.from('%PDF-1.7 contract').toString('base64'),
          fileName: 'contract.pdf',
          mimeType: 'application/pdf'
        }
      },
      pairedItem: {item: 0}
    }])
  })

  it('fails the download of a document without a primary file with file_not_found', async () => {
    const {ctx} = createExecuteContext({
      parameters: {
        resource: 'document',
        operation: 'downloadFile',
        documentId: '10042',
        binaryPropertyName: 'data'
      },
      responses: [{
        ...FILE_NOT_FOUND,
        body: Buffer.from(JSON.stringify(FILE_NOT_FOUND.body))
      }]
    })

    await assert.rejects(() => new Nectain().execute.call(ctx), (error: unknown) => {
      assert.ok(error instanceof NodeApiError)
      assert.match(error.message, /file_not_found/)

      return true
    })
  })

  it('replaces the primary file with the bytes and the name of the input file', async () => {
    const {output, requests} = await run({
      resource: 'document',
      operation: 'replaceFile',
      documentId: '10042',
      binaryPropertyName: 'data'
    }, [
      {statusCode: 204, headers: {}, body: ''}
    ], [
      binaryItem('scan.pdf', 'application/pdf', '%PDF-1.7 scan')
    ])

    assert.deepEqual(requests, [
      apiRequest({
        method: 'PUT',
        url: PRIMARY_FILE,
        qs: {filename: 'scan.pdf'},
        headers: {'Content-Type': 'application/pdf'},
        body: Buffer.from('%PDF-1.7 scan')
      })
    ])
    assert.deepEqual(output, [{
      json: {id: 10042, success: true},
      pairedItem: {item: 0}
    }])
  })
})
