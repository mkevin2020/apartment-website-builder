"use client";

import { useEffect, useState } from "react";
import { dataClient } from "@/lib/data-client";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Building2 } from "lucide-react";
import { ViewDetailsButton, type ApartmentForDetails } from "@/components/apartment-details-modal";

type Apartment = ApartmentForDetails;

export function FeaturedApartments() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = dataClient();

  useEffect(() => {
    const fetchFeatured = async () => {
      // select("*") so we tolerate columns that may not exist yet (price_per_day, etc.)
      const { data } = await supabase
        .from("apartments")
        .select("*")
        .eq("is_available", true)
        .order("price_per_month", { ascending: true })
        .limit(3);
      setApartments((data as Apartment[]) || []);
      setLoading(false);
    };
    fetchFeatured();
  }, []);

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (apartments.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <Building2 className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400">No available apartments right now. Please check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {apartments.map((apt) => (
        <Card
          key={apt.id}
          className="group overflow-hidden border border-transparent dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl dark:shadow-slate-900/50 transition-all duration-300 rounded-2xl"
        >
          <div className="relative h-60 overflow-hidden">
            <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-blue-900 dark:text-amber-500 font-semibold px-3 py-1 rounded-full text-sm">
              RWF {Number(apt.price_per_month || 0).toLocaleString()}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">/mo</span>
            </div>
            {apt.image_url ? (
              <img
                src={apt.image_url}
                alt={apt.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                <Building2 className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              </div>
            )}
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm mb-2">
              <MapPin className="h-4 w-4" /> {apt.type || "Apartment"}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{apt.name}</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 line-clamp-2">
              {apt.description || "A comfortable, well-designed living space ready for you to call home."}
            </p>
            <ViewDetailsButton apt={apt} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
