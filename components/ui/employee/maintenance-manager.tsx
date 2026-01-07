"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Wrench, Search } from "lucide-react";

export function MaintenanceManager() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("maintenance_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setRequests(data);
    } catch (err) {
      console.error("Error fetching requests:", err);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("maintenance_requests")
      .update({ status })
      .eq("id", id);

    if (!error) {
      await fetchRequests();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-50";
      case "in-progress":
        return "text-blue-600 bg-blue-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = `${req.issue_type || ""} ${req.description || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || req.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="h-6 w-6" />
          Maintenance Requests
        </h2>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by issue type or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-8">Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No maintenance requests found
          </div>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {request.issue_type}
                    </h3>
                    <p className="text-gray-700 mt-2">{request.description}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      Requested: {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {request.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Select
                    value={request.status}
                    onValueChange={(status) =>
                      updateStatus(request.id, status)
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}