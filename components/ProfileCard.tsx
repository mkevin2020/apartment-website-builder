"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@supabase/ssr";
import { Mail, Phone, MapPin, Camera } from "lucide-react";

interface ProfileCardProps {
  tenant: any;
}

export default function ProfileCard({ tenant }: ProfileCardProps) {
  const [profileImage, setProfileImage] = useState(tenant.profile_image_url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${tenant.id}-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("tenant-profiles")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("tenant-profiles").getPublicUrl(fileName);

      // Update tenant record
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ profile_image_url: publicUrl })
        .eq("id", tenant.id);

      if (updateError) throw updateError;

      setProfileImage(publicUrl);
      const session = JSON.parse(localStorage.getItem("tenant_session") || "{}");
      session.profile_image_url = publicUrl;
      localStorage.setItem("tenant_session", JSON.stringify(session));
    } catch (error) {
      console.error("Error uploading image:", error);
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