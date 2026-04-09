import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

describe("Migration SQL safety checks", () => {
    it("uses DISTINCT ON to avoid duplicate upserts for club zones", () => {
        const sql = readFileSync(
            resolve(process.cwd(), "migrations/create_club_zones.sql"),
            "utf8"
        )
        expect(sql).toContain("DISTINCT ON (w.club_id, w.zone)")
        expect(sql).toContain("ON CONFLICT (club_id, name) DO UPDATE")
    })

    it("ensures employee_shift_schedules has a stable unique constraint for ON CONFLICT", () => {
        const sql = readFileSync(
            resolve(process.cwd(), "migrations/zz_ensure_employee_shift_schedules.sql"),
            "utf8"
        )
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS employee_shift_schedules")
        expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS employee_shift_schedules_uniq_club_user_month_year")
        expect(sql).toContain("ON employee_shift_schedules (club_id, user_id, month, year)")
    })
})

describe("Instruction editor implementation", () => {
    it("uses Tiptap through RichTextEditor to avoid findDOMNode from react-quill", () => {
        const source = readFileSync(
            resolve(process.cwd(), "src/app/clubs/[clubId]/equipment/inventory/InstructionsTab.tsx"),
            "utf8"
        )
        expect(source).toContain('RichTextEditor')
        expect(source).not.toContain("react-quill")
        expect(source).not.toContain("findDOMNode")
    })
})
