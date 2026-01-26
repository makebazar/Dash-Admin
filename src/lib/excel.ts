import * as XLSX from 'xlsx';

export interface ShiftImportRow {
    'ФИО': string;
    'Дата начала': string; // DD.MM.YYYY HH:mm
    'Дата окончания': string; // DD.MM.YYYY HH:mm
    'Наличные': number;
    'Безнал': number;
    'Расходы': number;
    'Комментарий': string;
}

export const EXCEL_COLUMNS = [
    'ФИО',
    'Дата начала',
    'Дата окончания',
    'Наличные',
    'Безнал',
    'Расходы',
    'Комментарий'
];

export const generateTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
        EXCEL_COLUMNS,
        ['Иванов Иван Иванович', '25.01.2026 08:00', '25.01.2026 20:00', 5000, 15000, 0, 'Пример смены']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
    XLSX.writeFile(wb, 'shablon_smen.xlsx');
};

export const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};
