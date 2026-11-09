<template>
  <div class="tvwrap">
    <!-- Header & Filters -->
    <div class="header">
      <div class="brand">
        <img src="/logo.png" alt="Nusanet Logo" @error="(e:any)=>{ e.target.style.display='none' }" />
        <div>
          <h1>{{ titleLabel }}</h1>
          <p>{{ subtitleLabel }} 🔥 • {{ todayFormatted }}</p>
          <p class="lastupd">Last update: {{ lastUpdated }}</p>
        </div>
      </div>

      <div class="filters">
        <label class="field"><span>Type</span>
          <select v-model="selectedType">
            <option v-for="o in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
        <label class="field"><span>Cabang</span>
          <select v-model="selectedBranch">
            <option v-for="o in branchOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
        <label class="field"><span>Team</span>
          <select v-model="selectedTeam">
            <option v-for="o in teamOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
        <label class="field"><span>Refresh</span>
          <select v-model="selectedRefresh">
            <option v-for="o in refreshOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
      </div>
    </div>

    <!-- Heatmap table (Access Home — same look as the TV page) -->
    <div v-if="!isBusiness" class="tv-table scrollable-table" @mouseenter="pauseScroll" @mouseleave="resumeScroll">
      <table class="tvgrid">
        <colgroup>
          <col style="width:220px" />
          <col style="width:150px" />
          <col v-for="d in days" :key="'c'+d" />
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th class="col-total">{{ totalLabel }}</th>
            <th v-for="d in days" :key="'h'+d" class="col-num" :class="headClass(d)">{{ d }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in tableData" :key="ri">
            <td>
              <div class="name-cell">
                <span class="avatar">
                  <img v-if="row.photoProfile" :src="row.photoProfile" alt="" @error="onAvatarError($event, row.name)" />
                  <template v-else>{{ initials(row.name) }}</template>
                </span>
                <span class="name-text">
                  <div class="name-main">{{ row.name }}</div>
                  <div class="name-sub">{{ row.organizationName }}</div>
                </span>
              </div>
            </td>
            <td class="col-total">{{ fmt((row as any).total) }}</td>
            <td v-for="d in days" :key="'d'+d" class="col-num"
                :class="[cellClass(row, d), { clickable: cellVal(row, d) > 0 }]"
                @click="openDetail(row, d)">{{ fmt(cellVal(row, d)) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="foot-label">average: {{ fmt(grandAvg) }}</td>
            <td class="col-total">{{ fmt(grandTotal) }}</td>
            <td v-for="d in days" :key="'f'+d" class="col-num" :class="headClass(d)">{{ fmt(colTotalOf(d)) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Weekly BDE performance table (Access Business) -->
    <div v-else class="tv-table scrollable-table" @mouseenter="pauseScroll" @mouseleave="resumeScroll">
      <table class="tvgrid weekly">
        <colgroup>
          <col style="width:280px" />
          <col style="width:200px" />
          <col style="width:220px" />
          <col style="width:200px" />
        </colgroup>
        <thead>
          <tr>
            <th>Nama BDE</th>
            <th class="col-num">Total Activity this week</th>
            <th class="col-num">MRC Update This 3 month</th>
            <th class="col-num">% Pencapaian Target</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in businessRows" :key="ri">
            <td>
              <div class="name-cell">
                <span class="avatar">
                  <img v-if="row.photoProfile" :src="row.photoProfile" alt="" @error="onAvatarError($event, row.name)" />
                  <template v-else>{{ initials(row.name) }}</template>
                </span>
                <span class="name-text">
                  <div class="name-main">{{ row.name }}</div>
                  <div class="name-sub">{{ row.organizationName }}</div>
                </span>
              </div>
            </td>
            <td class="col-num">{{ row.activityThisWeek }}</td>
            <td class="col-num money">{{ money(row.mrcThisMonth) }}</td>
            <td class="col-num" :class="achClass(row.achievementPct)">{{ pct(row.achievementPct) }}</td>
          </tr>
          <tr v-if="!businessRows.length">
            <td colspan="4" class="empty-row">Tidak ada data BDE.</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="foot-label">Total</td>
            <td class="col-num">{{ bTotalActivity }}</td>
            <td class="col-num money">{{ money(bTotalMrc) }}</td>
            <td class="col-num" :class="achClass(bOverallAch)">{{ pct(bOverallAch) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Detail modal: opened by clicking a number -->
    <div v-if="detailOpen" class="modal-overlay" @click.self="closeDetail">
      <div class="modal">
        <div class="modal-head">
          <div class="modal-title">{{ detailTitle }}</div>
          <button class="modal-close" type="button" @click="closeDetail">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="detailLoading" class="modal-state">Memuat…</div>
          <div v-else-if="!detailItems.length" class="modal-state">Tidak ada data.</div>
          <table v-else class="detail-table">
            <thead v-if="detailType === 'access_business'">
              <tr><th class="c-no">#</th><th>Jenis</th><th>Waktu</th></tr>
            </thead>
            <thead v-else>
              <tr><th class="c-no">#</th><th>Customer ID</th><th>Pelanggan</th><th>Account Name</th><th>Service</th><th class="c-no">Bobot</th><th>Tgl Bayar</th></tr>
            </thead>
            <tbody v-if="detailType === 'access_business'">
              <tr v-for="(it, i) in detailItems" :key="i">
                <td class="c-no">{{ i + 1 }}</td>
                <td>{{ (it as any).type }}</td>
                <td>{{ fmtDateTime((it as any).at) }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="(it, i) in detailItems" :key="i">
                <td class="c-no">{{ i + 1 }}</td>
                <td>{{ (it as any).customerId }}</td>
                <td>{{ (it as any).customerName }}</td>
                <td>{{ (it as any).accountName }}</td>
                <td>{{ (it as any).serviceName }}</td>
                <td class="c-no">{{ (it as any).weight }}</td>
                <td>{{ fmtDateTime((it as any).date) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { salesPerformanceService } from '~/services/sales-performance-service'
import type { Manager, SalesPerformanceData, BusinessWeekly } from '~/types/sales-performance'

// Format today's date in Indonesian locale to show only Month and Year (e.g. "Juni 2026")
const todayFormatted = ref(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))

definePageMeta({
  layout: 'public'
})

const route = useRoute()
const router = useRouter()

// Type options (matches sales.type values)
const typeOptions = [
  { label: 'Access Home', value: 'access_home' },
  { label: 'Access Business', value: 'access_business' }
]

// Branch options (matches sales.branch_id codes)
const branchOptions = [
  { label: 'Semua Cabang', value: 'all' },
  { label: 'Medan', value: '020-CABANG' },
  { label: 'Jakarta', value: '025' },
  { label: 'Bali', value: '062' },
  { label: 'Binjai', value: '027' },
  { label: 'Tanjung Morawa', value: '029' }
]

const refreshOptions = [
  { label: '30 Detik', value: '30s' },
  { label: '1 Menit', value: '1m' },
  { label: '15 Menit', value: '15m' },
  { label: '30 Menit', value: '30m' },
  { label: '1 Jam', value: '1h' }
]

// Read a query param and keep it only if it is a known option value.
const pickQuery = (key: string, allowed: string[], fallback: string) => {
  const raw = route.query[key]
  const val = Array.isArray(raw) ? raw[0] : raw
  return val && allowed.includes(val) ? val : fallback
}

// Filter choices — initialised from URL query so a TV can be pinned via URL,
// e.g. /public/sales-performance?type=access_home&branchId=025
const selectedType = ref(pickQuery('type', typeOptions.map(o => o.value), 'access_home'))
const selectedBranch = ref(pickQuery('branchId', branchOptions.map(o => o.value), 'all'))
const selectedRefresh = ref(pickQuery('refresh', refreshOptions.map(o => o.value), '1h'))
// Team is a manager id resolved after managers load, so accept the raw value.
const teamQuery = Array.isArray(route.query.team) ? route.query.team[0] : route.query.team
const selectedTeam = ref(teamQuery || 'all')

// True when the Business (weekly BDE) view is active instead of the daily heatmap.
const isBusiness = computed(() => selectedType.value === 'access_business')

// Page title: Business view is weekly, Home view is daily.
const titleLabel = computed(() => isBusiness.value ? 'Weekly monitoring Performance' : 'Daily monitoring Performance')

// Subtitle depends on type: Home -> heatmap; Business -> weekly BDE performance
const subtitleLabel = computed(() =>
  isBusiness.value ? 'BDE Weekly Performance' : 'Sales Achievement heatmap'
)

// Loading & timing states
const isRefreshing = ref(false)
const stampNow = () => new Date().toLocaleString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
})
const lastUpdated = ref(stampNow())

const managers = ref<Manager[]>([])
const teamOptions = computed(() => [
  { label: 'Semua Tim', value: 'all' },
  ...managers.value.map(m => ({ label: m.name, value: String(m.id) }))
])

// Fetch managers from API (filtered by selected type AND branch)
const fetchManagers = async () => {
    const type = selectedType.value
    const branchId = selectedBranch.value !== 'all' ? selectedBranch.value : undefined
    const response = await salesPerformanceService.getManagers(type, branchId)
    if (response.success) {
        managers.value = response.data
        // Drop the selected team if it is no longer in the filtered manager list.
        if (selectedTeam.value !== 'all' && !managers.value.some(m => String(m.id) === selectedTeam.value)) {
            selectedTeam.value = 'all'
        }
    }
}

// Sales data from API
const salesData = ref<SalesPerformanceData[]>([])

// Weekly BDE summary (access_business) from API
const businessWeekly = ref<BusinessWeekly>({ week: { label: '', start: '', end: '' }, month: '', rows: [] })
const businessRows = computed(() => businessWeekly.value.rows)

// Fetch daily heatmap data (access_home) from API
const fetchSalesData = async () => {
    const managerId = selectedTeam.value !== 'all' ? selectedTeam.value : undefined
    const branchId = selectedBranch.value !== 'all' ? selectedBranch.value : undefined
    const type = selectedType.value
    const response = await salesPerformanceService.getSalesData(managerId, branchId, type)
    if (response.success) {
      salesData.value = response.data
      lastUpdated.value = stampNow()
    }
}

// Fetch weekly BDE summary (access_business) from API
const fetchBusinessWeekly = async () => {
    const managerId = selectedTeam.value !== 'all' ? selectedTeam.value : undefined
    const branchId = selectedBranch.value !== 'all' ? selectedBranch.value : undefined
    const response = await salesPerformanceService.getBusinessWeekly(managerId, branchId)
    if (response.success) {
      businessWeekly.value = response.data
      lastUpdated.value = stampNow()
    }
}

// Load whichever dataset matches the active type. Errors are swallowed so a
// transient API failure keeps the last-good data on screen (this runs on a TV);
// the auto-refresh timer will retry on the next tick.
const loadData = async () => {
    try {
        if (isBusiness.value) await fetchBusinessWeekly()
        else await fetchSalesData()
    } catch {
        // keep previous data; next refresh retries
    }
}

// ---- Weekly (Business) formatting & totals ----
const money = (n: number) => (Number(n) > 0 ? Number(n).toLocaleString('id-ID') : '—')
const pct = (n: number | null) => (n === null || n === undefined ? '—' : `${Math.round(Number(n))}%`)
const achClass = (n: number | null) => (n === null || n === undefined ? '' : (Number(n) >= 100 ? 'pos' : 'neg'))

const bTotalActivity = computed(() => businessRows.value.reduce((a, r) => a + (Number(r.activityThisWeek) || 0), 0))
const bTotalMrc = computed(() => businessRows.value.reduce((a, r) => a + (Number(r.mrcThisMonth) || 0), 0))
const bTotalTarget = computed(() => businessRows.value.reduce((a, r) => a + (Number(r.target) || 0), 0))
const bOverallAch = computed<number | null>(() => bTotalTarget.value > 0 ? (bTotalMrc.value / bTotalTarget.value) * 100 : null)

// Computed: transform API data (number[] → d1..d30) and add total
const tableData = computed(() => {
  return salesData.value.map(row => {
    const dayData: Record<string, number> = {}
    row.data.forEach((val, i) => {
      dayData[`d${i + 1}`] = val
    })
    const total = r1(row.data.reduce((a, b) => a + b, 0))
    return { id: row.id, name: row.name, photoProfile: row.photoProfile, organizationName: row.organizationName, ...dayData, total }
  })
})

// Round to 2 decimals (internal sums keep the weighted/decimal precision)
const r1 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
// Display as a whole number, floored: you only "earn" a point once a full unit
// is reached (e.g. 3 nusaselecta30 = 1). Epsilon guards float noise (2.999… -> 3).
const fmt = (n: number) => String(Math.floor((Number(n) || 0) + 1e-6))

// Per-day (column) max across all rows, for the green "highest value" highlight.
const colMaxByDay = computed<Record<number, number>>(() => {
  const res: Record<number, number> = {}
  for (let d = 1; d <= currentDay.value; d++) {
    let m = 0
    for (const row of tableData.value) {
      const v = Number((row as any)[`d${d}`]) || 0
      if (v > m) m = v
    }
    res[d] = m
  }
  return res
})


// Only show day columns up to today; future days aren't rendered.
const currentDay = ref(new Date().getDate())

// Holidays: Sundays plus any dates passed via ?holidays=2026-08-17,...
const holidaySet = computed(() => {
  const raw = Array.isArray(route.query.holidays) ? route.query.holidays[0] : route.query.holidays
  const set = new Set<string>()
  if (raw) String(raw).split(',').forEach(s => { const t = s.trim(); if (t) set.add(t) })
  return set
})
const pad2 = (n: number) => (n < 10 ? '0' : '') + n
const isHoliday = (year: number, monthIndex: number, d: number) => {
  if (new Date(year, monthIndex, d).getDay() === 0) return true // Sunday
  return holidaySet.value.has(`${year}-${pad2(monthIndex + 1)}-${pad2(d)}`)
}

// ---- Table helpers (plain table, same look as the TV page) ----
const days = computed(() => Array.from({ length: currentDay.value }, (_, i) => i + 1))
const totalLabel = computed(() => selectedType.value === 'access_business' ? 'Activity' : 'Achievement')

const initials = (name: string) => { const n = (name || '').trim(); return n ? n.charAt(0).toUpperCase() : '?' }
const cellVal = (row: any, d: number) => Number(row['d' + d]) || 0
const nowY = () => new Date().getFullYear()
const nowM = () => new Date().getMonth()

const headClass = (d: number) => ({
  holiday: isHoliday(nowY(), nowM(), d),
  today: d === currentDay.value
})
const cellClass = (row: any, d: number) => {
  const v = cellVal(row, d)
  return {
    holiday: isHoliday(nowY(), nowM(), d),
    today: d === currentDay.value,
    zero: v === 0,
    'is-max': v > 0 && v === colMaxByDay.value[d]
  }
}
const colTotalOf = (d: number) => r1(tableData.value.reduce((a: number, r: any) => a + (Number(r['d' + d]) || 0), 0))
const grandTotal = computed(() => r1(tableData.value.reduce((a: number, r: any) => a + (Number(r.total) || 0), 0)))
// Overall average per day = grand total / elapsed days (shown in the footer)
const grandAvg = computed(() => r1(grandTotal.value / (currentDay.value || 1)))

// Replace a broken avatar image with the name's initial (matches the TV page).
const onAvatarError = (e: Event, name: string) => {
  const img = e.target as HTMLImageElement
  const parent = img.parentElement
  if (parent) parent.textContent = initials(name)
}

// Refresh: re-fetch data from API
const triggerRefresh = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true

  await loadData()
  todayFormatted.value = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  currentDay.value = new Date().getDate()
  isRefreshing.value = false
}

// When Type or Branch changes, refresh the manager list so Team only shows
// managers matching the current type+branch. fetchManagers resets Team if the
// current selection is no longer valid for the new filter.
watch([selectedType, selectedBranch], async () => {
  await fetchManagers()
})

// Watchers for Type, Branch & Team selection
watch([selectedType, selectedBranch, selectedTeam], () => {
  loadData()
})

// Keep the URL query in sync so the current filter config is shareable / TV-pinnable.
// Only non-default values are written to keep the URL clean.
watch([selectedType, selectedBranch, selectedTeam, selectedRefresh], () => {
  router.replace({
    query: {
      ...(selectedType.value !== 'access_home' ? { type: selectedType.value } : {}),
      ...(selectedBranch.value !== 'all' ? { branchId: selectedBranch.value } : {}),
      ...(selectedTeam.value !== 'all' ? { team: selectedTeam.value } : {}),
      ...(selectedRefresh.value !== '1h' ? { refresh: selectedRefresh.value } : {})
    }
  })
})

// Auto-Refresh Interval Setup
let refreshIntervalId: any = null

const startRefreshTimer = () => {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId)
    refreshIntervalId = null
  }

  let ms = 0
  switch (selectedRefresh.value) {
    case '30s':
      ms = 30 * 1000
      break
    case '1m':
      ms = 60 * 1000
      break
    case '15m':
      ms = 15 * 60 * 1000
      break
    case '30m':
      ms = 30 * 60 * 1000
      break
    case '1h':
      ms = 60 * 60 * 1000
      break
  }

  if (ms > 0) {
    refreshIntervalId = setInterval(() => {
      triggerRefresh()
    }, ms)
  }
}

watch(selectedRefresh, () => {
  startRefreshTimer()
})

// Auto-Scroll Infinity Configuration
let autoScrollIntervalId: any = null
const isScrollPaused = ref(false)

const pauseScroll = () => {
  isScrollPaused.value = true
}

const resumeScroll = () => {
  isScrollPaused.value = false
}

const runAutoScroll = () => {
  if (isScrollPaused.value) return

  const el = document.querySelector('.scrollable-table')
  if (!el) return

  // Scroll down by 1px
  el.scrollTop += 1

  // If reached bottom, pause briefly and loop back to top
  if (Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight) {
    isScrollPaused.value = true
    setTimeout(() => {
      // Loop back to top smoothly
      el.scrollTo({ top: 0, behavior: 'smooth' })
      setTimeout(() => {
        isScrollPaused.value = false
      }, 1000) // Pause for 1 second at the top
    }, 1500) // Pause for 1.5 seconds at the bottom
  }
}

const startAutoScroll = () => {
  if (autoScrollIntervalId) {
    clearInterval(autoScrollIntervalId)
  }
  // Run scroll step every 30ms (very smooth scrolling)
  autoScrollIntervalId = setInterval(runAutoScroll, 30)
}

const stopAutoScroll = () => {
  if (autoScrollIntervalId) {
    clearInterval(autoScrollIntervalId)
    autoScrollIntervalId = null
  }
}

// ---- Detail modal (click a number to see the list behind it) ----
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailTitle = ref('')
const detailType = ref('')
const detailItems = ref<any[]>([])

const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
const fmtDateTime = (s: string) => s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

const openDetail = async (row: any, day: number) => {
  if (cellVal(row, day) <= 0) return
  const now = new Date()
  detailOpen.value = true
  detailLoading.value = true
  detailItems.value = []
  detailType.value = ''
  detailTitle.value = `${row.name} • ${day} ${todayFormatted.value}`
  isScrollPaused.value = true // freeze auto-scroll while the modal is open
  try {
    const res = await salesPerformanceService.getDetail(row.id, now.getFullYear(), now.getMonth() + 1, day)
    if (res.success && res.data) {
      detailType.value = res.data.type
      detailItems.value = (res.data.items as any[]) || []
    }
  } finally {
    detailLoading.value = false
  }
}
const closeDetail = () => {
  detailOpen.value = false
  isScrollPaused.value = false
}

onMounted(async () => {
  await fetchManagers()
  await loadData()
  startRefreshTimer()
  // Give the table a moment to render before starting scroll
  setTimeout(() => {
    startAutoScroll()
  }, 1000)
})

onUnmounted(() => {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId)
  }
  stopAutoScroll()
})
</script>

<style scoped>
/* Same visual language as the standalone TV page */
.tvwrap {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #171717;
  display: flex; flex-direction: column; height: 100%; min-height: 0;
}

.header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.brand { display: flex; align-items: center; }
.brand img { width: 44px; height: 44px; object-fit: contain; margin-right: 14px; }
.brand h1 { font-size: 22px; font-weight: bold; margin: 0; color: #171717; }
.brand p { font-size: 14px; color: #64748b; font-weight: 500; margin: 2px 0 0 0; }
.brand .lastupd { font-size: 12px; color: #94a3b8; font-weight: 500; margin: 2px 0 0 0; }

.filters { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; }
.field > span { font-size: 12px; font-weight: bold; color: #404040; margin-bottom: 4px; }
.field select {
  font-size: 14px; padding: 6px 8px; border: 1px solid #d4d4d4; border-radius: 6px;
  background: #ffffff; color: #171717; min-width: 120px;
}

.tv-table { flex: 1 1 auto; min-height: 0; overflow: auto; border: 1px solid #d4d4d4; border-radius: 10px; }
.tvgrid { table-layout: fixed; border-collapse: collapse; width: 100%; }
.tvgrid th, .tvgrid td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

thead th {
  position: sticky; top: 0; z-index: 2;
  background: #f8fafc; color: #0f172a; font-weight: 800; font-size: 18px;
  padding: 12px 8px; border-bottom: 2px solid #e2e8f0; text-align: left;
}
tbody td { padding: 11px 8px; font-size: 16px; color: #1f2937; border-bottom: 1px solid #f1f5f9; }
tbody tr:nth-child(even) { background: #fafbfc; }
tfoot td {
  position: sticky; bottom: 0; z-index: 2;
  background: #f8fafc; font-weight: 800; padding: 12px 8px;
  border-top: 2px solid #e2e8f0; font-size: 20px; text-align: center; color: #0f172a;
}
tfoot td.foot-label { text-align: left; }

.col-num { text-align: center; }
.col-total { text-align: center; font-weight: 800; }
thead th.col-num, tbody td.col-num, tfoot td.col-num { padding-left: 2px; padding-right: 2px; }

tbody td.col-num { font-size: 20px; font-weight: 800; color: #0f172a; }
tbody td.col-total { font-size: 24px; font-weight: 800; color: #0f172a; }
thead th.col-num, thead th.col-total { font-size: 16px; text-align: center; }
thead th.col-num { font-size: 15px; }
tfoot td.col-num { font-size: 17px; }

/* Sunday / holiday red */
thead th.holiday { color: #dc2626; }
tbody td.holiday, tfoot td.holiday { background: #fef2f2; color: #dc2626; }

/* Today's column blue (wins over holiday) */
thead th.today { background: #dbeafe; color: #1e40af; }
tbody td.today { background: #eff6ff; color: #1e3a8a; }
tfoot td.today { background: #dbeafe; color: #1e3a8a; }

/* Zero dimmed */
tbody td.zero { color: #cbd5e1; font-weight: 700; }
tbody td.zero.holiday { color: #fca5a5; }

/* Highest value per column green (ties highlight all) */
tbody td.is-max { background: #dcfce7; color: #166534; }

/* ---- Weekly (Business) table ---- */
.weekly thead th { white-space: normal; vertical-align: bottom; line-height: 1.25; font-size: 15px; }
.weekly tbody td.col-num { font-size: 20px; }
.weekly tfoot td.col-num { font-size: 18px; }
.weekly td.money { font-variant-numeric: tabular-nums; }
.weekly td.pos { color: #166534; }
.weekly td.neg { color: #dc2626; }
.weekly .empty-row { text-align: center; color: #94a3b8; padding: 28px; font-size: 16px; }

.name-cell { display: flex; align-items: center; }
.avatar {
  width: 42px; height: 42px; border-radius: 50%; margin-right: 12px; flex: 0 0 auto;
  background: #f1f5f9; border: 1px solid #e2e8f0; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; color: #475569; font-size: 16px;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.name-text { min-width: 0; overflow: hidden; }
.name-main { font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; }
.name-sub { font-size: 13px; color: #64748b; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; }

/* Clickable value cells */
.col-num.clickable { cursor: pointer; }
.col-num.clickable:hover { outline: 2px solid #93c5fd; outline-offset: -2px; }

/* Detail modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px;
}
.modal {
  background: #fff; border-radius: 12px; width: min(720px, 96vw); max-height: 85vh;
  display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); overflow: hidden;
}
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; }
.modal-title { font-size: 16px; font-weight: 800; color: #0f172a; }
.modal-close { border: none; background: #f1f5f9; color: #334155; width: 32px; height: 32px; border-radius: 8px; font-size: 16px; cursor: pointer; }
.modal-close:hover { background: #e2e8f0; }
.modal-body { padding: 12px 18px 18px; overflow: auto; }
.modal-state { padding: 24px; text-align: center; color: #64748b; }
.detail-table { width: 100%; border-collapse: collapse; }
.detail-table th { text-align: left; font-size: 13px; font-weight: 800; color: #475569; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
.detail-table td { font-size: 14px; color: #1f2937; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
.detail-table .c-no { width: 44px; color: #94a3b8; }
.detail-table tr:hover td { background: #f8fafc; }
</style>
