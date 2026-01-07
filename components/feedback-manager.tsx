"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@supabase/ssr"

export function FeedbackManager() {
  const [feedback, setFeedback] = useState<any[]>([])
  const [deleting, setDeleting] = useState<number | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchFeedback()
  }, [])

  const fetchFeedback = async () => {
    const { data } = await supabase.from("client_feedback").select("*").order("created_at", { ascending: false })

    if (data) setFeedback(data)
  }

  const handleDeleteFeedback = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this feedback? This action cannot be undone.")) {
      return
    }

    setDeleting(id)
    try {
      const { error } = await supabase
        .from("client_feedback")
        .delete()
        .eq("id", id)

      if (error) {
        alert("Error deleting feedback: " + error.message)
        setDeleting(null)
        return
      }

      alert("Feedback deleted successfully!")
      await fetchFeedback()
    } catch (err) {
      console.error("Error:", err)
      alert("An error occurred while deleting the feedback")
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Feedback</CardTitle>
        <CardDescription>View all feedback and reviews from clients</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No feedback yet
                  </TableCell>
                </TableRow>
              ) : (
                feedback.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.message}</TableCell>
                    <TableCell>{"⭐".repeat(item.rating)}</TableCell>
                    <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteFeedback(item.id)}
                        disabled={deleting === item.id}
                      >
                        {deleting === item.id ? "Deleting..." : "Delete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
