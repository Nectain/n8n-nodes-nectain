import type {IDataObject, IExecuteFunctions} from 'n8n-workflow'
import {NodeOperationError, sleep} from 'n8n-workflow'

import {nectainRequest} from './request'

export const POLL_INTERVAL_MS = 5000

const FINAL_STATUSES = new Set([
  'success',
  'error',
  'completedWithErrors',
  'canceled',
  'hanging'
])

/**
 * Reads the job every {@link POLL_INTERVAL_MS} until its status is final,
 * then adds `result` for a job that has one:
 * a job that is neither a group nor multi-document, with the status `success` or `error`.
 * The timeout counts the time spent waiting between reads.
 */
export async function waitForJob (
  ctx: IExecuteFunctions,
  job: IDataObject,
  timeoutMs: number,
  pause: (ms: number) => Promise<void> = sleep
): Promise<IDataObject> {
  const url = `/api/v1/recognition-jobs/${String(job.id)}`

  let current = job
  for (let waited = 0; !FINAL_STATUSES.has(current.status as string); waited += POLL_INTERVAL_MS) {
    if (waited >= timeoutMs) {
      throw new NodeOperationError(
        ctx.getNode(),
        `Recognition job ${String(job.id)} did not finish in time`,
        {
          description: `The job is ${String(current.status)}. ` +
            'Read it later with the Get operation of Recognition Job.'
        }
      )
    }

    await pause(POLL_INTERVAL_MS)
    const response = await nectainRequest(ctx, {
      method: 'GET',
      url
    })
    current = response.body as IDataObject
  }

  if (current.isGroup === true || current.isMultiDoc === true) {
    return current
  }
  if (current.status !== 'success' && current.status !== 'error') {
    return current
  }

  const response = await nectainRequest(ctx, {
    method: 'GET',
    url: `${url}/result`
  })

  return {
    ...current,
    result: response.body as IDataObject
  }
}
