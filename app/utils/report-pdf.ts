import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { ReportData, ReportPeriods } from '~/services/report-service'
import { formatCompact, formatNumber, formatNumberRounded, formatPercentage } from '~/utils/format'

type RGB = [number, number, number]

export interface ReportMeta {
  branchLabel: string
  periodLabels: Record<keyof ReportPeriods, string>
  userName: string
  generatedAt: Date
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const COLOR_PRIMARY: RGB = [0, 152, 56]
const COLOR_MUTED: RGB = [163, 163, 163]
const COLOR_TEXT: RGB = [23, 23, 23]
const COLOR_SUBTLE: RGB = [115, 115, 115]
const COLOR_GRID: RGB = [229, 229, 229]
const SERIES_COLORS: RGB[] = [[0, 152, 56], [59, 130, 246], [245, 158, 11], [139, 92, 246], [244, 63, 94], [6, 182, 212]]

const NA = 'Data tidak tersedia'

// The built-in PDF fonts only cover Latin-1, so trend arrows are written as words.
const rupiah = (value?: number | null) => value == null ? NA : `Rp ${formatNumberRounded(value)}`
const count = (value?: number | null) => value == null ? NA : formatNumber(value)
const percent = (value?: number | null) => value == null ? NA : formatPercentage(value)
const trend = (direction?: 'up' | 'down', percentage?: number | null) => {
  if (!direction || percentage == null) return '-'
  return `${direction === 'down' ? 'Turun' : 'Naik'} ${formatPercentage(percentage)}`
}

class ReportBuilder {
  doc = new jsPDF({ unit: 'mm', format: 'a4' })
  y = MARGIN

  ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT - MARGIN - 8) this.newPage()
  }

  newPage() {
    this.doc.addPage()
    this.y = MARGIN
  }

  setColor(color: RGB) {
    this.doc.setTextColor(color[0], color[1], color[2])
  }

  cover(meta: ReportMeta) {
    const { doc } = this
    doc.setFillColor(...COLOR_PRIMARY)
    doc.rect(0, 0, PAGE_WIDTH, 4, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    this.setColor(COLOR_TEXT)
    doc.text('Laporan VP Dashboard', MARGIN, 20)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    this.setColor(COLOR_SUBTLE)
    doc.text('Access Business', MARGIN, 27)

    const generated = meta.generatedAt.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
    autoTable(doc, {
      startY: 34,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1.2, textColor: COLOR_TEXT },
      columnStyles: { 0: { cellWidth: 40, textColor: COLOR_SUBTLE } },
      body: [
        ['Cabang', meta.branchLabel],
        ['Diunduh oleh', meta.userName],
        ['Waktu unduh', generated]
      ]
    })
    this.y = this.lastTableY() + 6
  }

  dashboardTitle(title: string) {
    this.ensureSpace(20)
    const { doc } = this
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    this.setColor(COLOR_TEXT)
    doc.text(title, MARGIN, this.y + 5)
    doc.setDrawColor(...COLOR_PRIMARY)
    doc.setLineWidth(0.6)
    doc.line(MARGIN, this.y + 7.5, PAGE_WIDTH - MARGIN, this.y + 7.5)
    this.y += 13
  }

  sectionTitle(title: string, periodLabel?: string) {
    this.ensureSpace(16)
    const { doc } = this
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    this.setColor(COLOR_TEXT)
    doc.text(title, MARGIN, this.y + 4)
    if (periodLabel) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      this.setColor(COLOR_SUBTLE)
      doc.text(`Periode: ${periodLabel}`, PAGE_WIDTH - MARGIN, this.y + 4, { align: 'right' })
    }
    this.y += 7
  }

  subTitle(title: string) {
    this.ensureSpace(10)
    const { doc } = this
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    this.setColor(COLOR_TEXT)
    doc.text(title, MARGIN, this.y + 3.5)
    this.y += 5
  }

  table(head: string[], body: (string | number)[][], options: { alignRightFrom?: number } = {}) {
    // Keep the header together with at least a few rows
    this.ensureSpace(8 + Math.min(body.length, 3) * 7)
    const alignRightFrom = options.alignRightFrom ?? 1
    const columnStyles: Record<number, { halign: 'right' }> = {}
    head.forEach((_, i) => {
      if (i >= alignRightFrom) columnStyles[i] = { halign: 'right' }
    })

    autoTable(this.doc, {
      startY: this.y,
      margin: { left: MARGIN, right: MARGIN },
      head: [head],
      body: body.map(row => row.map(cell => String(cell))),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.8, textColor: COLOR_TEXT, lineColor: COLOR_GRID, lineWidth: 0.1 },
      headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 248] },
      columnStyles
    })
    this.y = this.lastTableY() + 5
  }

  /**
   * KPI table: metric name, value, description and trend vs the previous period.
   */
  kpiTable(rows: [string, string, string, string][]) {
    this.table(['Metrik', 'Nilai', 'Keterangan', 'Tren vs periode sebelumnya'], rows, { alignRightFrom: 99 })
  }

  lineChart(title: string, categories: string[], series: { name: string, color: RGB, values: number[] }[], formatY: (value: number) => string) {
    const height = 70
    this.ensureSpace(height + 4)
    const { doc } = this
    const x = MARGIN
    const top = this.y

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    this.setColor(COLOR_TEXT)
    doc.text(title, x, top + 3.5)

    const plotLeft = x + 20
    const plotRight = x + CONTENT_WIDTH - 2
    const plotTop = top + 8
    const plotBottom = top + height - 14
    const allValues = series.flatMap(s => s.values)
    const maxValue = Math.max(...allValues, 0)
    const minValue = Math.min(...allValues, 0)
    const range = (maxValue - minValue) || 1
    const yFor = (v: number) => plotBottom - ((v - minValue) / range) * (plotBottom - plotTop)
    const step = categories.length > 1 ? (plotRight - plotLeft) / (categories.length - 1) : 0
    const xFor = (i: number) => categories.length > 1 ? plotLeft + i * step : (plotLeft + plotRight) / 2

    // Grid and Y labels
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setLineWidth(0.1)
    for (let i = 0; i <= 4; i++) {
      const value = minValue + (range * i) / 4
      const gy = yFor(value)
      doc.setDrawColor(...COLOR_GRID)
      doc.line(plotLeft, gy, plotRight, gy)
      this.setColor(COLOR_SUBTLE)
      doc.text(formatY(value), plotLeft - 2, gy + 1, { align: 'right' })
    }

    // X labels
    categories.forEach((label, i) => {
      doc.text(label, xFor(i), plotBottom + 4, { align: 'center' })
    })

    // Series lines (drawn last-first so the primary series is on top)
    ;[...series].reverse().forEach((s) => {
      doc.setDrawColor(...s.color)
      doc.setFillColor(...s.color)
      doc.setLineWidth(0.6)
      s.values.forEach((v, i) => {
        if (i > 0) doc.line(xFor(i - 1), yFor(s.values[i - 1] ?? 0), xFor(i), yFor(v))
        doc.circle(xFor(i), yFor(v), 0.7, 'F')
      })
    })

    // Legend
    let legendX = plotLeft
    const legendY = plotBottom + 9
    series.forEach((s) => {
      doc.setFillColor(...s.color)
      doc.rect(legendX, legendY - 2, 3, 2, 'F')
      this.setColor(COLOR_TEXT)
      doc.text(s.name, legendX + 4.5, legendY)
      legendX += doc.getTextWidth(s.name) + 12
    })

    this.y = top + height
  }

  barChart(title: string, labels: string[], values: number[], formatValue: (value: number) => string) {
    const height = 62
    this.ensureSpace(height + 4)
    const { doc } = this
    const x = MARGIN
    const top = this.y

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    this.setColor(COLOR_TEXT)
    doc.text(title, x, top + 3.5)

    const plotLeft = x + 4
    const plotRight = x + CONTENT_WIDTH - 4
    const plotTop = top + 12
    const plotBottom = top + height - 10
    const maxValue = Math.max(...values, 0) || 1
    const slot = (plotRight - plotLeft) / Math.max(values.length, 1)
    const barWidth = Math.min(slot * 0.55, 28)

    doc.setDrawColor(...COLOR_GRID)
    doc.setLineWidth(0.2)
    doc.line(plotLeft, plotBottom, plotRight, plotBottom)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    values.forEach((value, i) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length] ?? COLOR_PRIMARY
      const barHeight = (Math.max(value, 0) / maxValue) * (plotBottom - plotTop)
      const cx = plotLeft + slot * i + slot / 2
      doc.setFillColor(...color)
      doc.rect(cx - barWidth / 2, plotBottom - barHeight, barWidth, barHeight, 'F')
      this.setColor(COLOR_TEXT)
      doc.text(formatValue(value), cx, plotBottom - barHeight - 1.5, { align: 'center' })
      this.setColor(COLOR_SUBTLE)
      doc.text(labels[i] ?? '', cx, plotBottom + 4, { align: 'center' })
    })

    this.y = top + height
  }

  note(text: string) {
    this.ensureSpace(8)
    const { doc } = this
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    this.setColor(COLOR_SUBTLE)
    doc.text(doc.splitTextToSize(text, CONTENT_WIDTH), MARGIN, this.y + 3)
    this.y += 7
  }

  footer(meta: ReportMeta) {
    const { doc } = this
    const total = doc.getNumberOfPages()
    const generated = meta.generatedAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    for (let page = 1; page <= total; page++) {
      doc.setPage(page)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      this.setColor(COLOR_SUBTLE)
      doc.text(`VP Dashboard Access Business - ${meta.branchLabel} - ${generated}`, MARGIN, PAGE_HEIGHT - 8)
      doc.text(`Halaman ${page} dari ${total}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' })
    }
  }

  lastTableY(): number {
    return (this.doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? this.y
  }
}

/**
 * Monthly series keyed by year (as returned by the revenue / churn-rate endpoints),
 * newest year first.
 */
const yearsOf = (rows: { month: Record<string, unknown> }[]) => {
  const first = rows[0]
  return first ? Object.keys(first.month).sort((a, b) => Number(b) - Number(a)) : []
}

function growthSection(r: ReportBuilder, data: ReportData, meta: ReportMeta) {
  const lag = data.growthLagging
  r.dashboardTitle('Growth Dashboard')
  r.sectionTitle('Lagging Indicator', meta.periodLabels.growthLagging)

  const ach = lag.revenueAchievement
  r.kpiTable([
    ['Revenue Achievement', percent(ach?.percentage), ach ? `${rupiah(ach.revenue)} dari target ${rupiah(ach.target)}` : NA, trend(ach?.trend, ach?.trendPercentage)],
    ['New Revenue', rupiah(lag.newCustomer?.value), lag.newCustomer ? `Deal baru ${lag.newCustomer.period}` : '-', trend(lag.newCustomer?.trend, lag.newCustomer?.percentage)],
    ['Forecast Revenue Next Month', rupiah(lag.forecastRevenue?.value), 'Opportunity stage Negotiation', trend(lag.forecastRevenue?.trend, lag.forecastRevenue?.percentage)],
    ['New MRC', rupiah(lag.newMrc?.value), lag.newMrc ? `Unpaid: ${rupiah(lag.newMrc.details.mrc_unpaid)}` : '-', trend(lag.newMrc?.trend, lag.newMrc?.percentage)],
    ['Total MRC (YTD)', rupiah(lag.totalMrcYtd?.value), lag.totalMrcYtd?.period ?? '-', trend(lag.totalMrcYtd?.trend, lag.totalMrcYtd?.percentage)],
    ['ARPU', rupiah(lag.arpu?.value), lag.arpu ? `Per pelanggan / ${lag.arpu.period}` : '-', trend(lag.arpu?.trend, lag.arpu?.percentage)]
  ])

  if (lag.arpu?.details?.length) {
    r.subTitle('ARPU per Service Group')
    r.table(
      ['Service Group', 'Jumlah Service', 'Total Revenue', 'ARPU'],
      lag.arpu.details.map(d => [d.serviceGroup || 'Unknown', count(d.jumlahService), rupiah(d.totalRevenue), rupiah(d.avgPerService)])
    )
  }

  if (lag.revenue?.length) {
    const rows = lag.revenue
    const [current, previous] = yearsOf(rows)
    const years = [current, previous].filter((y): y is string => !!y)
    const revenueOf = (row: typeof rows[number], year: string) => row.month[year]?.revenue ?? 0
    r.lineChart(
      'Revenue (YTD)',
      rows.map(row => row.period),
      years.map((year, i) => ({ name: `${year} YTD`, color: i === 0 ? COLOR_PRIMARY : COLOR_MUTED, values: rows.map(row => revenueOf(row, year)) })),
      v => formatCompact(v)
    )

    const head = ['Bulan', ...years]
    if (current && previous) head.push('Growth')
    r.table(head, rows.map((row) => {
      const cells = [row.period, ...years.map(year => rupiah(revenueOf(row, year)))]
      if (current && previous) {
        const prev = revenueOf(row, previous)
        cells.push(prev ? `${(((revenueOf(row, current) - prev) / prev) * 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%` : '-')
      }
      return cells
    }))
  }

  const lead = data.growthLeading
  r.sectionTitle('Leading Indicator', meta.periodLabels.growthLeading)
  r.kpiTable([
    ['Forecast MRC', rupiah(lead.forecastMrc?.value), 'All MRC pipeline Negotiation', trend(lead.forecastMrc?.trend, lead.forecastMrc?.percentage)],
    ['Total Opportunity', count(lead.opportunity?.value), lead.opportunity ? `Semua opportunity ${lead.opportunity.period}` : '-', trend(lead.opportunity?.trend, lead.opportunity?.percentage)],
    ['Avg. Sales Cycle', lead.cycle ? `${formatNumberRounded(lead.cycle.value)} hari` : NA, '-', trend(lead.cycle?.trend, lead.cycle?.percentage)],
    ['Total Leads', lead.leads ? formatNumberRounded(lead.leads.value) : NA, lead.leads ? `Semua prospect ${lead.leads.period}` : '-', trend(lead.leads?.trend, lead.leads?.percentage)],
    ['Avg. Activity per Sales', lead.activity ? formatNumberRounded(lead.activity.value) : NA, 'Dari semua sales', trend(lead.activity?.trend, lead.activity?.percentage)],
    ['Account Manager', count(lead.amSnapshot?.value), lead.amSnapshot?.period ?? '-', trend(lead.amSnapshot?.trend, lead.amSnapshot?.percentage)],
    ['Pipeline Value', rupiah(lead.pipelineValue?.value), lead.pipelineValue?.period ?? '-', trend(lead.pipelineValue?.trend, lead.pipelineValue?.percentage)],
    ['Win Rate', percent(lead.winRate?.value), lead.winRate ? `Win ${count(lead.winRate.details.win.value)} / Lose ${count(lead.winRate.details.lose.value)}` : '-', trend(lead.winRate?.trend, lead.winRate?.percentage)],
    ['Discount Exposure', rupiah(lead.discount?.value), '-', trend(lead.discount?.trend, lead.discount?.percentage)]
  ])

  const stage = lead.pipelineStage
  if (stage) {
    const stages = [stage.qualification, stage.proposal, stage.negotiation]
    r.barChart('Pipeline by Stage', stages.map(s => s.name), stages.map(s => s.value), v => formatCompact(v))
    r.table(['Stage', 'Nilai Pipeline', 'Porsi'], stages.map(s => [s.name, rupiah(s.value), `${s.percentage.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`]))
  }

  if (lead.discount?.details?.length) {
    r.subTitle('Discount Exposure per Service Group')
    r.table(['Service Group', 'Discount'], lead.discount.details.map(d => [d.serviceGroup || 'Unknown', rupiah(d.discount)]))
  }
}

function retentionSection(r: ReportBuilder, data: ReportData, meta: ReportMeta) {
  const lag = data.retentionLagging
  r.newPage()
  r.dashboardTitle('Retention Dashboard')
  r.sectionTitle('Lagging Indicator', meta.periodLabels.retentionLagging)

  const net = lag.netMrc
  const wm = lag.wirelessMigration
  r.kpiTable([
    ['Net MRC Growth', rupiah(net?.value), net ? `New MRC ${rupiah(net.newMrc.value)}, Churn MRC ${rupiah(net.churnMrc.value)}` : '-', trend(net?.trend, net?.percentage)],
    ['Churn Revenue', lag.churn ? rupiah(Math.abs(lag.churn.revenue)) : NA, lag.churn?.period ?? '-', trend(lag.churn?.trend, lag.churn?.percentage)],
    ['Customer Lose', count(lag.customerLose?.total.value), lag.customerLose?.total.period ?? '-', trend(lag.customerLose?.total.trend, lag.customerLose?.total.percentage)],
    ['Total Customer Wireless', count(wm?.totalCustomer.value), 'Layanan aktif', trend(wm?.totalCustomer.trend, wm?.totalCustomer.percentage)],
    ['Customer Wireless Termigrasi', count(wm?.migrated.value), wm?.migrated.period ?? '-', trend(wm?.migrated.trend, wm?.migrated.percentage)],
    ['Migrasi', wm ? `${Number(wm.migrationRate.value.toFixed(1)).toLocaleString('id-ID')}%` : NA, wm ? `${wm.migrationRate.migratedValue} dari ${wm.migrationRate.totalValue} customer wireless` : '-', trend(wm?.migrationRate.trend, wm?.migrationRate.percentage)],
    ['Forecast Net MRC', rupiah(lag.forecastNetMrc?.value), lag.forecastNetMrc?.period ?? '-', trend(lag.forecastNetMrc?.trend, lag.forecastNetMrc?.percentage)],
    ['Forecast Churn Next Month', rupiah(lag.forecastChurn?.forecastMrc.value), 'Perlu tindakan preventif', trend(lag.forecastChurn?.forecastMrc.trend, lag.forecastChurn?.forecastMrc.percentage)]
  ])

  if (lag.customerLose?.detail?.length) {
    r.subTitle('Customer Lose per Service Group')
    r.table(
      ['Service Group', 'Customer Lose', 'Tren'],
      lag.customerLose.detail.map(d => [d.service_group, count(d.value), trend(d.trend, d.percentage)])
    )
  }

  if (lag.churnRate?.length) {
    const rows = lag.churnRate
    const [current, previous] = yearsOf(rows)
    const years = [current, previous].filter((y): y is string => !!y)
    r.lineChart(
      'Churn Rate (YTD)',
      rows.map(row => row.period),
      years.map((year, i) => ({ name: `${year} YTD`, color: i === 0 ? [225, 29, 72] as RGB : COLOR_MUTED, values: rows.map(row => row.month[year]?.ret ?? 0) })),
      v => `${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`
    )
    r.table(
      ['Bulan', ...years.flatMap(y => [`Churn Rate ${y}`, `Churn ${y}`, `Aktif ${y}`])],
      rows.map(row => [row.period, ...years.flatMap((y) => {
        const m = row.month[y]
        return m ? [`${m.ret.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`, count(m.churn), count(m.active)] : ['-', '-', '-']
      })])
    )
  }

  const lead = data.retentionLeading
  r.sectionTitle('Leading Indicator', meta.periodLabels.retentionLeading)
  const ce = lead.contractExpiring
  r.kpiTable([
    ['Contract Expiring 30 Hari', count(ce?.total_30), 'Kontrak segera berakhir', '-'],
    ['Contract Expiring 60 Hari', count(ce?.total_60), 'Kontrak segera berakhir', '-'],
    ['Contract Expiring 90 Hari', count(ce?.total_90), 'Kontrak segera berakhir', '-'],
    ['Customer >= 2 Ticket dalam 1 Bulan', count(lead.ticket?.value), 'Indikasi ketidakpuasan layanan', trend(lead.ticket?.trend, lead.ticket?.percentage)],
    ['Penurunan Usage Customer', count(lead.usage?.value), 'Usage < 500MB per bulan', trend(lead.usage?.trend, lead.usage?.percentage)]
  ])

  if (lead.payment) {
    // monthly / annual are percentage shares of customers (shown as % on the dashboard)
    const { monthly, annual } = lead.payment
    r.barChart('Customer Payment', ['Monthly', 'Annual'], [monthly, annual], v => formatPercentage(v))
    r.table(['Tipe Pembayaran', 'Porsi Customer'], [
      ['Monthly', percent(monthly)],
      ['Annual', percent(annual)]
    ])
  }
}

function serviceQualitySection(r: ReportBuilder, data: ReportData, meta: ReportMeta) {
  const lag = data.serviceLagging
  r.newPage()
  r.dashboardTitle('Service and Quality Dashboard')
  r.sectionTitle('Lagging Indicator', meta.periodLabels.serviceLagging)
  r.kpiTable([
    ['Total Tiket', count(lag.ticket?.value), lag.ticket?.period ?? '-', trend(lag.ticket?.trend, lag.ticket?.percentage)],
    ['Total Komplain Customer', count(lag.complaint?.value), lag.complaint?.period ?? '-', trend(lag.complaint?.trend, lag.complaint?.percentage)],
    ['Solved Customers', percent(lag.solvedPercentage?.value), lag.solvedPercentage?.period ?? '-', '-'],
    ['Total Solved', count(lag.solved?.value), lag.solved?.period ?? '-', '-']
  ])
  if (lag.ticket && lag.complaint && lag.solved) {
    r.barChart('Tiket, Komplain & Solved', ['Total Tiket', 'Total Komplain', 'Total Solved'], [lag.ticket.value, lag.complaint.value, lag.solved.value], v => formatNumber(v))
  }

  const lead = data.serviceLeading
  r.sectionTitle('Leading Indicator', meta.periodLabels.serviceLeading)
  r.kpiTable([
    ['Repeat Issue Rate', percent(lead.issue?.value), lead.issue?.period ?? '-', trend(lead.issue?.trend, lead.issue?.percentage)],
    ['Network Incident', count(lead.incident?.value), lead.incident?.period ?? '-', trend(lead.incident?.trend, lead.incident?.percentage)]
  ])
}

/**
 * Build the dashboard data report (numbers, tables and charts) as a PDF document.
 */
export function buildReportPdf(data: ReportData, meta: ReportMeta): jsPDF {
  const r = new ReportBuilder()
  r.cover(meta)
  if (data.failedCount > 0) {
    r.note(`${data.failedCount} metrik gagal dimuat saat laporan dibuat dan ditandai "${NA}".`)
  }
  growthSection(r, data, meta)
  retentionSection(r, data, meta)
  serviceQualitySection(r, data, meta)
  r.footer(meta)
  return r.doc
}
