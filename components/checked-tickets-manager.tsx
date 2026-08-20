"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, RefreshCw, UserCheck } from "lucide-react"

type Ticket = {
  id: string
  reference: string
  tenant: string
  apartment: string
  amount: number
  currency: string
  checkedAt: string | null
  checkedBy: string
}

// Shows every receipt that reception has checked in (marked as used), including
// WHO (which receptionist) checked it. Used in the admin dashboard.
export function CheckedTicketsManager() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/reception/checked", { cache: "no-store" })
      const data = await res.json()
      setTickets(data.tickets || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Checked-in Tickets ({tickets.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="text-left p-3 font-medium">Reference</th>
                <th className="text-left p-3 font-medium">Tenant</th>
                <th className="text-left p-3 font-medium">Apartment</th>
                <th className="text-left p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Checked by</th>
                <th className="text-left p-3 font-medium">Checked at</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-8">
                    Loading…
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-8">
                    No tickets checked yet.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  >
                    <td className="p-3 font-mono text-xs">{t.reference}</td>
                    <td className="p-3">{t.tenant}</td>
                    <td className="p-3">{t.apartment}</td>
                    <td className="p-3">
                      {t.currency} {Number(t.amount).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                        <UserCheck className="h-4 w-4 text-blue-600" />
                        {t.checkedBy}
                      </span>
                    </td>
                    <td className="p-3">{t.checkedAt ? new Date(t.checkedAt).toLocaleString() : "—"}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        Used
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
