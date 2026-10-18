import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {fileNameFromHeaders, toBinaryItem} from '../../nodes/Nectain/helpers/binary'
import {createExecuteContext} from '../_context.cjs'

describe('fileNameFromHeaders', () => {
  it('reads the exact name from filename* before the ASCII fallback', () => {
    const headers = {
      'content-disposition': 'attachment; filename="____ (final)*.pdf"; ' +
        'filename*=UTF-8\'\'%D0%97%D0%B2%D1%96%D1%82%20%28final%29%2A.pdf'
    }

    assert.equal(fileNameFromHeaders(headers), 'Звіт (final)*.pdf')
  })

  it('reads the name from filename', () => {
    const headers = {'content-disposition': 'attachment; filename="scan.docx"'}

    assert.equal(fileNameFromHeaders(headers), 'scan.docx')
  })

  it('returns no name without Content-Disposition', () => {
    assert.equal(fileNameFromHeaders({'content-type': 'application/pdf'}), undefined)
  })
})

describe('toBinaryItem', () => {
  it('names the file by the fallback when the response does not name it', async () => {
    const {ctx} = createExecuteContext({parameters: {}})
    const response = {
      statusCode: 200,
      headers: {'content-type': 'application/octet-stream'},
      body: Buffer.from('bytes')
    }

    const item = await toBinaryItem(ctx, response, 'data', '3000000502')

    assert.equal(item.binary?.data.fileName, '3000000502')
    assert.equal(item.binary?.data.mimeType, 'application/octet-stream')
  })
})
