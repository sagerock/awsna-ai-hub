'use client';

import { useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>; // Or a proper loading spinner component
  }

  if (!currentUser) {
    return null; // Or a redirect component, though useEffect handles redirect
  }

  return <>{children}</>;
}
