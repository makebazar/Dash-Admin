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

    it("ensures club_employees.role exists before insert into free pool", () => {
        const sql = readFileSync(
            resolve(process.cwd(), "migrations/create_free_pool_user_v3.sql"),
            "utf8"
        )
        expect(sql).toContain("ALTER TABLE club_employees ADD COLUMN role")
        expect(sql).toContain("ALTER TABLE club_employees ALTER COLUMN role SET NOT NULL")
        expect(sql).toContain("INSERT INTO club_employees (club_id, user_id, role, is_active)")
    })
})

describe("Instruction editor implementation", () => {
    it("uses Quill directly instead of react-quill to avoid findDOMNode", () => {
        const source = readFileSync(
            resolve(process.cwd(), "src/app/clubs/[clubId]/equipment/inventory/InstructionsTab.tsx"),
            "utf8"
        )
        expect(source).toContain('import("quill")')
        expect(source).not.toContain("react-quill")
        expect(source).not.toContain("findDOMNode")
    })
})
