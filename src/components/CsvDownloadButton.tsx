import { useState } from 'react'
import type {
  PopulationMetadata,
  PopulationMetricRecord,
  PrefectureCode,
} from '../types/population'
import { createPopulationCsvFilename, generatePopulationCsv } from '../utils/csv'

interface CsvDownloadButtonProps {
  metadata: PopulationMetadata
  records: PopulationMetricRecord[]
  selected: PrefectureCode[]
}

export function CsvDownloadButton({ metadata, records, selected }: CsvDownloadButtonProps) {
  const [error, setError] = useState<string | null>(null)

  function downloadCsv() {
    setError(null)
    let objectUrl: string | null = null
    let link: HTMLAnchorElement | null = null
    try {
      const csv = generatePopulationCsv(records, selected, metadata.toYear)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      objectUrl = URL.createObjectURL(blob)

      link = document.createElement('a')
      link.href = objectUrl
      link.download = createPopulationCsvFilename(metadata.toYear, selected)
      document.body.append(link)
      link.click()
    } catch {
      setError('CSVを生成できませんでした。時間をおいて再度お試しください。')
    } finally {
      link?.remove()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }

  return (
    <section className="download-panel" aria-labelledby="csv-heading">
      <div>
        <p className="section-label">DOWNLOAD</p>
        <h2 id="csv-heading">データをCSVで保存</h2>
        <p>
          選択中の都道府県のみを、2015年から{metadata.toYear}年まで古い年順で出力します。
          元データは千人単位です。
        </p>
      </div>
      <button className="download-button" type="button" onClick={downloadCsv}>
        CSVダウンロード
      </button>
      {error && <p className="download-error" role="alert">{error}</p>}
    </section>
  )
}
