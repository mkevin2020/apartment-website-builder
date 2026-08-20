"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Camera } from "lucide-react";

interface ProfileCardProps {
  tenant: any;
}

export default function ProfileCard({ tenant }: ProfileCardProps) {
  const [profileImage, setProfileImage] = useState(tenant.profile_image_url);
  const [uploading, setUploading] = useState(false);
  // Upload failures were only logged to the console, so a tenant whose
  // photo failed saw nothing happen at all.
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Uploaded through the API, which derives the filename from the signed
      // session. Doing it here meant the object name came from `tenant.id` — a
      // value read out of localStorage, so a tenant could write into another
      // tenant's namespace — and the resulting URL was publicly readable.
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/tenant/profile-photo", {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setUploadError(data?.error || "Could not upload your photo. Please try again.");
        return;
      }

      // A signed URL for immediate display; the database stores the path.
      setProfileImage(data.url);
      const session = JSON.parse(localStorage.getItem("tenant_session") || "{}");
      session.profile_picture_url = data.path;
      localStorage.setItem("tenant_session", JSON.stringify(session));
    } catch {
      setUploadError("Could not upload your photo. Please check your connection.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="sticky top-8">
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Image */}
        <div className="relative mx-auto w-32 h-32 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-lg overflow-hidden group">
          {profileImage ? (
            <img
              src={profileImage}
              alt={tenant.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white">
              {tenant.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            disabled={uploading}
          >
            <Camera className="h-6 w-6 text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleImageUpload}
            disabled={uploading}
          />
        </div>

        {/* Upload failures were previously only console.error'd, so a tenant
            whose photo failed saw nothing at all happen. */}
        {uploadError && (
          <p role="alert" className="text-center text-sm text-red-600">
            {uploadError}
          </p>
        )}

        {/* Profile Information */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-center">{tenant.full_name}</h2>

          <div className="flex items-center gap-2 text-gray-600">
            <Mail className="h-4 w-4" />
            <a href={`mailto:${tenant.email}`} className="hover:text-blue-600">
              {tenant.email}
            </a>
          </div>

          {tenant.phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="h-4 w-4" />
              <a href={`tel:${tenant.phone}`} className="hover:text-blue-600">
                {tenant.phone}
              </a>
            </div>
          )}

          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>Tenant since {new Date(tenant.created_at).getFullYear()}</span>
          </div>
        </div>

        <Button className="w-full" variant="outline" asChild>
          <a href="/tenant/profile">Edit Profile</a>
        </Button>
      </CardContent>
    </Card>
  );
}