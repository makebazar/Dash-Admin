import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const BackButton = () => (
  <Link
    href="/promo"
    className="absolute top-6 left-6 z-100 flex items-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/70 hover:text-white px-4 py-2 rounded-full border border-white/10 transition-all active:scale-95"
  >
    <ChevronLeft size={20} />
    <span className="text-sm font-bold tracking-widest uppercase">Назад</span>
  </Link>
);
