"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dataClient } from "@/lib/data-client";
import { Plus, Trash2, AlertCircle, CheckCircle, Tag, RefreshCw } from "lucide-react";

interface PromoCode {
  id: number;
  code: string;
  discount_percent: number;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
}

export function PromoCodesManager() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    code: "",
    discount_percent: "",
    expires_at: "",
    max_uses: "",
  });

  const supabase = dataClient();

  const fetchCodes = async () => {
    try {
      const { data, error: qErr } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setCodes(data || []);
    } catch (err: any) {
      setError(
        /relation .*promo_codes.* does not exist|could not find the table/i.test(err.message || "")
          ? "The promo_codes table doesn't exist yet — run the SQL shown to you, then refresh."
          : err.message || "Failed to load promo codes"
      );
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const resetForm = () => setForm({ code: "", discount_percent: "", expires_at: "", max_uses: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const code = form.code.trim().toUpperCase();
    const percent = parseInt(form.discount_percent);

    if (!code) return setError("Enter a promo code.");
    if (!percent || percent < 1 || percent > 100)
      return setError("Discount must be a number between 1 and 100.");

    setLoading(true);
    try {
      const { error: insErr } = await supabase.from("promo_codes").insert({
        code,
        discount_percent: percent,
        active: true,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        used_count: 0,
      });
      if (insErr) throw insErr;
      setSuccess(`Promo code "${code}" created — tenants get ${percent}% off.`);
      resetForm();
      await fetchCodes();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(
        /duplicate key|unique/i.test(err.message || "")
          ? `A promo code "${code}" already exists.`
          : err.message || "Failed to create promo code"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (c: PromoCode) => {
    await supabase.from("promo_codes").update({ active: !c.active }).eq("id", c.id);
    fetchCodes();
  };

  const handleDelete = async (c: PromoCode) => {
    if (!confirm(`Delete promo code "${c.code}"?`)) return;
    await supabase.from("promo_codes").delete().eq("id", c.id);
    fetchCodes();
  };

  const isExpired = (c: PromoCode) => c.expires_at != null && new Date(c.expires_at) < new Date();
  const isUsedUp = (c: PromoCode) => c.max_uses != null && c.used_count >= c.max_uses;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-600" /> Create Promo Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm bg-red-100 text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm bg-green-100 text-green-700">
              <CheckCircle className="h-4 w-4 flex-shrink-0" /> {success}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <Input
                placeholder="e.g. WELCOME10"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Discount (%)</label>
              <Input
                type="number"
                min={1}
                max={100}
                placeholder="e.g. 10"
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Expiry date (optional)</label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max uses (optional)</label>
              <Input
                type="number"
                min={1}
                placeholder="Unlimited if blank"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                {loading ? "Creating…" : "Create Code"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Promo Codes ({codes.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchCodes} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                <tr>
                  <th className="text-left p-3 font-medium">Code</th>
                  <th className="text-left p-3 font-medium">Discount</th>
                  <th className="text-left p-3 font-medium">Uses</th>
                  <th className="text-left p-3 font-medium">Expires</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-500 py-8">No promo codes yet.</td>
                  </tr>
                ) : (
                  codes.map((c) => {
                    const expired = isExpired(c);
                    const usedUp = isUsedUp(c);
                    const live = c.active && !expired && !usedUp;
                    return (
                      <tr key={c.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-semibold">{c.code}</td>
                        <td className="p-3">{c.discount_percent}% off</td>
                        <td className="p-3">{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</td>
                        <td className="p-3 text-xs text-slate-500">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}
                        </td>
                        <td className="p-3">
                          {live ? (
                            <span className="text-xs font-medium text-green-600">Active</span>
                          ) : expired ? (
                            <span className="text-xs font-medium text-red-500">Expired</span>
                          ) : usedUp ? (
                            <span className="text-xs font-medium text-amber-600">Used up</span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">Disabled</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => toggleActive(c)}>
                              {c.active ? "Disable" : "Enable"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(c)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
