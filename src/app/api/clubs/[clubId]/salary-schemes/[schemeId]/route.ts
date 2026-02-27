import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET: Get single salary scheme with all versions
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; schemeId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, schemeId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get scheme
        const schemeResult = await query(
            `SELECT * FROM salary_schemes WHERE id = $1 AND club_id = $2`,
            [schemeId, clubId]
        );

        if ((schemeResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
        }

        // Get versions
        const versionsResult = await query(
            `SELECT id, version, formula, created_at 
             FROM salary_scheme_versions 
             WHERE scheme_id = $1 
             ORDER BY version DESC`,
            [schemeId]
        );

        // Use the latest version formula as the current scheme formula
        const scheme = schemeResult.rows[0];
        const latestVersion = versionsResult.rows[0];
        
        if (latestVersion && latestVersion.formula) {
            scheme.formula = latestVersion.formula;
        }

        return NextResponse.json({
            scheme: scheme,
            versions: versionsResult.rows
        });

    } catch (error: any) {
        console.error('Get Salary Scheme Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Update salary scheme (creates new version)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; schemeId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, schemeId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check scheme exists
        const schemeCheck = await query(
            `SELECT id FROM salary_schemes WHERE id = $1 AND club_id = $2`,
            [schemeId, clubId]
        );

        if ((schemeCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
        }

        const { name, description, formula, is_active, period_bonuses, standard_monthly_shifts } = body;

        // Update scheme metadata if provided
        if (name !== undefined || description !== undefined || is_active !== undefined || period_bonuses !== undefined || standard_monthly_shifts !== undefined || formula !== undefined) {
            const updates: string[] = [];
            const values: any[] = [];
            let idx = 1;

            if (name !== undefined) {
                updates.push(`name = $${idx++}`);
                values.push(name);
            }
            if (description !== undefined) {
                updates.push(`description = $${idx++}`);
                values.push(description);
            }
            if (is_active !== undefined) {
                updates.push(`is_active = $${idx++}`);
                values.push(is_active);
            }
            if (period_bonuses !== undefined) {
                updates.push(`period_bonuses = $${idx++}`);
                values.push(JSON.stringify(period_bonuses));
            }
            if (standard_monthly_shifts !== undefined) {
                updates.push(`standard_monthly_shifts = $${idx++}`);
                values.push(standard_monthly_shifts);
            }
            if (formula !== undefined) {
                updates.push(`formula = $${idx++}`);
                values.push(JSON.stringify(formula));
            }

            if (updates.length > 0) {
                values.push(schemeId);
                await query(
                    `UPDATE salary_schemes SET ${updates.join(', ')} WHERE id = $${idx}`,
                    values
                );
            }
        }

        // If formula is provided, create new version
        let newVersion = null;
        if (formula) {
            // Get latest version number
            const latestVersion = await query(
                `SELECT COALESCE(MAX(version), 0) as max_version FROM salary_scheme_versions WHERE scheme_id = $1`,
                [schemeId]
            );

            const nextVersion = (latestVersion.rows[0].max_version || 0) + 1;

            const versionResult = await query(
                `INSERT INTO salary_scheme_versions (scheme_id, version, formula)
                 VALUES ($1, $2, $3)
                 RETURNING id, version, created_at`,
                [schemeId, nextVersion, JSON.stringify(formula)]
            );

            newVersion = versionResult.rows[0];
        }

        return NextResponse.json({
            success: true,
            new_version: newVersion
        });

    } catch (error: any) {
        console.error('Update Salary Scheme Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Deactivate salary scheme
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string; schemeId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, schemeId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Soft delete - just deactivate
        await query(
            `UPDATE salary_schemes SET is_active = false WHERE id = $1 AND club_id = $2`,
            [schemeId, clubId]
        );

        // Remove assignments
        await query(
            `DELETE FROM employee_salary_assignments WHERE scheme_id = $1`,
            [schemeId]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete Salary Scheme Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
