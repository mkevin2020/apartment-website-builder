"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench, AlertCircle, CheckCircle } from "lucide-react";

const ISSUE_TYPES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Flooring",
  "Paint",
  "Door/Lock",
  "Window",
  "Other",
];

const PRIORITY_LEVELS = ["low", "normal", "high", "emergency"];

interface MaintenanceRequestFormProps {
  tenant: any;
  onSuccess?: () => void;
}

export default function MaintenanceRequestForm({ tenant, onSuccess }: MaintenanceRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    issue_type: "",
    description: "",
    priority: "normal",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    if (!formData.issue_type || !formData.description) {
      setMessage({ type: "error", text: "Please fill in all fields" });
      setLoading(false);
      return;
    }

    try {
      // Submit maintenance request
      const { error: requestError } = await supabase.from("maintenance_requests").insert([
        {
          tenant_id: tenant.id,
          apartment_id: tenant.apartment_id,
          issue_type: formData.issue_type,
          description: formData.description,
          priority: formData.priority,
          status: "pending",
        },
      ]);

      if (requestError) throw requestError;

      // Send notification to admin and employees
      const notificationMessage = `[MAINTENANCE REQUEST] ${tenant.full_name} submitted a maintenance request:\n\nType: ${formData.issue_type}\nPriority: ${formData.priority}\nDescription: ${formData.description}`;

      const { error: notificationError } = await supabase.from("client_feedback").insert([
        {
          name: tenant.full_name,
          email: tenant.email,
          message: notificationMessage,
          is_read: false,
        },
      ]);

      if (notificationError) {
        console.error("Error sending notification:", notificationError);
      }

      setMessage({
        type: "success",
        text: "Maintenance request submitted! Admins and employees have been notified.",
      });
      setFormData({ issue_type: "", description: "", priority: "normal" });
      
      setTimeout(() => {
        setMessage({ type: "", text: "" });
        if (onSuccess) onSuccess();
      }, 3000);
    } catch (error) {
      console.error("Error:", error);
      setMessage({ type: "error", text: "Failed to submit request" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-orange-600" />
          Request Maintenance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {message.text && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
              message.type === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <p
              className={
                message.type === "success" ? "text-green-900" : "text-red-900"
              }
            >
              {message.text}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Issue Type
            </label>
            <Select
              value={formData.issue_type}
              onValueChange={(value) =>
                setFormData({ ...formData, issue_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select issue type..." />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <Select
              value={formData.priority}
              onValueChange={(value) =>
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <Textarea
              placeholder="Describe the issue in detail..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={5}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
          >
            <Wrench className="h-4 w-4" />
            {loading ? "Submitting..." : "Submit Maintenance Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
