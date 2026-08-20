"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dataClient } from "@/lib/data-client";
import { formatDate } from "@/lib/utils";
import { ManagerChat } from "@/components/ManagerChat";
import { BookedApartmentsTable } from "@/components/booked-apartments-table";
import { ApartmentsManager } from "@/components/apartments-manager";
import { TicketScanner } from "@/components/ticket-scanner";
import { AttendanceManager } from "@/components/attendance-manager";
import { AttendanceReport } from "@/components/attendance-report";
import { RefundRequestsManager } from "@/components/refund-requests-manager";
import { OutstandingPaymentsManager } from "@/components/outstanding-payments-manager";
import { EmployeeScheduleManager } from "@/components/employee-schedule-manager";
import { SessionGuard, logout } from "@/components/auth/session-guard";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { useLanguage } from "@/lib/language-context";
import { translateLabels } from "@/lib/translate-client";
import { withRetry } from "@/lib/retry";
import { DashboardShell, type NavGroup } from "@/components/dashboard/DashboardShell";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";
import {
  Building,
  Users,
  Calendar,
  MessageSquare,
  MessageSquareText,
  LogOut,
  Key,
  Home,
  FileText,
  BarChart3,
  AlertCircle,
  CheckCircle,
  CreditCard,
  Trash2,
  Ban,
  ScanLine,
  ClipboardCheck,
  LayoutDashboard,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";

interface Manager {
  id: number;
  username: string;
  full_name: string;
  email: string;
  department: string;
  [key: string]: any;
}

interface Apartment {
  id: number;
  name: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  price_per_month: number;
  is_available: boolean;
  [key: string]: any;
}

interface Tenant {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  approval_status: string;
  is_active: boolean;
  [key: string]: any;
}

interface Booking {
  id: number;
  client_name: string;
  email: string;
  start_date: string;
  end_date: string;
  status: string;
  [key: string]: any;
}

export default function ManagerDashboard() {
  const router = useRouter();
  const { language } = useLanguage();
  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [revByMonth, setRevByMonth] = useState<{ label: string; value: number }[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [cancelledPayments, setCancelledPayments] = useState<any[]>([]);
  const [active, setActive] = useState("overview");

  // Occupancy is DERIVED from the live apartment list (single source of truth) so
  // the cards can never drift out of sync. When a booking marks an apartment
  // occupied — or a refund frees one — these update on the next refetch.
  const availableCount = apartments.filter((a) => a.is_available).length;
  const occupiedCount = apartments.length - availableCount;
  const activeTenants = tenants.filter((t) => t.is_active).length;

  const supabase = dataClient();

  useEffect(() => {
    const managerData = localStorage.getItem("manager_session");
    if (!managerData) {
      router.push("/login");
      return;
    }
    try {
      setManager(JSON.parse(managerData));
    } catch (err) {
      console.error("Error parsing manager session:", err);
      router.push("/login");
    }
    setLoading(false);
  }, [router]);

  // Fetch apartments + revenue, and keep them fresh. Bookings/refunds that change
  // occupancy happen elsewhere, so we refetch when the tab regains focus and on a
  // 30s interval — the occupancy/revenue cards then stay accurate without a reload.
  useEffect(() => {
    if (!manager) return;

    const fetchApartments = async () => {
      try {
        const { data, error } = await withRetry(() =>
          supabase.from("apartments").select("*").order("created_at", { ascending: false })
        );

        if (error) throw error;
        setApartments(data || []);
      } catch (err: any) {
        // Aborted requests (dev hot-reload remount, tab navigation) carry no
        // enumerable fields and used to log as a bare "{}", which is impossible
        // to tell apart from a real database failure. Print something readable.
        const reason = err?.message || err?.code || err?.name;
        if (!reason) return; // aborted mid-flight — not an error worth reporting
        console.error("Error fetching apartments:", reason, err);
      }
    };

    const fetchRevenue = async () => {
      try {
        const { data, error } = await withRetry(() =>
          supabase
            .from("tenant_payments")
            .select("amount, status, payment_date, created_at")
            .eq("status", "completed")
        );
        if (error) throw error;
        const payments = data || [];
        const total = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setRevenue(total);

        // Bucket the last 6 months for the overview chart
        const now = new Date();
        const months: { key: string; label: string; value: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en", { month: "short" }), value: 0 });
        }
        payments.forEach((p: any) => {
          const d = new Date(p.payment_date || p.created_at || Date.now());
          const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
          if (m) m.value += Number(p.amount) || 0;
        });
        setRevByMonth(months.map(({ label, value }) => ({ label, value })));
      } catch (err: any) {
        // Same treatment as the siblings above: ignore aborted requests, and
        // print a readable reason for anything that is genuinely wrong.
        const reason = err?.message || err?.code || err?.name;
        if (!reason) return;
        console.error("Error fetching revenue:", reason, err);
      }
    };

    // Pending payments the tenants cancelled themselves — shown under
    // Finance → Cancelled Payments so the manager keeps full visibility.
    const fetchCancelledPayments = async () => {
      try {
        const { data, error } = await withRetry(() =>
          supabase
            .from("tenant_payments")
            .select("id, amount, due_date, updated_at, created_at, tenants(full_name, email), apartments(name)")
            .eq("status", "cancelled")
            .order("updated_at", { ascending: false })
        );
        if (error) throw error;
        setCancelledPayments(data || []);
      } catch (err: any) {
        // Aborted requests (dev hot-reload, navigation) have no enumerable
        // fields and used to log as a bare "{}". Stay quiet for those.
        const reason = err?.message || err?.code || err?.name;
        if (!reason) return;
        console.error("Error fetching cancelled payments:", reason, err);
      }
    };

    const refresh = () => {
      fetchApartments();
      fetchRevenue();
      fetchCancelledPayments();
    };

    refresh();

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const interval = setInterval(refresh, 30000);

    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [manager]);

  // Fetch tenants
  useEffect(() => {
    if (!manager) return;

    const fetchTenants = async () => {
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .eq("approval_status", "approved")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTenants(data || []);
      } catch (err) {
        console.error("Error fetching tenants:", err);
      }
    };

    fetchTenants();
  }, [manager]);

  // Fetch bookings
  useEffect(() => {
    if (!manager) return;

    const fetchBookings = async () => {
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setBookings(data || []);
      } catch (err) {
        console.error("Error fetching bookings:", err);
      }
    };

    fetchBookings();
  }, [manager]);

  // Fetch messages
  useEffect(() => {
    if (!manager) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("client_feedback")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [manager]);

  // Tickets checked by reception (count + who checked)
  const [checkedTickets, setCheckedTickets] = useState<any[]>([]);
  const fetchCheckedTickets = async () => {
    try {
      const res = await fetch("/api/reception/checked", { cache: "no-store" });
      const data = await res.json();
      setCheckedTickets(data.tickets || []);
    } catch (err) {
      console.error("Error fetching checked tickets:", err);
    }
  };
  useEffect(() => {
    if (!manager) return;
    fetchCheckedTickets();
  }, [manager]);

  // Generate a printable report of all tickets reception has checked in.
  const [generatingTickets, setGeneratingTickets] = useState(false);
  const handleGenerateCheckedReport = async () => {
    // Open the window synchronously (inside the click) so the pop-up blocker allows it.
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      alert("Please allow pop-ups for this site, then click Generate again.");
      return;
    }
    win.document.write(
      `<!DOCTYPE html><html><head><title>Generating…</title></head>` +
        `<body style="font-family:Arial;padding:40px;text-align:center;color:#475569">` +
        `<h2>Generating report…</h2></body></html>`
    );

    setGeneratingTickets(true);
    try {
      const money = (n: number, c: string) => `${c || "RWF"} ${Number(n || 0).toLocaleString()}`;
      const esc = (v: any) =>
        String(v ?? "—").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));

      const now = new Date();
      const reportDate = now.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

      const total = checkedTickets.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const currency = checkedTickets[0]?.currency || "RWF";

      // Translate all labels into the selected language (English = unchanged)
      const T = await translateLabels(
        {
          title: "Cielo Vista — Checked Tickets Report",
          generatedBy: "Generated by",
          ticketsChecked: "Tickets Checked",
          totalValue: "Total Value",
          reference: "Reference",
          tenant: "Tenant",
          apartment: "Apartment",
          amount: "Amount",
          checkedBy: "Checked by",
          checkedAt: "Checked at",
          noTickets: "No tickets checked yet",
          footer: "Cielo Vista, Kigali, Rwanda · This report was generated automatically.",
          printSave: "Print / Save as PDF",
          download: "Download Report",
        },
        language
      );
      const dir = language === "ar" ? "rtl" : "ltr";

      const rows = checkedTickets.length
        ? checkedTickets
            .map(
              (t: any) => `
          <tr>
            <td>${esc(t.reference)}</td>
            <td>${esc(t.tenant)}</td>
            <td>${esc(t.apartment)}</td>
            <td>${money(t.amount, t.currency)}</td>
            <td>${esc(t.checkedBy)}</td>
            <td>${t.checkedAt ? new Date(t.checkedAt).toLocaleString() : "—"}</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="6" style="text-align:center;color:#888">${esc(T.noTickets)}</td></tr>`;

      const html = `
      <!DOCTYPE html><html lang="${language}" dir="${dir}"><head><title>${esc(T.title)}</title>
      <style>
        * { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; box-sizing: border-box; }
        body { margin: 0; background: #3f3f3f; color: #171717; }
        .paper { max-width: 860px; margin: 24px auto; background: #fff; padding: 44px 48px; }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand .dot { width: 34px; height: 34px; border-radius: 50%; background: #171717; display: flex; align-items: center; justify-content: center; }
        .brand .dot span { width: 12px; height: 12px; border: 3px solid #fff; border-radius: 50%; display: block; }
        .brand p { margin: 0; }
        .brand .name { font-size: 15px; font-weight: bold; }
        .brand .tag { font-size: 11px; color: #8a8a8a; }
        h1 { margin: 26px 0 2px; font-size: 40px; letter-spacing: -1px; font-weight: 800; }
        .sub { color: #9a9a9a; font-size: 12px; }
        .meta { background: #f2f2f2; margin-top: 18px; padding: 14px 18px; display: flex; flex-wrap: wrap; gap: 24px; font-size: 12px; }
        .meta div { flex: 1; min-width: 140px; text-align: center; }
        .meta .l { color: #8a8a8a; }
        .meta .v { font-weight: bold; margin-top: 3px; }
        .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
        .card { flex: 1; min-width: 150px; border: 1px solid #e5e5e5; padding: 14px 16px; }
        .card .label { font-size: 11px; color: #8a8a8a; text-transform: uppercase; letter-spacing: 0.5px; }
        .card .value { font-size: 20px; font-weight: 800; margin-top: 4px; color: #171717; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
        th { background: #171717; color: #fff; font-weight: 600; padding: 11px 12px; text-align: ${dir === "rtl" ? "right" : "left"}; }
        td { padding: 10px 12px; border-bottom: 1px solid #ededed; text-align: ${dir === "rtl" ? "right" : "left"}; }
        .footer { margin-top: 44px; border-top: 1px solid #e5e5e5; padding-top: 16px; display: flex; justify-content: space-between; gap: 16px; color: #9a9a9a; font-size: 11px; }
        .footer .right { text-align: ${dir === "rtl" ? "left" : "right"}; color: #555; }
        @media print { body { background: #fff; } .paper { margin: 0; padding: 24px; max-width: none; } .noprint { display: none; } }
        @media (max-width: 640px) { .paper { padding: 24px 18px; margin: 12px; } h1 { font-size: 30px; } }
      </style></head><body>
        <div class="paper">
          <div class="brand">
            <div class="dot"><span></span></div>
            <div>
              <p class="name">Cielo Vista Apartments</p>
              <p class="tag">Premium Residences — Kigali, Rwanda</p>
            </div>
          </div>

          <h1>REPORT</h1>
          <div class="sub">${esc(T.title)}</div>

          <div class="meta">
            <div><div class="l">${esc(T.generatedBy)}</div><div class="v">${esc(manager?.full_name)}</div></div>
            <div><div class="l">${esc(T.checkedAt)}</div><div class="v">${esc(reportDate)}</div></div>
            <div><div class="l">${esc(T.ticketsChecked)}</div><div class="v">${checkedTickets.length}</div></div>
          </div>

          <div class="cards">
            <div class="card"><div class="label">${esc(T.ticketsChecked)}</div><div class="value">${checkedTickets.length}</div></div>
            <div class="card"><div class="label">${esc(T.totalValue)}</div><div class="value">${money(total, currency)}</div></div>
          </div>

          <table>
            <thead><tr><th>${esc(T.reference)}</th><th>${esc(T.tenant)}</th><th>${esc(T.apartment)}</th><th>${esc(T.amount)}</th><th>${esc(T.checkedBy)}</th><th>${esc(T.checkedAt)}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="footer">
            <div>${esc(T.footer)}</div>
            <div class="right">support@cielovista.rw<br/>Kigali, Rwanda</div>
          </div>
          <div class="noprint" style="text-align:center;margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button onclick="window.print()" style="padding:12px 30px;font-size:13px;font-weight:600;background:#171717;color:#fff;border:none;cursor:pointer">${esc(T.printSave)}</button>
            <button onclick="downloadReport()" style="padding:12px 30px;font-size:13px;font-weight:600;background:#fff;color:#171717;border:2px solid #171717;cursor:pointer">${esc(T.download)}</button>
          </div>
          <script>
            function downloadReport() {
              var html = "<!DOCTYPE html>" + document.documentElement.outerHTML;
              var blob = new Blob([html], { type: "text/html" });
              var a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + new Date().toISOString().slice(0, 10) + ".html";
              a.click();
            }
          </script>
        </div>
      </body></html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err: any) {
      try {
        win.document.open();
        win.document.write(
          `<body style="font-family:Arial;padding:40px;color:#b91c1c">` +
            `<h2>Failed to generate report</h2><p>${(err?.message || "Unknown error").toString().replace(/[<>&]/g, "")}</p></body>`
        );
        win.document.close();
      } catch {
        /* window may have been closed */
      }
    } finally {
      setGeneratingTickets(false);
    }
  };

  const handleLogout = () => {
    void logout("/login");
  };

  const [pwOpen, setPwOpen] = useState(false);
  const handleChangePassword = () => setPwOpen(true);

  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"day" | "week" | "year" | "all">("all");

  // Start of the chosen reporting period (null = all time)
  const periodStart = (period: string): Date | null => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === "day") return d;
    if (period === "week") {
      d.setDate(d.getDate() - 6); // today + previous 6 days = last 7 days
      return d;
    }
    if (period === "year") {
      return new Date(new Date().getFullYear(), 0, 1);
    }
    return null; // all time
  };

  const periodLabel = (period: string) =>
    period === "day" ? "Today" : period === "week" ? "This Week (last 7 days)" : period === "year" ? "This Year" : "All Time";

  const handleGenerateReport = async () => {
    if (!manager) return;

    // Open the window SYNCHRONOUSLY (inside the click) so the pop-up blocker allows it.
    // If we open it after the await below, browsers block it and nothing appears.
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      alert("Please allow pop-ups for this site, then click Generate Report again.");
      return;
    }
    win.document.write(
      `<!DOCTYPE html><html><head><title>Generating report…</title></head>` +
        `<body style="font-family:Arial;padding:40px;text-align:center;color:#475569">` +
        `<h2>Generating report…</h2><p>Please wait.</p></body></html>`
    );

    setGeneratingReport(true);
    try {
      // Pull all payments so we can report collected revenue + outstanding amounts
      const { data: allPayments } = await supabase
        .from("tenant_payments")
        .select("*, tenants(full_name, email), apartments(name)")
        .order("created_at", { ascending: false });

      // Keep only payments that fall within the chosen period (Daily / Weekly / Yearly / All).
      // Use the paid date for completed payments, else the created date.
      const start = periodStart(reportPeriod);
      const inPeriod = (p: any) => {
        if (!start) return true;
        const ref = p.updated_at || p.payment_date || p.created_at;
        if (!ref) return true;
        return new Date(ref) >= start;
      };

      const payments = (allPayments || []).filter(inPeriod);
      const completed = payments.filter((p: any) => p.status === "completed");
      const outstanding = payments.filter((p: any) => p.status === "pending" || p.status === "processing");

      const totalCollected = completed.reduce((s: any, p: any) => s + (Number(p.amount) || 0), 0);
      const totalOutstanding = outstanding.reduce((s: any, p: any) => s + (Number(p.amount) || 0), 0);

      const money = (n: number) => "RWF " + Number(n || 0).toLocaleString();
      const esc = (v: any) =>
        String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

      const now = new Date();
      const reportDate = now.toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      });

      // Translate every label into the selected language (English = unchanged)
      const T = await translateLabels(
        {
          title: "Cielo Vista — Manager Report",
          period: "Period",
          generatedBy: "Generated by",
          periodValue: periodLabel(reportPeriod),
          overview: "Overview",
          totalApartments: "Total Apartments",
          available: "Available",
          occupied: "Occupied",
          activeTenants: "Active Tenants",
          totalCollected: "Total Collected",
          outstandingPending: "Outstanding (Pending)",
          completedPayments: "Completed Payments",
          outstandingCount: "Outstanding Count",
          apartmentsHeading: "Apartments",
          name: "Name",
          type: "Type",
          pricePerMonth: "Price / Month",
          status: "Status",
          noApartments: "No apartments",
          outstandingPayments: "Outstanding Payments",
          tenant: "Tenant",
          apartment: "Apartment",
          amount: "Amount",
          reference: "Reference",
          noOutstanding: "No outstanding payments",
          startedUnpaid: "Started (unpaid)",
          pending: "Pending",
          date: "Date",
          noCompleted: "No completed payments yet",
          footer: "Cielo Vista, Kigali, Rwanda · This report was generated automatically.",
          printSave: "Print / Save as PDF",
          download: "Download Report",
        },
        language
      );
      const dir = language === "ar" ? "rtl" : "ltr";

      const apartmentRows = apartments
        .map(
          (a: any) => `
          <tr>
            <td>${esc(a.name)}</td>
            <td>${esc(a.type)}</td>
            <td>${money(a.price_per_month)}</td>
            <td>${a.is_available ? `<span class="ok">${esc(T.available)}</span>` : `<span class="warn">${esc(T.occupied)}</span>`}</td>
          </tr>`
        )
        .join("");

      const outstandingRows = outstanding.length
        ? outstanding
            .map(
              (p: any) => `
          <tr>
            <td>${esc(p.tenants?.full_name || "Tenant #" + p.tenant_id)}</td>
            <td>${esc(p.apartments?.name || "Apartment #" + p.apartment_id)}</td>
            <td>${money(p.amount)}</td>
            <td>${esc(p.status === "processing" ? T.startedUnpaid : T.pending)}</td>
            <td>${esc(p.reference_number)}</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="5" style="text-align:center;color:#888">${esc(T.noOutstanding)}</td></tr>`;

      const completedRows = completed.length
        ? completed
            .map(
              (p: any) => `
          <tr>
            <td>${esc(p.tenants?.full_name || "Tenant #" + p.tenant_id)}</td>
            <td>${esc(p.apartments?.name || "Apartment #" + p.apartment_id)}</td>
            <td>${money(p.amount)}</td>
            <td>${esc(p.reference_number)}</td>
            <td>${p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="5" style="text-align:center;color:#888">${esc(T.noCompleted)}</td></tr>`;

      const html = `
      <!DOCTYPE html><html lang="${language}" dir="${dir}"><head><title>${esc(T.title)}</title>
      <style>
        * { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; box-sizing: border-box; }
        body { margin: 0; background: #3f3f3f; color: #171717; }
        .paper { max-width: 860px; margin: 24px auto; background: #fff; padding: 44px 48px; }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand .dot { width: 34px; height: 34px; border-radius: 50%; background: #171717; display: flex; align-items: center; justify-content: center; }
        .brand .dot span { width: 12px; height: 12px; border: 3px solid #fff; border-radius: 50%; display: block; }
        .brand p { margin: 0; }
        .brand .name { font-size: 15px; font-weight: bold; }
        .brand .tag { font-size: 11px; color: #8a8a8a; }
        h1 { margin: 26px 0 2px; font-size: 40px; letter-spacing: -1px; font-weight: 800; }
        .sub { color: #9a9a9a; font-size: 12px; }
        .meta { background: #f2f2f2; margin-top: 18px; padding: 14px 18px; display: flex; flex-wrap: wrap; gap: 24px; font-size: 12px; }
        .meta div { flex: 1; min-width: 140px; text-align: center; }
        .meta .l { color: #8a8a8a; }
        .meta .v { font-weight: bold; margin-top: 3px; }
        h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #171717; padding-bottom: 7px; margin: 34px 0 0; }
        .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
        .card { flex: 1; min-width: 150px; border: 1px solid #e5e5e5; padding: 14px 16px; }
        .card .label { font-size: 11px; color: #8a8a8a; text-transform: uppercase; letter-spacing: 0.5px; }
        .card .value { font-size: 20px; font-weight: 800; margin-top: 4px; color: #171717; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
        th { background: #171717; color: #fff; font-weight: 600; padding: 11px 12px; text-align: ${dir === "rtl" ? "right" : "left"}; }
        td { padding: 10px 12px; border-bottom: 1px solid #ededed; text-align: ${dir === "rtl" ? "right" : "left"}; }
        .ok { display: inline-block; border: 1px solid #171717; color: #171717; padding: 2px 10px; font-size: 11px; font-weight: 600; }
        .warn { display: inline-block; background: #171717; color: #fff; padding: 3px 11px; font-size: 11px; font-weight: 600; }
        .footer { margin-top: 44px; border-top: 1px solid #e5e5e5; padding-top: 16px; display: flex; justify-content: space-between; gap: 16px; color: #9a9a9a; font-size: 11px; }
        .footer .right { text-align: ${dir === "rtl" ? "left" : "right"}; color: #555; }
        @media print { body { background: #fff; } .paper { margin: 0; padding: 24px; max-width: none; } .noprint { display: none; } }
        @media (max-width: 640px) { .paper { padding: 24px 18px; margin: 12px; } h1 { font-size: 30px; } }
      </style></head><body>
        <div class="paper">
          <div class="brand">
            <div class="dot"><span></span></div>
            <div>
              <p class="name">Cielo Vista Apartments</p>
              <p class="tag">Premium Residences — Kigali, Rwanda</p>
            </div>
          </div>

          <h1>REPORT</h1>
          <div class="sub">${esc(T.title)}</div>

          <div class="meta">
            <div><div class="l">${esc(T.period)}</div><div class="v">${esc(T.periodValue)}</div></div>
            <div><div class="l">${esc(T.generatedBy)}</div><div class="v">${esc(manager.full_name)}</div></div>
            <div><div class="l">${esc(T.date)}</div><div class="v">${esc(reportDate)}</div></div>
          </div>

          <h2>${esc(T.overview)}</h2>
          <div class="cards">
            <div class="card"><div class="label">${esc(T.totalApartments)}</div><div class="value">${apartments.length}</div></div>
            <div class="card"><div class="label">${esc(T.available)}</div><div class="value">${availableCount}</div></div>
            <div class="card"><div class="label">${esc(T.occupied)}</div><div class="value">${occupiedCount}</div></div>
            <div class="card"><div class="label">${esc(T.activeTenants)}</div><div class="value">${tenants.filter((t: any) => t.is_active).length}</div></div>
          </div>
          <div class="cards">
            <div class="card"><div class="label">${esc(T.totalCollected)}</div><div class="value">${money(totalCollected)}</div></div>
            <div class="card"><div class="label">${esc(T.outstandingPending)}</div><div class="value">${money(totalOutstanding)}</div></div>
            <div class="card"><div class="label">${esc(T.completedPayments)}</div><div class="value">${completed.length}</div></div>
            <div class="card"><div class="label">${esc(T.outstandingCount)}</div><div class="value">${outstanding.length}</div></div>
          </div>

          <h2>${esc(T.apartmentsHeading)} (${apartments.length})</h2>
          <table>
            <thead><tr><th>${esc(T.name)}</th><th>${esc(T.type)}</th><th>${esc(T.pricePerMonth)}</th><th>${esc(T.status)}</th></tr></thead>
            <tbody>${apartmentRows || `<tr><td colspan="4" style="text-align:center;color:#888">${esc(T.noApartments)}</td></tr>`}</tbody>
          </table>

          <h2>${esc(T.outstandingPayments)} (${outstanding.length}) — ${money(totalOutstanding)}</h2>
          <table>
            <thead><tr><th>${esc(T.tenant)}</th><th>${esc(T.apartment)}</th><th>${esc(T.amount)}</th><th>${esc(T.status)}</th><th>${esc(T.reference)}</th></tr></thead>
            <tbody>${outstandingRows}</tbody>
          </table>

          <h2>${esc(T.completedPayments)} (${completed.length}) — ${money(totalCollected)}</h2>
          <table>
            <thead><tr><th>${esc(T.tenant)}</th><th>${esc(T.apartment)}</th><th>${esc(T.amount)}</th><th>${esc(T.reference)}</th><th>${esc(T.date)}</th></tr></thead>
            <tbody>${completedRows}</tbody>
          </table>

          <div class="footer">
            <div>${esc(T.footer)}</div>
            <div class="right">support@cielovista.rw<br/>Kigali, Rwanda</div>
          </div>
          <div class="noprint" style="text-align:center;margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button onclick="window.print()" style="padding:12px 30px;font-size:13px;font-weight:600;background:#171717;color:#fff;border:none;cursor:pointer">${esc(T.printSave)}</button>
            <button onclick="downloadReport()" style="padding:12px 30px;font-size:13px;font-weight:600;background:#fff;color:#171717;border:2px solid #171717;cursor:pointer">${esc(T.download)}</button>
          </div>
          <script>
            function downloadReport() {
              var html = "<!DOCTYPE html>" + document.documentElement.outerHTML;
              var blob = new Blob([html], { type: "text/html" });
              var a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + new Date().toISOString().slice(0, 10) + ".html";
              a.click();
            }
          </script>
        </div>
      </body></html>`;

      // Replace the loading placeholder with the finished report
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err: any) {
      console.error("Failed to generate report:", err);
      try {
        win.document.open();
        win.document.write(
          `<body style="font-family:Arial;padding:40px;color:#b91c1c">` +
            `<h2>Failed to generate report</h2><p>${(err?.message || "Unknown error")
              .toString()
              .replace(/[<>&]/g, "")}</p></body>`
        );
        win.document.close();
      } catch {
        /* window may have been closed */
      }
      alert("Failed to generate report: " + (err?.message || "Unknown error"));
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!manager) return null;

  const NAV: NavGroup[] = [
    { group: "Main", items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }] },
    { group: "Properties", items: [{ id: "apartments", label: "Apartments", icon: Building }] },
    { group: "People", items: [{ id: "tenants", label: "Tenants", icon: Users }] },
    {
      group: "Bookings",
      items: [
        { id: "bookings", label: "Bookings", icon: Calendar },
        { id: "tickets", label: "Tickets Checked", icon: CheckCircle },
      ],
    },
    {
      group: "Finance",
      items: [
        { id: "outstanding", label: "Outstanding Payments", icon: Wallet },
        { id: "refunds", label: "Refunds", icon: CreditCard },
        { id: "cancelled", label: "Cancelled Payments", icon: Ban },
      ],
    },
    {
      group: "Operations",
      items: [
        { id: "schedule", label: "Work Schedule", icon: Calendar },
        { id: "attendance", label: "Attendance", icon: ClipboardCheck },
        { id: "attendance-report", label: "Attendance Report", icon: BarChart3 },
        { id: "scan", label: "Scan Ticket", icon: ScanLine },
        { id: "messages", label: "Messages", icon: MessageSquare },
        { id: "chat", label: "Team Chat", icon: MessageSquareText },
      ],
    },
  ];

  const PIE_COLORS = ["#2563eb", "#f97316"];
  // `nav` jumps to a section; `scrollTo` scrolls to a panel already on this page.
  // Revenue has no section of its own — its detail is the chart right below, so
  // it scrolls there instead of dumping the manager on an unrelated page.
  const cards: {
    label: string;
    value: string | number;
    icon: any;
    tint: string;
    nav?: string;
    scrollTo?: string;
  }[] = [
    { label: "Total Apartments", value: apartments.length, icon: Building, tint: "bg-blue-50 text-blue-600", nav: "apartments" },
    { label: "Available", value: availableCount, icon: CheckCircle, tint: "bg-green-50 text-green-600", nav: "apartments" },
    { label: "Occupied", value: occupiedCount, icon: Home, tint: "bg-orange-50 text-orange-600", nav: "apartments" },
    { label: "Active Tenants", value: activeTenants, icon: Users, tint: "bg-purple-50 text-purple-600", nav: "tenants" },
    { label: "Revenue", value: `RWF ${revenue.toLocaleString()}`, icon: CreditCard, tint: "bg-emerald-50 text-emerald-600", scrollTo: "revenue-chart" },
  ];
  const pieData = [
    { name: "Available", value: availableCount },
    { name: "Occupied", value: occupiedCount },
  ];

  return (
    <DashboardShell
      brandTitle="Cielo Vista"
      brandSubtitle="Manager Portal"
      breadcrumb="Manager"
      nav={NAV}
      active={active}
      onNavigate={setActive}
      user={{ name: manager.full_name, role: "Manager" }}
      actions={
        <>
          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value as "day" | "week" | "year" | "all")}
            className="hidden md:block h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            title="Report period"
          >
            <option value="day">Daily (Today)</option>
            <option value="week">Weekly (Last 7 days)</option>
            <option value="year">Yearly</option>
            <option value="all">All Time</option>
          </select>
          <Button size="sm" onClick={handleGenerateReport} disabled={generatingReport} className="hidden sm:flex gap-2 bg-blue-600 hover:bg-blue-700">
            <FileText className="h-4 w-4" />
            {generatingReport ? "Generating…" : "Report"}
          </Button>
        </>
      }
      menuItems={[
        { label: "Generate Report", icon: FileText, onClick: handleGenerateReport, hideOnDesktop: true },
        { label: "Change Password", icon: Key, onClick: handleChangePassword },
        { label: "Logout", icon: LogOut, onClick: handleLogout, danger: true },
      ]}
    >
      {/* Kicks back to login if the session is gone — also after bfcache restore */}
      <SessionGuard sessionKey="manager_session" />
      {/* Overview */}
      {active === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map((c) => (
              <StatCard
                key={c.label}
                label={c.label}
                value={c.value}
                icon={c.icon}
                tint={c.tint}
                onClick={
                  c.nav
                    ? () => setActive(c.nav!)
                    : c.scrollTo
                      ? () =>
                          document
                            .getElementById(c.scrollTo!)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" })
                      : undefined
                }
              />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card id="revenue-chart" className="lg:col-span-2 border-slate-200 dark:border-slate-800 rounded-2xl scroll-mt-24">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" /> Revenue — last 6 months
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revByMonth} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={70}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)} />
                      <RTooltip formatter={(v: any) => [`RWF ${Number(v).toLocaleString()}`, "Revenue"]} />
                      <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-800 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-4 w-4 text-blue-600" /> Occupancy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex flex-col">
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-600" /> Available ({availableCount})</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-500" /> Occupied ({occupiedCount})</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Apartments */}
      {active === "apartments" && <ApartmentsManager />}

      {/* Tenants */}
      {active === "tenants" && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Tenant Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Phone</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-600 dark:text-slate-400">
                            No tenants found
                          </td>
                        </tr>
                      ) : (
                        tenants.map((tenant) => (
                          <tr key={tenant.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="p-3 font-medium">{tenant.full_name}</td>
                            <td className="p-3">{tenant.email}</td>
                            <td className="p-3">{tenant.phone}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  tenant.is_active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {tenant.is_active ? "Active" : "Inactive"}
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
          )}

          {/* Bookings */}
          {active === "bookings" && <BookedApartmentsTable title="Booked Apartments" />}

          {/* Who still owes money — payments in flight, or deposit paid but balance never cleared */}
          {active === "outstanding" && <OutstandingPaymentsManager />}

          {/* Refunds — tenants/guests request refunds; manager processes (2-day locked) */}
          {active === "refunds" && <RefundRequestsManager />}

          {/* Weekly work schedule — per-employee, per-day hours + day off */}
          {active === "schedule" && <EmployeeScheduleManager />}

          {/* Cancelled payments — pending payments the tenants cancelled themselves */}
          {active === "cancelled" && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-600" />
                  Cancelled Payments ({cancelledPayments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Tenant</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Apartment</th>
                        <th className="text-left p-3 font-medium">Amount</th>
                        <th className="text-left p-3 font-medium">Was Due</th>
                        <th className="text-left p-3 font-medium">Cancelled On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledPayments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-600 dark:text-slate-400">
                            No cancelled payments
                          </td>
                        </tr>
                      ) : (
                        cancelledPayments.map((p) => (
                          <tr key={p.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="p-3 font-medium">{p.tenants?.full_name || "Unknown"}</td>
                            <td className="p-3">{p.tenants?.email || "—"}</td>
                            <td className="p-3">{p.apartments?.name || "—"}</td>
                            <td className="p-3 font-semibold text-red-700 dark:text-red-400">
                              RWF {Number(p.amount).toLocaleString()}
                            </td>
                            <td className="p-3">{p.due_date ? formatDate(p.due_date) : "—"}</td>
                            <td className="p-3">{p.updated_at ? formatDate(p.updated_at) : "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Messages */}
          {active === "messages" && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Client Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="p-6 text-center text-slate-600 dark:text-slate-400">
                      No messages found
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{msg.name}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{msg.email}</p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              msg.is_read
                                ? "bg-gray-100 text-gray-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {msg.is_read ? "Read" : "New"}
                          </span>
                        </div>
                        <p className="text-slate-700 text-sm">{msg.message}</p>
                        <p className="text-slate-500 text-xs mt-2">
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Chat */}
          {active === "chat" && (
            <ManagerChat
              managerId={manager.id}
              managerName={manager.full_name}
            />
          )}

          {/* Attendance — who clocked in/out today (login = attendance) */}
          {active === "attendance" && <AttendanceManager />}

          {/* How reliably each employee turns up, over a date range */}
          {active === "attendance-report" && <AttendanceReport />}

          {/* Scan Ticket — manager can verify & check in QR receipts like reception */}
          {active === "scan" && (
            <TicketScanner
              verifier={{ id: manager.id, name: manager.full_name }}
              onChecked={fetchCheckedTickets}
            />
          )}

          {/* Tickets Checked */}
          {active === "tickets" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tickets Checked by Reception ({checkedTickets.length})</CardTitle>
                <Button
                  size="sm"
                  onClick={handleGenerateCheckedReport}
                  disabled={generatingTickets || checkedTickets.length === 0}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <FileText className="h-4 w-4" />
                  {generatingTickets ? "Generating…" : "Generate Report"}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                      <tr>
                        <th className="text-left p-3 font-medium">Reference</th>
                        <th className="text-left p-3 font-medium">Tenant</th>
                        <th className="text-left p-3 font-medium">Apartment</th>
                        <th className="text-left p-3 font-medium">Amount</th>
                        <th className="text-left p-3 font-medium">Checked by</th>
                        <th className="text-left p-3 font-medium">Checked at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkedTickets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-600 dark:text-slate-400">
                            No tickets checked yet
                          </td>
                        </tr>
                      ) : (
                        checkedTickets.map((t) => (
                          <tr key={t.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="p-3 font-mono text-xs">{t.reference}</td>
                            <td className="p-3 font-medium text-slate-900 dark:text-white">{t.tenant}</td>
                            <td className="p-3">{t.apartment}</td>
                            <td className="p-3">{t.currency} {Number(t.amount).toLocaleString()}</td>
                            <td className="p-3">
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {t.checkedBy}
                              </span>
                            </td>
                            <td className="p-3">{t.checkedAt ? new Date(t.checkedAt).toLocaleString() : "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

      {manager && (
        <ChangePasswordModal
          isOpen={pwOpen}
          onClose={() => setPwOpen(false)}
          table="managers"
          userId={String(manager.id)}
        />
      )}
    </DashboardShell>
  );
}
