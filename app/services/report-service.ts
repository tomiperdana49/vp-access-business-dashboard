import { growthService } from "./growth-service"
import { retentionService } from "./retention-service"
import { serviceQualityService } from "./service-quality-service"
import type { GrowthMrcStats, GrowthRevenueData, GrowthRevenueAchievementStats, GrowthNewCustomerStats, GrowthArpuStats, GrowthTotalMrcYtdStats, GrowthForecastRevenueStats, GrowthLeadsStats, GrowthOpportunityStats, GrowthWinRateStats, GrowthActivityStats, GrowthPipelineStats, GrowthPipelineStageStats, GrowthCycleStats, GrowthDiscountStats, GrowthForecastMrcStats, GrowthAmSnapshotStats } from "../types/growth"
import type { ChurnStats, CustomerLoseStats, WirelessMigrationStats, ChurnRateData, RetentionForecastChurnStats, RetentionForecastNetMrcStats, RetentionNetMrcStats, ContractExpiringStats, TicketStats, UsageStats, PaymentStats } from "../types/retention"

export interface ReportPeriods {
    growthLagging: string
    growthLeading: string
    retentionLagging: string
    retentionLeading: string
    serviceLagging: string
    serviceLeading: string
}

export interface GrowthLaggingReport {
    newMrc: GrowthMrcStats | null
    revenueAchievement: GrowthRevenueAchievementStats | null
    newCustomer: GrowthNewCustomerStats | null
    arpu: GrowthArpuStats | null
    totalMrcYtd: GrowthTotalMrcYtdStats | null
    forecastRevenue: GrowthForecastRevenueStats | null
    revenue: GrowthRevenueData[] | null
}

export interface GrowthLeadingReport {
    leads: GrowthLeadsStats | null
    forecastMrc: GrowthForecastMrcStats | null
    opportunity: GrowthOpportunityStats | null
    winRate: GrowthWinRateStats | null
    activity: GrowthActivityStats | null
    pipelineValue: GrowthPipelineStats | null
    pipelineStage: GrowthPipelineStageStats | null
    cycle: GrowthCycleStats | null
    discount: GrowthDiscountStats | null
    amSnapshot: GrowthAmSnapshotStats | null
}

export interface RetentionLaggingReport {
    netMrc: RetentionNetMrcStats | null
    churn: ChurnStats | null
    customerLose: CustomerLoseStats | null
    wirelessMigration: WirelessMigrationStats | null
    churnRate: ChurnRateData[] | null
    forecastNetMrc: RetentionForecastNetMrcStats | null
    forecastChurn: RetentionForecastChurnStats | null
}

export interface RetentionLeadingReport {
    contractExpiring: ContractExpiringStats | null
    ticket: TicketStats | null
    usage: UsageStats | null
    payment: PaymentStats | null
}

export interface ServiceLaggingReport {
    ticket: TicketStats | null
    complaint: TicketStats | null
    solved: TicketStats | null
    solvedPercentage: TicketStats | null
}

export interface ServiceLeadingReport {
    issue: TicketStats | null
    incident: TicketStats | null
}

export interface ReportData {
    growthLagging: GrowthLaggingReport
    growthLeading: GrowthLeadingReport
    retentionLagging: RetentionLaggingReport
    retentionLeading: RetentionLeadingReport
    serviceLagging: ServiceLaggingReport
    serviceLeading: ServiceLeadingReport
    failedCount: number
}

export class ReportService {

    /**
     * Fetch every dashboard metric for the report in parallel.
     * A failed request leaves its metric as null so the rest of the report can still be built.
     */
    async getReportData(branchId: string, periods: ReportPeriods): Promise<ReportData> {
        let failedCount = 0

        const load = async <T>(request: () => Promise<{ success: boolean, data: T }>): Promise<T | null> => {
            try {
                const res = await request()
                if (res?.success) return res.data
            } catch {
                // handleServiceError already shows a toast
            }
            failedCount++
            return null
        }

        const [growthLagging, growthLeading, retentionLagging, retentionLeading, serviceLagging, serviceLeading] = await Promise.all([
            this.resolve<GrowthLaggingReport>({
                newMrc: load(() => growthService.getNewMrc(branchId, periods.growthLagging)),
                revenueAchievement: load(() => growthService.getRevenueAchievement(branchId, periods.growthLagging)),
                newCustomer: load(() => growthService.getNewCustomer(branchId, periods.growthLagging)),
                arpu: load(() => growthService.getArpu(branchId, periods.growthLagging)),
                totalMrcYtd: load(() => growthService.getTotalMrcYtd(branchId)),
                forecastRevenue: load(() => growthService.getForecastRevenue(periods.growthLagging)),
                revenue: load(() => growthService.getRevenue(branchId))
            }),
            this.resolve<GrowthLeadingReport>({
                leads: load(() => growthService.getLeads(periods.growthLeading)),
                forecastMrc: load(() => growthService.getForecastMrc(periods.growthLeading)),
                opportunity: load(() => growthService.getOpportunity(periods.growthLeading)),
                winRate: load(() => growthService.getWinRate(periods.growthLeading)),
                activity: load(() => growthService.getActivity(periods.growthLeading)),
                pipelineValue: load(() => growthService.getPipelineValue(periods.growthLeading)),
                pipelineStage: load(() => growthService.getPipelineStage(periods.growthLeading)),
                cycle: load(() => growthService.getCycle(periods.growthLeading)),
                discount: load(() => growthService.getDiscount(periods.growthLeading)),
                amSnapshot: load(() => growthService.getAmSnapshot(periods.growthLeading))
            }),
            this.resolve<RetentionLaggingReport>({
                netMrc: load(() => retentionService.getNetMrc(branchId, periods.retentionLagging)),
                churn: load(() => retentionService.getChurnStats(branchId, periods.retentionLagging)),
                customerLose: load(() => retentionService.getCustomerLose(branchId, periods.retentionLagging)),
                wirelessMigration: load(() => retentionService.getWirelessMigration(branchId, periods.retentionLagging)),
                churnRate: load(() => retentionService.getChurnRate(branchId)),
                forecastNetMrc: load(() => retentionService.getForecastNetMrc(periods.retentionLagging)),
                forecastChurn: load(() => retentionService.getForecastChurn(periods.retentionLagging))
            }),
            this.resolve<RetentionLeadingReport>({
                contractExpiring: load(() => retentionService.getContractExpiring(branchId)),
                ticket: load(() => retentionService.getTicket(branchId, periods.retentionLeading)),
                usage: load(() => retentionService.getUsage(branchId, periods.retentionLeading)),
                payment: load(() => retentionService.getPayment(branchId))
            }),
            this.resolve<ServiceLaggingReport>({
                ticket: load(() => serviceQualityService.getTicket(branchId, periods.serviceLagging)),
                complaint: load(() => serviceQualityService.getComplaint(branchId, periods.serviceLagging)),
                solved: load(() => serviceQualityService.getSolved(branchId, periods.serviceLagging)),
                solvedPercentage: load(() => serviceQualityService.getSolvedPercentage(branchId, periods.serviceLagging))
            }),
            this.resolve<ServiceLeadingReport>({
                issue: load(() => serviceQualityService.getIssue(branchId, periods.serviceLeading)),
                incident: load(() => serviceQualityService.getIncident(branchId, periods.serviceLeading))
            })
        ])

        return { growthLagging, growthLeading, retentionLagging, retentionLeading, serviceLagging, serviceLeading, failedCount }
    }

    /**
     * Await an object of promises and return the same keys with their resolved values.
     */
    private async resolve<T extends Record<string, any>>(promises: { [K in keyof T]: Promise<T[K]> }): Promise<T> {
        const keys = Object.keys(promises) as (keyof T)[]
        const values = await Promise.all(keys.map(key => promises[key]))
        return Object.fromEntries(keys.map((key, i) => [key, values[i]])) as T
    }
}

export const reportService = new ReportService()
