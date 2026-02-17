import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete('session_user_id');
        cookieStore.delete('session_token'); // На всякий случай, если используется

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
