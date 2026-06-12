import { NextResponse } from 'next/server';
import { query } from '@/db';
import crypto from 'crypto';

const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCYoO+51L8V1IAo
l2qSHxU4WJ/MNRT/6kSZ+xjKDw6Jp3Vr+amUkE1eqMGYZfwOMR33QPj91SxcMtRI
iuVm+GBL6hh/f3Sw3TnNwV4k0nA4u9abqXdLjamJNyfb8pv99rWLo/12Ioi3YZai
zz/u2qZ2KEItEbZw5COkwQCJFWMzQ822npsQoXeYm9UFi199PodCkKm1n7KWVMC+
0r4qSlUsbR8hhWv7kCXdlJgpj53WiNeaVbAToE6JaZWvYl/mESeW7lhIvBJOYiqO
5FgFjSgQBpEk++AvGMjhtFAnDKhF/7mkCnQUvUwcXufHwOu1YDxEqsPMxkBvzbcc
eIwGScbJAgMBAAECggEAC4++VQrx7hkGm7yLirXOzVG+ShFXzcJsz6azBCRTlzcP
iJ40+69aIwJgxtbr2tXa5Z6+9bhjB7lkdfnKgowsPDfngunwWJDrduPvyhWEQXHu
IeS6iAc7OU0LqIg2S4y3iBREKAGZ7l02tE7DcqgOrbrjN2eE9MR9VDa4AApWFT0O
yTQRA9pp6zoUZdEE+tY4BNEq01pwaMP00fNWE+2pVhsmKmpznzzvEEBSupLV40jo
ae3SalcVdos6u/lzCCzdQn0N7wDaM8bAVOfqa3TE+c3BEj9lMH7v93yrYAbVmksN
VC6TAoNqN0olH2H9mWHc5ebjb5BkVonDhWBvu5/GwQKBgQDJ0b3R1sqNFEroagX2
1e5G0w7IhhrmMCUOR1uWiR8tPs04GiFrQQiQqZu77InsX7lQlUCL2uwTLVxZ5I5q
z/RPGm8mH6WORywDthFrU3aV+W4fVvx6+B8vUSYtgOmuX2ktNpRprrXrkp23UoAY
EZkgTsZATT73fQvkDAqHwQReiQKBgQDBmoM39U27k6n34wRlyuQl5vxj1+/qjJKC
P94iK0reghnR0YQWtlzX+s8cbqcOXPDXtkGONcB4TkEBfB0co3vRHQKRZWaQRM+r
OAfIoyZPBWRwVbzZ0hvp2J0Y1ah4mgwv1s/Xgoe3ccbJ9BV6ke5THhgQTIsp/FL2
4IACEB4WQQKBgDBDuaqKPIx6suNcH6sFRGOpq9pmv94W23XLuOqKRmtynm9xSFa3
Cc5W0Yiiq+VcixvrZbFMnLKFYZWZ5DlFHD8iqjwqy1P4T11f2FCbeDurmBtkmSLr
XcHaHVA6iSgLZ0LJz7pqbtU0jgU+dKXM55rjW+Qa1RkozYQvIQGQNnRJAoGAfGIB
tdzi4QVgqMLwW1m7tGIvexILsJw5sHbKBxfbVRMu9W9vNoxZH+WiVHj+2Sp7DYup
mG0OR/y2pPaRWYnrDZFeyfzkpQGgjjdEQPIYtaIYQlfDKgpkJpwlagQy5bDK7Z1M
EQBqoz/04GDxv7qr7DikayxSKFpVDwlzFGA4hEECgYEAgri/D+lDuD11hFN1CR7R
EzMHfrbMRXnPymm1RRyFT/fgvnO2L/kFOXkqeerIN9cuWow7e58GjtrVxs6hxcJ/
bfwqV6HUYOZoQMuZYMLqoVT5/iZFM7o4GA+bfl+cBKpuwprnbBt/ykkO7FwMMv7o
lQgf/47F4ak62Ewly+y+GNo=
-----END PRIVATE KEY-----`;

function base64url(str: string): string {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function signJwt(payload: object, privateKeyPem: string): string {
    const header = { alg: 'RS256', typ: 'JWT' };
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${encodedHeader}.${encodedPayload}`);
    const signature = sign.sign(privateKeyPem, 'base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
        
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function POST(request: Request) {
    try {
        const { club_id, api_key, hwid } = await request.json();

        if (!club_id || !api_key) {
            return NextResponse.json({ error: 'club_id and api_key are required' }, { status: 400 });
        }

        // Fetch club and owner details
        const clubRes = await query(
            `SELECT c.owner_id, c.inventory_settings, u.subscription_status, u.subscription_ends_at, u.subscription_plan
             FROM clubs c
             JOIN users u ON c.owner_id = u.id
             WHERE c.id = $1`,
            [club_id]
        );

        if (!clubRes.rows || clubRes.rows.length === 0) {
            return NextResponse.json({ error: 'Club or club owner not found' }, { status: 404 });
        }

        const club = clubRes.rows[0];
        const clubApiKey = club.inventory_settings?.api_key || process.env.DASHADMIN_SYNC_KEY;

        // Verify API key (allow default fallback env key)
        if (clubApiKey && api_key !== clubApiKey && api_key !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden: invalid API key' }, { status: 403 });
        }

        // Check subscription status
        const isSubscribed = 
            club.subscription_status === 'active' || 
            club.subscription_status === 'trialing' ||
            (club.subscription_ends_at && new Date(club.subscription_ends_at) > new Date());

        if (!isSubscribed) {
            return NextResponse.json({ 
                error: 'License verification failed: subscription is expired or inactive' 
            }, { status: 402 });
        }

        // Determine workstation limit based on subscription plan
        // E.g., 'starter' = 15 PCs, 'pro' = 40 PCs, 'ultra' = 100 PCs, default = 20 PCs
        let maxWorkstations = 20;
        const plan = club.subscription_plan?.toLowerCase();
        if (plan === 'starter') {
            maxWorkstations = 15;
        } else if (plan === 'pro') {
            maxWorkstations = 45;
        } else if (plan === 'ultra' || plan === 'unlimited') {
            maxWorkstations = 150;
        }

        // Set expiration date (e.g., matching subscription end, or default 30 days lease)
        const leaseDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days lease
        let expiresAt = new Date(Date.now() + leaseDurationMs);

        if (club.subscription_ends_at) {
            const subEndDate = new Date(club.subscription_ends_at);
            // Cap lease expiration at subscription end plus a 3-day grace period
            const subEndDateWithGrace = new Date(subEndDate.getTime() + 3 * 24 * 60 * 60 * 1000);
            if (subEndDateWithGrace < expiresAt) {
                expiresAt = subEndDateWithGrace;
            }
        }

        // Generate license payload
        const payload = {
            clubId: club_id,
            maxWorkstations,
            expiresAt: expiresAt.toISOString(),
            hwid: hwid || null, // lock license to local server hardware if provided
            issuedAt: new Date().toISOString()
        };

        // Sign payload with RSA private key
        const licenseToken = signJwt(payload, PRIVATE_KEY_PEM);

        return NextResponse.json({
            success: true,
            license_token: licenseToken,
            expires_at: expiresAt.toISOString(),
            max_workstations: maxWorkstations
        });

    } catch (error) {
        console.error('License Verification Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
