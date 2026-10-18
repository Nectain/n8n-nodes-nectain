import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import type {IDataObject} from 'n8n-workflow'
import {NodeOperationError} from 'n8n-workflow'

import {POLL_INTERVAL_MS, waitForJob} from '../../nodes/Nectain/helpers/wait'
import type {FakeResponse} from '../_context.cjs'
import {createExecuteContext, jsonResponse} from '../_context.cjs'

const STARTED = {
  autoCreateDocument: true,
  createdAt: '2026-09-30T09:15:02.417Z',
  id: 3000000501,
  isGroup: false,
  isMultiDoc: false,
  name: 'scan-01.pdf',
  status: 'pending',
  template: {code: 'invoices', id: 3000000101}
}

const RESULT = {
  document: {href: '/api/v1/documents/3000000777', id: 3000000777},
  errorDetails: null,
  validationMessages: []
}

function waitWith (job: IDataObject, responses: FakeResponse[], timeoutMs: number) {
  const {ctx, requests} = createExecuteContext({
    parameters: {},
    responses
  })
  const pauses: number[] = []
  const pause = async (ms: number) => {
    pauses.push(ms)
  }

  return {
    wait: waitForJob(ctx, job, timeoutMs, pause),
    requests,
    pauses
  }
}

describe('waitForJob', () => {
  it('reads the job until it succeeds and adds its result', async () => {
    const {wait, requests, pauses} = waitWith(STARTED, [
      jsonResponse({...STARTED, status: 'pending'}),
      jsonResponse({...STARTED, status: 'success'}),
      jsonResponse(RESULT)
    ], 60000)

    const job = await wait

    assert.deepEqual(job, {...STARTED, status: 'success', result: RESULT})
    assert.deepEqual(requests.map(request => request.url), [
      '/api/v1/recognition-jobs/3000000501',
      '/api/v1/recognition-jobs/3000000501',
      '/api/v1/recognition-jobs/3000000501/result'
    ])
    assert.deepEqual(pauses, [POLL_INTERVAL_MS, POLL_INTERVAL_MS])
  })

  it('outputs a finished group job without a result', async () => {
    const group = {...STARTED, isGroup: true, name: 'March invoices'}
    const {wait, requests} = waitWith(
      group,
      [jsonResponse({...group, status: 'completedWithErrors'})],
      60000
    )

    assert.deepEqual(await wait, {...group, status: 'completedWithErrors'})
    assert.equal(requests.length, 1)
  })

  it('outputs a finished multi-document job without a result', async () => {
    const job = {...STARTED, isMultiDoc: true}
    const {wait, requests} = waitWith(job, [jsonResponse({...job, status: 'success'})], 60000)

    assert.deepEqual(await wait, {...job, status: 'success'})
    assert.equal(requests.length, 1)
  })

  it('fails with the job ID when the timeout passes first', async () => {
    const {wait, pauses} = waitWith(
      STARTED,
      [jsonResponse(STARTED), jsonResponse(STARTED)],
      2 * POLL_INTERVAL_MS
    )

    await assert.rejects(wait, (error: unknown) => {
      assert.ok(error instanceof NodeOperationError)
      assert.equal(error.message, 'Recognition job 3000000501 did not finish in time')

      return true
    })
    assert.deepEqual(pauses, [POLL_INTERVAL_MS, POLL_INTERVAL_MS])
  })
})
