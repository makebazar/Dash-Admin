'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Download } from 'lucide-react';
import { generateTemplate, parseExcel, ShiftImportRow, CustomField } from '@/lib/excel';

interface Employee {
    id: string; // UUID
    full_name: string;
}

interface ProcessedRow extends ShiftImportRow {
    status: 'VALID' | 'INVALID';
    error?: string;
    employeeId?: string;
    parsedCheckIn?: string; // ISO string
    parsedCheckOut?: string; // ISO string
    reportData?: Record<string, any>;
}

interface ShiftExcelImportProps {
    clubId: string;
    employees: Employee[];
    customFields?: CustomField[];
    onSuccess: () => void;
}

export function ShiftExcelImport({ clubId, employees, customFields = [], onSuccess }: ShiftExcelImportProps) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<ProcessedRow[]>([]);
    const [uploading, setUploading] = useState(false);
    const [fileStats, setFileStats] = useState<{ total: number; valid: number } | null>(null);

    const parseDate = (dateStr: string | number): Date | null => {
        if (!dateStr) return null;

        // Handle Excel serial date
        if (typeof dateStr === 'number') {
            // Excel serial date to UTC milliseconds
            // 25569 is the number of days from 1900-01-01 to 1970-01-01
            const utcDays = dateStr - 25569;
            const utcValue = utcDays * 86400 * 1000;

            // Create a Date object from the UTC value
            const dateInfo = new Date(utcValue);

            // Construct a local date that has the SAME components as the UTC date
            // This effectively "ignores" timezones and treats the Excel time as "Wall Clock"
            const localDate = new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate(),
                dateInfo.getUTCHours(), dateInfo.getUTCMinutes(), dateInfo.getUTCSeconds());

            return localDate;
        }

        // Handle "DD.MM.YYYY HH:mm" or "DD.MM.YYYY HH:mm:ss"
        if (typeof dateStr === 'string') {
            const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
            if (parts) {
                const second = parts[6] ? parts[6] : '00';
                return new Date(`${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}:${parts[5]}:${second}`);
            }
        }

        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const rawData = await parseExcel(file);

            const processed: ProcessedRow[] = rawData.map((row: any) => {
                const name = row['ФИО']?.trim();
                const checkInRaw = row['Дата начала'];
                const checkOutRaw = row['Дата окончания'];

                const employee = employees.find(e => e.full_name.toLowerCase() === name?.toLowerCase());
                const checkInDate = parseDate(checkInRaw);
                const checkOutDate = parseDate(checkOutRaw);

                let error = '';
                if (!employee) error = 'Сотрудник не найден';
                else if (!checkInDate) error = 'Неверный формат даты начала';
                else if (!checkOutDate) error = 'Неверный формат даты окончания';

                // Extract custom fields data
                const reportData: Record<string, any> = {};
                customFields.forEach(field => {
                    const val = row[field.custom_label];
                    // If parsing is needed (e.g. string to number), do it here. Assuming number or string for now.
                    reportData[field.metric_key] = val;
                });

                return {
                    ...row,
                    status: error ? 'INVALID' : 'VALID',
                    error,
                    employeeId: employee?.id,
                    parsedCheckIn: checkInDate?.toISOString(),
                    parsedCheckOut: checkOutDate?.toISOString(),
                    reportData
                };
            });

            setRows(processed);
            setFileStats({
                total: processed.length,
                valid: processed.filter(r => r.status === 'VALID').length
            });
        } catch (err) {
            console.error(err);
            alert('Ошибка при чтении файла');
        }
    };

    const handleEmployeeChange = (index: number, employeeId: string) => {
        const newRows = [...rows];
        const row = newRows[index];
        const employee = employees.find(e => e.id === employeeId);

        row.employeeId = employee?.id;

        // Re-validate
        let error = '';
        if (!employee) error = 'Сотрудник не найден';
        else if (!row.parsedCheckIn) error = 'Неверный формат даты начала';
        else if (!row.parsedCheckOut) error = 'Неверный формат даты окончания';

        row.status = error ? 'INVALID' : 'VALID';
        row.error = error;

        setRows(newRows);
        setFileStats({
            total: newRows.length,
            valid: newRows.filter(r => r.status === 'VALID').length
        });
    };

    const handleImport = async () => {
        const validRows = rows.filter(r => r.status === 'VALID');
        if (validRows.length === 0) return;

        setUploading(true);
        try {
            const payload = validRows.map(row => ({
                employee_id: String(row.employeeId),
                check_in: row.parsedCheckIn,
                check_out: row.parsedCheckOut,
                cash_income: row['Наличные'] || 0,
                card_income: row['Безнал'] || 0,
                expenses: row['Расходы'] || 0,

                report_comment: row['Комментарий'] || '',
                report_data: row.reportData || {}
            }));

            const res = await fetch(`/api/clubs/${clubId}/shifts/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shifts: payload })
            });

            const json = await res.json();
            if (json.success) {
                alert(`Импортировано: ${json.imported}. Ошибок: ${json.failed}`);
                setOpen(false);
                setRows([]);
                setFileStats(null);
                onSuccess();
            } else {
                alert(`Ошибка: ${json.error}`);
            }

        } catch (e) {
            console.error(e);
            alert('Ошибка выполнения запроса');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Импорт Excel
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Импорт смен из Excel</DialogTitle>
                    <DialogDescription>
                        Загрузите файл для массового добавления смен. Используйте шаблон.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" onClick={() => generateTemplate(customFields)} className="gap-2">
                            <Download className="h-4 w-4" />
                            Скачать шаблон
                        </Button>
                        <div className="relative">
                            <Button variant="default" className="gap-2 relative">
                                <Upload className="h-4 w-4" />
                                Загрузить файл
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileChange}
                                />
                            </Button>
                        </div>
                        {fileStats && (
                            <div className="text-sm text-muted-foreground">
                                Найдено строк: {fileStats.total}. Валидных: {fileStats.valid}.
                            </div>
                        )}
                    </div>

                    {rows.length > 0 && (
                        <div className="border rounded-md max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Статус</TableHead>
                                        <TableHead>Сотрудник</TableHead>
                                        <TableHead>Начало</TableHead>
                                        <TableHead>Окончание</TableHead>
                                        <TableHead>Выручка</TableHead>
                                        <TableHead>Комментарий</TableHead>
                                        {customFields.map(f => (
                                            <TableHead key={f.metric_key}>{f.custom_label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, i) => (
                                        <TableRow key={i} className={row.status === 'INVALID' ? 'bg-red-50 hover:bg-red-50' : ''}>
                                            <TableCell>
                                                {row.status === 'VALID' ? (
                                                    <Badge className="bg-green-600"><Check className="h-3 w-3 mr-1" /> OK</Badge>
                                                ) : (
                                                    <Badge variant="destructive" title={row.error}>
                                                        <AlertCircle className="h-3 w-3 mr-1" /> Ошибка
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <select
                                                    value={row.employeeId || ''}
                                                    onChange={(e) => handleEmployeeChange(i, e.target.value)}
                                                    className={`h-8 w-[180px] rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${!row.employeeId ? 'border-red-500' : 'border-input'
                                                        }`}
                                                >
                                                    <option value="">Выберите сотрудника</option>
                                                    {employees.map(emp => (
                                                        <option key={emp.id} value={emp.id}>
                                                            {emp.full_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {row.status === 'INVALID' && !row.employeeId && (
                                                    <div className="text-xs text-red-500 mt-1">
                                                        В файле: {row['ФИО']}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {row.parsedCheckIn ? new Date(row.parsedCheckIn).toLocaleString('ru-RU') : (
                                                    <span className="text-red-500">{String(row['Дата начала'])}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {row.parsedCheckOut ? new Date(row.parsedCheckOut).toLocaleString('ru-RU') : (
                                                    <span className="text-red-500">{String(row['Дата окончания'])}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{(row['Наличные'] || 0) + (row['Безнал'] || 0)} ₽</TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={row['Комментарий']}>{row['Комментарий']}</TableCell>
                                            {customFields.map(f => (
                                                <TableCell key={f.metric_key}>
                                                    {row.reportData?.[f.metric_key] || 0}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <div className="flex items-center justify-between w-full">
                        {rows.some(r => r.status === 'INVALID') && (
                            <span className="text-sm text-red-600">
                                Внимание: Будут импортированы только валидные строки!
                            </span>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
                            <Button onClick={handleImport} disabled={uploading || !fileStats?.valid}>
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Импортировать ({fileStats?.valid || 0})
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
