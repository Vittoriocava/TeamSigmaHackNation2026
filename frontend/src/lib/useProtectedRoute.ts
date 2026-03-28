import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from './store';

export function useProtectedRoute() {
  const router = useRouter();
  const { user, isHydrated } = useStore();

  useEffect(() => {
    // Aspetta che lo store sia idratato dal localStorage
    if (!isHydrated) return;

    // Se non c'è utente, reindirizza al login
    if (!user) {
      router.replace('/auth');
    }
  }, [isHydrated, user, router]);

  // Non mostrare niente finché non è idratato
  if (!isHydrated) {
    return null;
  }

  // Se non è loggato, ritorna null (il redirect avverrà)
  if (!user) {
    return null;
  }

  return true;
}
