import { NextRequest } from 'next/server'
import { handleInventoryReportRequest } from '@/lib/inventory/reports/handle-report-request'

export async function GET(request: NextRequest) {
  return handleInventoryReportRequest('assignments', request)
}
