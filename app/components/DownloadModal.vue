<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-md', overlay: 'bg-black/40' }">
    <template #content>
      <UCard :ui="{ body: 'flex flex-col gap-4 relative' }">
      
      <!-- Modal Header -->
      <div class="flex items-start justify-between select-none">
        <div class="space-y-1.5 pr-4">
          <h3 class="text-lg font-semibold text-neutral-900 leading-none tracking-tight">
            Download Laporan
          </h3>
          <p class="text-sm text-neutral-500 leading-normal">
            Pilih periode data untuk setiap dashboard yang ingin dimasukkan ke dalam laporan sebelum mengunduh file.
            Cabang: <span class="font-medium text-neutral-700">{{ branchLabel }}</span>
          </p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 p-1 rounded-md shrink-0 cursor-pointer"
          @click="() => { open = false }"
          aria-label="Close"
        />
      </div>

      <!-- Form White Container with Border -->
      <div class="border border-neutral-200 rounded-lg p-4 bg-white shadow-xs space-y-4">
        <template v-for="(section, idx) in sections" :key="section.title">
          <!-- Divider between sections -->
          <div v-if="idx > 0" class="border-t border-neutral-100 my-2"></div>
          
          <div class="space-y-2">
            <h4 class="text-sm font-semibold text-neutral-900 tracking-wide select-none">
              {{ section.title }}
            </h4>
            <div class="space-y-2.5">
              <div v-for="item in section.items" :key="item.label" class="flex items-center justify-between gap-4">
                <span class="text-sm font-medium text-neutral-600">{{ item.label }}</span>
                <USelect
                  v-model="periods[item.key]"
                  :items="timeframeOptions"
                  :disabled="isDownloading"
                  class="w-36 shrink-0"
                />
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Action Button -->
      <UButton
        color="primary"
        size="lg"
        :loading="isDownloading"
        class="w-full justify-center"
        @click="handleDownload"
      >
        {{ isDownloading ? 'Menyiapkan laporan...' : 'Download PDF' }}
      </UButton>
      <p v-if="isDownloading" class="text-xs text-neutral-500 text-center -mt-2">
        Mengambil data semua dashboard, bisa memakan waktu hingga 1 menit.
      </p>

      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { useDashboardFilters } from '~/composables/useDashboardFilters'
import { reportService, type ReportPeriods } from '~/services/report-service'

// Modal open state bound as a model
const open = defineModel<boolean>({ default: false })
const isDownloading = ref(false)

const toast = useToast()
const { state: authState } = useAuth()
const { selectedBranch, branchOptions, timeframeOptions } = useDashboardFilters()

const branchLabel = computed(() => branchOptions.find(b => b.value === selectedBranch.value)?.label ?? selectedBranch.value)

// Period per dashboard section, using the same values as the dashboard timeframe filter
const periods = reactive<ReportPeriods>({
  growthLagging: 'month',
  growthLeading: 'last',
  retentionLagging: 'month',
  retentionLeading: 'last',
  serviceLagging: 'month',
  serviceLeading: 'last'
})

// Group items into data-driven structures to eliminate template duplication
const sections: { title: string, items: { label: string, key: keyof ReportPeriods }[] }[] = [
  {
    title: 'Growth Dashboard',
    items: [
      { label: 'Lagging Indicator', key: 'growthLagging' },
      { label: 'Leading Indicator', key: 'growthLeading' }
    ]
  },
  {
    title: 'Retention Dashboard',
    items: [
      { label: 'Lagging Indicator', key: 'retentionLagging' },
      { label: 'Leading Indicator', key: 'retentionLeading' }
    ]
  },
  {
    title: 'Service and Quality Dashboard',
    items: [
      { label: 'Lagging Indicator', key: 'serviceLagging' },
      { label: 'Leading Indicator', key: 'serviceLeading' }
    ]
  }
]

const periodLabel = (value: string) => timeframeOptions.find(t => t.value === value)?.label ?? value

// Fetch every dashboard metric for the chosen periods and download it as a PDF data report
const handleDownload = async () => {
  isDownloading.value = true
  try {
    const data = await reportService.getReportData(selectedBranch.value, { ...periods })
    const { buildReportPdf } = await import('~/utils/report-pdf')

    const generatedAt = new Date()
    const doc = buildReportPdf(data, {
      branchLabel: branchLabel.value,
      periodLabels: Object.fromEntries(
        (Object.keys(periods) as (keyof ReportPeriods)[]).map(key => [key, periodLabel(periods[key])])
      ) as Record<keyof ReportPeriods, string>,
      userName: authState.user?.name || '-',
      generatedAt
    })

    const date = generatedAt.toISOString().slice(0, 10)
    const branchSlug = branchLabel.value.toLowerCase().replace(/\s+/g, '-')
    doc.save(`laporan-vp-access-business-${branchSlug}-${date}.pdf`)

    toast.add({
      title: 'Laporan berhasil diunduh',
      description: data.failedCount > 0 ? `${data.failedCount} metrik gagal dimuat dan ditandai di laporan.` : undefined,
      icon: 'i-lucide-circle-check',
      color: data.failedCount > 0 ? 'warning' : 'success'
    })
    open.value = false
  } catch (error) {
    console.error('Failed to generate report:', error)
    toast.add({
      title: 'Gagal membuat laporan',
      description: 'Silakan coba lagi.',
      icon: 'i-lucide-circle-x',
      color: 'error'
    })
  } finally {
    isDownloading.value = false
  }
}
</script>
