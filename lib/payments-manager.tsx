"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataTable } from "./data-table"
import { employeeService } from "@/lib/employee-service"
import { Search, Filter, Download, Eye } from "lucide-react"

export function PaymentsManager() {
  const [payments, setPayments] = useState<any[]>([])
  const [filteredPayments, setFilteredPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)

  // Summary stats
  const [stats, setStats] = useState({
    total_payments: 0,
    total_amount: 0,
    pending_amount: 0,
    verified_amount: 0,
  })

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const data = await employeeService.getPayments()
      setPayments(data)
      calculateStats(data)
      filterPayments(data, searchTerm, statusFilter, methodFilter)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [])

  useEffect(() => {
    filterPayments(payments, searchTerm, statusFilter, methodFilter)
  }, [searchTerm, statusFilter, methodFilter, payments])

  const calculateStats = (data: any[]) => {
    const total = data.length
    const totalAmount = data.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
    const pendingAmount = data
      .filter((p) => p.payment_status === "pending")
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
    const verifiedAmount = data
      .filter((p) => p.payment_status === "verified")
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

    setStats({
      total_payments: total,
      total_amount: totalAmount,
      pending_amount: pendingAmount,
      verified_amount: verifiedAmount,
    })
  }

  const filterPayments = (data: any[], search: string, status: string, method: string) => {
    let filtered = data

    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.email?.toLowerCase().includes(search.toLowerCase()) ||
          p.phone_number?.includes(search) ||
          p.transaction_id?.includes(search),
      )
    }

    if (status !== "all") {
      filtered = filtered.filter((p) => p.payment_status === status)
    }

    if (method !== "all") {
      filtered = filtered.filter((p) => p.payment_method === method)
    }

    setFilteredPayments(filtered)
  }

  const handleVerifyPayment = async (id: number) => {
    try {
      await employeeService.updatePaymentStatus(id, "verified")
      alert("Payment verified!")
      await fetchPayments()
    } catch (err: any) {
      alert("Error: " + err.message)
    }
  }

  const handleRejectPayment = async (id: number) => {
    try {
      await employeeService.updatePaymentStatus(id, "rejected")
      alert("Payment rejected!")
      await fetchPayments()
    } catch (err: any) {
      alert("Error: " + err.message)
    }
  }

  const handleViewDetails = (payment: any) => {
    setSelectedPayment(payment)
    setShowDetails(true)
  }

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Email", "Phone", "Amount", "Method", "Status", "Transaction ID", "Date"]
    const rows = filteredPayments.map((p) => [
      p.id,
      p.full_name,
      p.email,
      p.phone_number,
      p.amount,
      p.payment_method,
      p.payment_status,
      p.transaction_id,
      new Date(p.created_at).toLocaleDateString(),
    ])

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payments-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const getPaymentMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      mtn_momo: "bg-yellow-100 text-yellow-800",
      airtel_money: "bg-red-100 text-red-800",
      credit_card: "bg-purple-100 text-purple-800",
      paypal: "bg-blue-100 text-blue-800",
    }
    return colors[method] || "bg-gray-100 text-gray-800"
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      mtn_momo: "MTN MoMo",
      airtel_money: "Airtel Money",
      credit_card: "Credit Card",
      paypal: "PayPal",
    }
    return labels[method] || method
  }

  const getStatusColor = (status: string) => {
    return status === "verified"
      ? "bg-green-100 text-green-800"
      : status === "rejected"
      ? "bg-red-100 text-red-800"
      : "bg-yellow-100 text-yellow-800"
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total_payments}</div>
              <div className="text-sm text-gray-600">Total Payments</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">${stats.total_amount.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Total Amount</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">${stats.pending_amount.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">${stats.verified_amount.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Verified</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, phone, or transaction ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="all">All Methods</option>
                  <option value="mtn_momo">MTN MoMo</option>
                  <option value="airtel_money">Airtel Money</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="w-full"
                  disabled={filteredPayments.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Records ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500 mb-4">{error}</p>}

          {loading ? (
            <p className="text-center text-gray-500 py-8">Loading payments...</p>
          ) : filteredPayments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No payments found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.full_name}</TableCell>
                      <TableCell className="text-sm">{payment.email}</TableCell>
                      <TableCell className="text-sm">{payment.phone_number}</TableCell>
                      <TableCell className="font-semibold">${parseFloat(payment.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentMethodColor(payment.payment_method)}`}>
                          {getPaymentMethodLabel(payment.payment_method)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.payment_status)}`}>
                          {payment.payment_status.charAt(0).toUpperCase() + payment.payment_status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(payment)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {payment.payment_status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleVerifyPayment(payment.id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectPayment(payment.id)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Modal */}
      {showDetails && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Payment Details</span>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="font-semibold">{selectedPayment.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold text-sm">{selectedPayment.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-semibold">{selectedPayment.phone_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="font-semibold text-lg text-green-600">${parseFloat(selectedPayment.amount).toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="font-semibold">{getPaymentMethodLabel(selectedPayment.payment_method)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${getStatusColor(selectedPayment.payment_status)}`}
                  >
                    {selectedPayment.payment_status.charAt(0).toUpperCase() + selectedPayment.payment_status.slice(1)}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Transaction ID</p>
                <p className="font-mono font-semibold text-sm break-all">{selectedPayment.transaction_id || "N/A"}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-semibold">
                  {new Date(selectedPayment.created_at).toLocaleString()}
                </p>
              </div>

              <div className="pt-4 border-t flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDetails(false)}
                >
                  Close
                </Button>
                {selectedPayment.payment_status === "pending" && (
                  <>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        handleVerifyPayment(selectedPayment.id)
                        setShowDetails(false)
                      }}
                    >
                      Verify
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        handleRejectPayment(selectedPayment.id)
                        setShowDetails(false)
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}