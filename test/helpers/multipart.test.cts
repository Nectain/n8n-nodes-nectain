import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {buildMultipart, documentJson, jobJson} from '../../nodes/Nectain/helpers/multipart'

function boundaryOf (contentType: string): string {
  const match = /^multipart\/form-data; boundary=(\S+)$/.exec(contentType)
  assert.ok(match !== null, `Unexpected Content-Type ${contentType}`)

  return match[1]
}

describe('buildMultipart', () => {
  it('writes each part with its disposition, media type, and bytes', () => {
    const {body, contentType} = buildMultipart([
      {
        name: 'document',
        contentType: 'application/json',
        data: '{"documentType":{"code":"contract"}}'
      },
      {
        name: 'file',
        fileName: 'contract.pdf',
        contentType: 'application/pdf',
        data: Buffer.from('%PDF-1.7')
      }
    ])
    const boundary = boundaryOf(contentType)

    assert.equal(body.toString('utf8'), [
      `--${boundary}`,
      'Content-Disposition: form-data; name="document"',
      'Content-Type: application/json',
      '',
      '{"documentType":{"code":"contract"}}',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="contract.pdf"',
      'Content-Type: application/pdf',
      '',
      '%PDF-1.7',
      `--${boundary}--`,
      ''
    ].join('\r\n'))
  })

  it('escapes quotes and backslashes in the file name', () => {
    const {body} = buildMultipart([{
      name: 'file',
      fileName: 'a "b" \\ c.pdf',
      data: ''
    }])

    assert.match(body.toString('utf8'), /; filename="a \\"b\\" \\\\ c\.pdf"\r\n/)
  })

  it('sends a non-ASCII file name as UTF-8 in filename, without filename*', () => {
    const {body} = buildMultipart([{
      name: 'file',
      fileName: 'Звіт.pdf',
      data: ''
    }])
    const text = body.toString('utf8')

    assert.match(text, /; filename="Звіт\.pdf"\r\n/)
    assert.doesNotMatch(text, /filename\*/)
  })

  it('uses a new boundary for each body', () => {
    const first = buildMultipart([{name: 'job', data: '{}'}])
    const second = buildMultipart([{name: 'job', data: '{}'}])

    assert.notEqual(boundaryOf(first.contentType), boundaryOf(second.contentType))
  })
})

describe('documentJson and jobJson', () => {
  it('writes the same document text for equal parameters in any order', () => {
    const first = documentJson({
      documentType: {code: 'invoice'},
      title: 'Invoice #INV-2026-001',
      attributes: {amount: 1250.5},
      primaryFile: {contentPart: 'file'}
    })
    const second = documentJson({
      primaryFile: {contentPart: 'file'},
      attributes: {amount: 1250.5},
      title: 'Invoice #INV-2026-001',
      documentType: {code: 'invoice'}
    })

    assert.equal(first, second)
    assert.equal(
      first,
      '{"documentType":{"code":"invoice"},"title":"Invoice #INV-2026-001",' +
        '"attributes":{"amount":1250.5},"primaryFile":{"contentPart":"file"}}'
    )
  })

  it('writes the job members in a fixed order and leaves out an absent name', () => {
    const json = jobJson({
      autoCreateDocument: true,
      files: [{contentPart: 'file'}],
      template: {code: 'invoices'}
    })

    assert.equal(
      json,
      '{"template":{"code":"invoices"},"files":[{"contentPart":"file"}],"autoCreateDocument":true}'
    )
  })
})
