'use client';

import type { ReactNode } from 'react';
import { DocumentProvider } from '@/stores/documentStore';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <DocumentProvider>{children}</DocumentProvider>;
}

