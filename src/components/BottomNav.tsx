'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, CalendarDays, WalletCards } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'الرئيسية', icon: LayoutGrid },
    { href: '/schedule', label: 'الجدول', icon: CalendarDays },
    { href: '/payments', label: 'الاشتراكات', icon: WalletCards },
  ];

  return (
    <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto bg-zinc-900/90 backdrop-blur-md border border-zinc-800/90 rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-1 sm:gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
                isActive
                  ? 'bg-zinc-800 text-indigo-400 border border-zinc-700/60 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-zinc-400'} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
