"use client"

import { Button } from "@/components/ui/button"
import { Building2, LogOut } from "lucide-react"
import Link from "next/link"

interface AdminHeaderProps {
  admin: any
  onLogout: () => void
}

export function AdminHeader({ admin, onLogout }: AdminHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Cielo Vista Admin</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Logged in as <span className="font-medium text-foreground">{admin.username}</span>
          </span>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
