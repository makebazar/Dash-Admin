'use client';

import { useEffect, useState } from 'react';
import PayrollDashboard from '@/components/payroll/PayrollDashboard';

export default function SalariesPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState<string>('');

    useEffect(() => {
        params.then(p => setClubId(p.clubId));
    }, [params]);

    if (!clubId) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Загрузка...</div>
            </div>
        );
    }

    return <PayrollDashboard clubId={clubId} />;
}
