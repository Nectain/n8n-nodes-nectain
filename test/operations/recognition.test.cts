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
  NOT_FOUND,
  problemResponse
} from '../_context.cjs'

const JOBS = '/api/v1/recognition-jobs'

const TEMPLATES = [
  {
    allowedDocTypes: [{code: 'incomingInvoice', id: 3000000201}],
    code: 'invoices',
    description: null,
    id: 3000000101,
    isMultiDoc: false,
    name: 'Invoices'
  },
  {
    allowedDocTypes: null,
    code: 'mixed-scans',
    description: 'Scanned packs of several documents',
    id: 3000000102,
    isMultiDoc: true,
    name: 'Mixed scans'
  }
]

function startedJob (id: number, name: string): IDataObject {
  return {
    autoCreateDocument: true,
    createdAt: '2026-09-30T09:15:02.417Z',
    id,
    isGroup: false,
    isMultiDoc: false,
    name,
    status: 'pending',
    template: {code: 'invoices', id: 3000000101}
  }
}

function childJob (id: number, name: string, status: string): IDataObject {
  return {
    ...startedJob(id, name),
    parent: {id: 3000000501},
    status
  }
}

const DESCENDANTS = [
  childJob(3000000502, 'scan-01.pdf', 'success'),
  childJob(3000000503, 'scan-02.docx', 'success'),
  childJob(3000000504, 'scan-03.pdf', 'error')
]

const START = {
  resource: 'recognitionJob',
  operation: 'start',
  template: {
    __rl: true,
    mode: 'list',
    value: 'invoices',
    cachedResultName: 'Invoices'
  },
  binaryPropertyName: 'data',
  autoCreateDocument: true,
  waitForCompletion: false,
  options: {}
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

async function failure (parameters: IDataObject, response: FakeResponse): Promise<NodeApiError> {
  const {ctx} = createExecuteContext({
    parameters,
    responses: [response]
  })
  try {
    await new Nectain().execute.call(ctx)
  } catch (error) {
    assert.ok(error instanceof NodeApiError)
    return error
  }

  assert.fail('The operation did not fail')
}

describe('Recognition Template Get Many', () => {
  it('outputs one item per template', async () => {
    const {output, requests} = await run({
      resource: 'recognitionTemplate',
      operation: 'getAll'
    }, [jsonResponse(TEMPLATES)])

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: '/api/v1/recognition-templates'
      })
    ])
    assert.deepEqual(output.map(item => item.json), TEMPLATES)
  })

  it('fails with the server error on an installation without recognition', async () => {
    const error = await failure({
      resource: 'recognitionTemplate',
      operation: 'getAll'
    }, NOT_FOUND)

    assert.equal(error.message, 'Not Found (not_found)')
  })
})

describe('Recognition Job Start', () => {
  it('starts the recognition of one file with the job JSON and the file part', async () => {
    const job = startedJob(3000000501, 'scan-01.pdf')
    const {output, requests} = await run(
      START,
      [jsonResponse(job, 201)],
      [binaryItem('scan-01.pdf', 'application/pdf', '%PDF-1.7 scan')]
    )

    assert.equal(requests[0].method, 'POST')
    assert.equal(requests[0].url, JOBS)
    assert.deepEqual(multipartParts(requests[0]), [
      {
        head: 'Content-Disposition: form-data; name="job"\r\n' +
          'Content-Type: application/json',
        data: '{"template":{"code":"invoices"},"files":[{"contentPart":"file"}],' +
          '"autoCreateDocument":true}'
      },
      {
        head: 'Content-Disposition: form-data; name="file"; filename="scan-01.pdf"\r\n' +
          'Content-Type: application/pdf',
        data: '%PDF-1.7 scan'
      }
    ])
    assert.deepEqual(output, [{
      json: job,
      pairedItem: {item: 0}
    }])
  })

  it('starts one job per input item', async () => {
    const first = startedJob(3000000501, 'scan-01.pdf')
    const second = startedJob(3000000511, 'scan-02.pdf')
    const {output, requests} = await run(START, [
      jsonResponse(first, 201),
      jsonResponse(second, 201)
    ], [
      binaryItem('scan-01.pdf', 'application/pdf', 'first'),
      binaryItem('scan-02.pdf', 'application/pdf', 'second')
    ])

    assert.deepEqual(
      requests.map(request => multipartParts(request)[1].data),
      ['first', 'second']
    )
    assert.deepEqual(output, [
      {
        json: first,
        pairedItem: {item: 0}
      },
      {
        json: second,
        pairedItem: {item: 1}
      }
    ])
  })

  it('sends the name, the template by ID, and the idempotency key', async () => {
    const {requests} = await run({
      ...START,
      template: {__rl: true, mode: 'id', value: '3000000101'},
      autoCreateDocument: false,
      options: {name: 'March invoices', idempotencyKey: 'invoices-2026-03'}
    }, [
      jsonResponse(startedJob(3000000501, 'March invoices'), 201)
    ], [
      binaryItem('scan-01.pdf', 'application/pdf', 'scan')
    ])

    assert.equal((requests[0].headers as IDataObject)['Idempotency-Key'], 'invoices-2026-03')
    assert.equal(
      multipartParts(requests[0])[0].data,
      '{"template":{"id":3000000101},"files":[{"contentPart":"file"}],' +
        '"autoCreateDocument":false,"name":"March invoices"}'
    )
  })
})

describe('Recognition Job reads', () => {
  it('gets a job with the selected fields', async () => {
    const {requests} = await run({
      resource: 'recognitionJob',
      operation: 'get',
      jobId: '3000000501',
      options: {select: 'status,finishedAt'}
    }, [jsonResponse({status: 'pending', finishedAt: null})])

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: `${JOBS}/3000000501`,
        qs: {select: 'status,finishedAt'}
      })
    ])
  })

  it('fails to get the job of another user with not_found', async () => {
    const error = await failure({
      resource: 'recognitionJob',
      operation: 'get',
      jobId: '3000000501',
      options: {}
    }, NOT_FOUND)

    assert.match(error.message, /not_found/)
  })

  it('gets many jobs with the filters, one item per job', async () => {
    const jobs = [
      startedJob(3000000501, 'scan-01.pdf'),
      startedJob(3000000511, 'scan-02.pdf')
    ]
    const {output, requests} = await run({
      resource: 'recognitionJob',
      operation: 'getAll',
      returnAll: false,
      limit: 50,
      filters: {
        status: ['error', 'completedWithErrors'],
        isGroup: false,
        isMultiDoc: true,
        template: {__rl: true, mode: 'code', value: 'invoices'}
      },
      options: {}
    }, [
      jsonResponse({
        items: jobs,
        pagination: {offset: 0, limit: 50, next: null, previous: null}
      })
    ])

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: JOBS,
        qs: {
          status: 'error,completedWithErrors',
          isGroup: false,
          isMultiDoc: true,
          templateCode: 'invoices',
          limit: 50
        }
      })
    ])
    assert.deepEqual(output.map(item => item.json), jobs)
  })

  it('gets the descendants of a job without pagination, one item per descendant', async () => {
    const {output, requests} = await run({
      resource: 'recognitionJob',
      operation: 'getDescendants',
      jobId: '3000000501',
      filters: {
        template: {__rl: true, mode: 'id', value: '3000000101'}
      },
      options: {}
    }, [jsonResponse(DESCENDANTS)])

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: `${JOBS}/3000000501/descendants`,
        qs: {templateId: 3000000101}
      })
    ])
    assert.deepEqual(output.map(item => item.json.parent), [
      {id: 3000000501},
      {id: 3000000501},
      {id: 3000000501}
    ])
  })

  it('gets the data extracted by a job', async () => {
    const result = {
      document: null,
      errorDetails: null,
      extractedData: {
        attributes: {inv_amount: 1250.5},
        documentType: {code: 'invoice', id: 3000000301}
      },
      validationMessages: []
    }
    const {output, requests} = await run({
      resource: 'recognitionJob',
      operation: 'getResult',
      jobId: '3000000503'
    }, [jsonResponse(result)])

    assert.deepEqual(requests, [
      apiRequest({
        method: 'GET',
        url: `${JOBS}/3000000503/result`
      })
    ])
    assert.deepEqual(output, [{
      json: result,
      pairedItem: {item: 0}
    }])
  })

  it('downloads the file of a job', async () => {
    const {output, requests} = await run({
      resource: 'recognitionJob',
      operation: 'downloadFile',
      jobId: '3000000503',
      binaryPropertyName: 'data'
    }, [{
      statusCode: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': 'attachment; filename="scan-02.docx"'
      },
      body: Buffer.from('docx')
    }])

    assert.deepEqual(requests, [
      downloadRequest({
        method: 'GET',
        url: `${JOBS}/3000000503/file/content`
      })
    ])
    assert.equal(output[0].binary?.data.fileName, 'scan-02.docx')
  })

  it('fails to download the file of a group job with file_not_found', async () => {
    const problem = problemResponse(404, {
      title: 'Not Found',
      detail: 'The recognition job has no file.',
      code: 'file_not_found'
    })
    const error = await failure({
      resource: 'recognitionJob',
      operation: 'downloadFile',
      jobId: '3000000501',
      binaryPropertyName: 'data'
    }, {
      ...problem,
      body: Buffer.from(JSON.stringify(problem.body))
    })

    assert.match(error.message, /file_not_found/)
  })
})
