import { getShiftZoneDiscrepancyReport } from './src/app/clubs/[clubId]/inventory/actions';
import { getClient } from './src/db';

async function main() {
  const report = await getShiftZoneDiscrepancyReport('9', '2af1f80e-b56e-4894-9992-150de3c592d7');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(console.error);
