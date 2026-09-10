import type { ReactNode } from 'react';
export const metadata = { title: 'Roots', description: 'A source-backed family book' };
export default function Layout({children}: {children: ReactNode}) { return <html lang="en"><body style={{margin:0}}>{children}</body></html>; }
