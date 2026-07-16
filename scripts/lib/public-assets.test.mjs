// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const publicUrl = 'https://population-trends.web-tools-jp.workers.dev/'
const description =
  '北海道・東京都・大阪府・福岡県・沖縄県の人口推移を、総務省統計局「人口推計」のe-Statデータで比較できる可視化サイトです。人口、2015年比指数、前年差、前年比をグラフ・表・CSVで確認できます。'

describe('public assets', () => {
  it('index.htmlに公開用メタデータを静的に設定する', async () => {
    const html = await readFile('index.html', 'utf8')
    expect(html).toContain('<html lang="ja">')
    expect(html).toContain('<title>都道府県人口推移 | 2015年以降の5都道府県比較</title>')
    expect(html).toContain(`content="${description}"`)
    expect(html).toContain(`<link rel="canonical" href="${publicUrl}" />`)
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    expect(html).not.toContain('og:image')
    expect(html).not.toContain('name="keywords"')
  })

  it('robots.txtでトップページを許可しsitemapを案内する', async () => {
    const robots = await readFile('public/robots.txt', 'utf8')
    expect(robots).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${publicUrl}sitemap.xml\n`,
    )
    expect(robots).not.toContain('population.json')
  })

  it('sitemap.xmlにはqueryなしのトップページだけを含める', async () => {
    const sitemap = await readFile('public/sitemap.xml', 'utf8')
    expect(sitemap.match(/<url>/g)).toHaveLength(1)
    expect(sitemap).toContain(`<loc>${publicUrl}</loc>`)
    expect(sitemap).not.toContain('<lastmod>')
    expect(sitemap).not.toMatch(/<loc>[^<]*\?/)
  })

  it('_headersにセキュリティヘッダーとキャッシュ方針を設定する', async () => {
    const headers = await readFile('public/_headers', 'utf8')
    expect(headers).toContain("Content-Security-Policy: default-src 'self'")
    expect(headers).toContain("script-src 'self'")
    expect(headers).toContain("style-src 'self' 'unsafe-inline'")
    expect(headers).toContain("connect-src 'self'")
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000')
    expect(headers).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable')
    expect(headers).toContain(
      '/data/population.json\n  Cache-Control: public, max-age=0, must-revalidate',
    )
  })
})
