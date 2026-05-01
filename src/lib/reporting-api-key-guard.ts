
import { headers } from 'next/headers';

// A simple guard to protect routes with a static API key.
// The key should be stored in environment variables.
export function requireReportingApiKey() {
    const headersList = headers();
    const authHeader = headersList.get('Authorization');

    // Check if the header exists and has the correct format "Bearer <key>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error: any = new Error('Unauthorized: Missing or invalid Authorization header');
        error.status = 401;
        throw error;
    }

    const apiKey = authHeader.substring(7); // Extract the key part
    const serverApiKey = process.env.DASHADMIN_REPORTING_API_KEY;

    // Check if the server-side key is configured
    if (!serverApiKey) {
        console.error('API Key guard is active, but REPORTS_API_KEY is not set in environment variables.');
        const error: any = new Error('Internal Server Error: API authentication is misconfigured.');
        error.status = 500;
        throw error;
    }

    // Finally, compare the provided key with the server key
    if (apiKey !== serverApiKey) {
        const error: any = new Error('Forbidden: Invalid API Key');
        error.status = 403;
        throw error;
    }

    // If we reach here, the key is valid.
    return true;
}
