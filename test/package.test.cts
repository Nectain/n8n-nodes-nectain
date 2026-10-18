import assert from 'node:assert/strict'
import {existsSync, readdirSync} from 'node:fs'
import path from 'node:path'
import {describe, it} from 'node:test'

import packageJson from '../package.json'

const root = path.resolve(__dirname, '..')

function sourceOf (distPath: string): string {
  return distPath
    .replace(/^dist\//, '')
    .replace(/\.js$/, '.ts')
}

function findSources (dir: string, suffix: string): string[] {
  if (!existsSync(path.join(root, dir))) {
    return []
  }

  return readdirSync(path.join(root, dir), {recursive: true, encoding: 'utf8'})
    .filter(file => file.endsWith(suffix))
    .map(file => path.posix.join(dir, file.split(path.sep).join('/')))
}

describe('package.json n8n section', () => {
  const registered = [
    ...packageJson.n8n.nodes,
    ...packageJson.n8n.credentials
  ]

  it('registers only paths that have a source file', () => {
    const missing = registered.filter(
      distPath => !existsSync(path.join(root, sourceOf(distPath)))
    )

    assert.deepEqual(missing, [])
  })

  it('registers every node and credential source file', () => {
    const registeredSources = registered.map(sourceOf)
    const sources = [
      ...findSources('nodes', '.node.ts'),
      ...findSources('credentials', '.credentials.ts')
    ]

    assert.deepEqual(
      sources.filter(file => !registeredSources.includes(file)),
      []
    )
  })
})
