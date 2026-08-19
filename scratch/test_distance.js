import { calculateOSRMRouteDistance, geocodeLocation } from '../src/utils/distanceHelper.js';

async function testDistance() {
  const testCases = [
    { pick: 'Nassau', drop: 'Paradise Island' },
    { pick: 'LPIA', drop: 'Cable Beach' },
    { pick: 'Atlantis', drop: 'Baha Mar' },
    { pick: 'Miami', drop: 'Nassau' },
    { pick: 'Downtown Nassau', drop: 'Albany Bahamas' },
    { pick: 'Nassau Hub', drop: 'Lynden Pindling International Airport' },
    { pick: 'New York', drop: 'London' }
  ];

  for (const tc of testCases) {
    console.log(`\nTesting: "${tc.pick}" -> "${tc.drop}"`);
    const geoPick = await geocodeLocation(tc.pick);
    const geoDrop = await geocodeLocation(tc.drop);
    console.log('Geo Pick:', geoPick);
    console.log('Geo Drop:', geoDrop);
    const res = await calculateOSRMRouteDistance(tc.pick, tc.drop);
    console.log('Distance Result:', res);
  }
}

testDistance();
