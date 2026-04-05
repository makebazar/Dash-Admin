import type { RecruitmentTemplateSchemaV1 } from "@/lib/recruitment"

export type RecruitmentPreset = {
    id: string
    name: string
    description: string
    position: string
    schema: RecruitmentTemplateSchemaV1
}

export const recruitmentPresets: RecruitmentPreset[] = [
    {
        id: "admin_v1",
        name: "Администратор (анкета + тесты)",
        description: "Базовая анкета + мини IQ + стрессоустойчивость для компьютерного клуба",
        position: "Администратор",
        schema: {
            version: 1,
            sections: [
                {
                    id: "about",
                    title: "О себе",
                    questions: [
                        { id: "age", type: "text", label: "Возраст", required: false },
                        { id: "city", type: "text", label: "Город", required: false },
                        { id: "study_work", type: "text", label: "Чем сейчас занимаешься?", description: "Учёба, работа, свободный график", required: false }
                    ]
                },
                {
                    id: "work_history",
                    title: "Опыт работы",
                    description: "Можно добавить несколько мест работы",
                    questions: [
                        {
                            id: "work_history_list",
                            type: "repeatable_list",
                            label: "Места работы",
                            description: "Добавь столько записей, сколько нужно",
                            item_label: "место работы",
                            fields: [
                                { id: "year", type: "text", label: "Период / год" },
                                { id: "company", type: "text", label: "Где работал(а)" },
                                { id: "position_name", type: "text", label: "Должность" },
                                { id: "duties", type: "text", label: "Что делал(а)" }
                            ]
                        }
                    ]
                },
                {
                    id: "schedule",
                    title: "График",
                    questions: [
                        {
                            id: "availability",
                            type: "choice",
                            label: "Готовность работать в ночные смены?",
                            required: true,
                            options: [
                                { id: "yes", label: "Да" },
                                { id: "sometimes", label: "Иногда" },
                                { id: "no", label: "Нет" }
                            ]
                        },
                        {
                            id: "shift_count",
                            type: "choice",
                            label: "Сколько смен в неделю тебе комфортно брать?",
                            required: true,
                            options: [
                                { id: "1_2", label: "1-2 смены" },
                                { id: "3_4", label: "3-4 смены" },
                                { id: "5_plus", label: "5 и больше" }
                            ]
                        },
                        {
                            id: "weekend_ready",
                            type: "boolean",
                            label: "Готов(а) выходить в выходные?",
                            required: true
                        }
                    ]
                },
                {
                    id: "motivation",
                    title: "Мотивация",
                    questions: [
                        {
                            id: "why_club",
                            type: "text",
                            label: "Почему хочешь работать именно в компьютерном клубе?",
                            required: false
                        },
                        {
                            id: "why_admin",
                            type: "text",
                            label: "Почему тебе интересна позиция администратора?",
                            required: false
                        }
                    ]
                },
                {
                    id: "extra",
                    title: "Дополнительно",
                    questions: [
                        {
                            id: "rules",
                            type: "boolean",
                            label: "Готов(а) соблюдать регламенты клуба?",
                            description: "Касса, возвраты, правила общения с клиентами, внутренние инструкции",
                            required: true
                        },
                        {
                            id: "start_date",
                            type: "text",
                            label: "Когда готов(а) выйти на первую смену?",
                            required: false
                        }
                    ]
                }
            ]
        }
    }
]
