import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { workstation_id, hostname, cpu, gpu_data, devices, memory, disks } = body;

        if (!workstation_id) {
            return NextResponse.json({ error: 'workstation_id is required' }, { status: 400 });
        }

        // Calculate CPU usage average from last few seconds if provided
        const cpuUsage = cpu?.usage ?? 0;
        const cpuTemp = cpu?.temp ?? 0;
        const cpuModel = cpu?.model_name ?? null;

        // Calculate memory usage percentage if total memory is available
        const memUsedBytes = memory?.used_bytes ?? memory?.usedBytes ?? 0;
        const memTotalBytes = memory?.total_bytes ?? memory?.totalBytes ?? 0;
        const memoryUsagePercent = memTotalBytes > 0 ? (memUsedBytes / memTotalBytes) * 100 : 0;

        const normalizedMemory = memory
            ? JSON.stringify({
                total_bytes: memTotalBytes,
                used_bytes: memUsedBytes
            })
            : null;

        const normalizedGpus = gpu_data
            ? JSON.stringify(
                Array.isArray(gpu_data)
                    ? gpu_data.map((g: any) => ({
                        name: g?.name ?? "",
                        temp: g?.temp ?? 0,
                        usage: g?.usage ?? 0,
                        memory_used: g?.memory_used ?? g?.memoryUsed ?? 0,
                        memory_total: g?.memory_total ?? g?.memoryTotal ?? 0,
                        fan_speed: g?.fan_speed ?? g?.fanSpeed ?? 0,
                    }))
                    : gpu_data
            )
            : null;

        const normalizedDisks = disks
            ? JSON.stringify(
                Array.isArray(disks)
                    ? disks.map((d: any) => ({
                        name: d?.name ?? "",
                        mount: d?.mount ?? "",
                        total_bytes: d?.total_bytes ?? d?.totalBytes ?? 0,
                        free_bytes: d?.free_bytes ?? d?.freeBytes ?? 0,
                    }))
                    : disks
            )
            : null;

        const normalizedDevices = devices ? JSON.stringify(devices) : null;

        try {
            await query(
                `INSERT INTO agent_telemetry 
                 (workstation_id, hostname, cpu_temp, cpu_usage, cpu_model, gpu_data, devices, memory, disks, memory_usage)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    workstation_id,
                    hostname ?? null,
                    cpuTemp,
                    cpuUsage,
                    cpuModel,
                    normalizedGpus,
                    normalizedDevices,
                    normalizedMemory,
                    normalizedDisks,
                    memoryUsagePercent
                ]
            );
        } catch (err: any) {
            if (err?.code === '42703' && String(err?.message || '').includes('memory_usage')) {
                await query(
                    `INSERT INTO agent_telemetry 
                     (workstation_id, hostname, cpu_temp, cpu_usage, cpu_model, gpu_data, devices, memory, disks)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        workstation_id,
                        hostname ?? null,
                        cpuTemp,
                        cpuUsage,
                        cpuModel,
                        normalizedGpus,
                        normalizedDevices,
                        normalizedMemory,
                        normalizedDisks
                    ]
                );
            } else {
                throw err;
            }
        }

        // Update workstation status
        await query(
            `UPDATE club_workstations 
             SET agent_last_seen = NOW(), 
                 agent_status = 'ONLINE'
             WHERE id = $1`,
            [workstation_id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Telemetry Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
