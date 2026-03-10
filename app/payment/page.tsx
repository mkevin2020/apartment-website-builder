'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to tenant payments page
    router.push('/tenant/payments');
  }, [router]);

  return (
    <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Payment Management</h1>
        <p className="text-gray-600 mb-4">Redirecting to payment dashboard...</p>
        <p className="text-sm text-gray-500">
          Or <a href="/tenant/payments" className="text-blue-600 hover:underline">click here</a> if not redirected.
        </p>
      </div>
    </div>
  );
}
