import { Zap } from "lucide-react";

interface ClubPageHeaderProps {
  clubName: string;
}

export function ClubPageHeader({ clubName }: ClubPageHeaderProps) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-5 w-5 text-black fill-current" />
        <span className="text-sm font-medium tracking-wide uppercase text-slate-500">
          Обзор клуба
        </span>
      </div>
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
        {clubName}
      </h1>
    </div>
  );
}
