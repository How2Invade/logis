// Approximate coordinates for Indian cities and state centroids, used to place LOGIS locations on the map.
// Locations that match nothing here are returned as unplaced rather than guessed.

export type LngLat = [number, number];

const CITIES: Record<string, LngLat> = {
  mumbai: [72.8777, 19.076], 'navi mumbai': [73.0297, 19.033], thane: [72.9781, 19.2183], bhiwandi: [73.0483, 19.2813],
  pune: [73.8567, 18.5204], nashik: [73.7898, 19.9975], nagpur: [79.0882, 21.1458], aurangabad: [75.3433, 19.8762],
  delhi: [77.209, 28.6139], 'new delhi': [77.209, 28.6139], noida: [77.391, 28.5355], gurgaon: [77.0266, 28.4595],
  gurugram: [77.0266, 28.4595], ghaziabad: [77.4538, 28.6692], faridabad: [77.3178, 28.4089], kundli: [77.1196, 28.8786],
  bengaluru: [77.5946, 12.9716], bangalore: [77.5946, 12.9716], mysuru: [76.6394, 12.2958], mysore: [76.6394, 12.2958],
  nanjangud: [76.6806, 12.1206], kolkata: [88.3639, 22.5726], dankuni: [88.2925, 22.6744], howrah: [88.2636, 22.5958],
  ahmedabad: [72.5714, 23.0225], surat: [72.8311, 21.1702], vadodara: [73.1812, 22.3072], rajkot: [70.8022, 22.3039],
  anand: [72.9289, 22.5645], kandla: [70.2167, 23.0333], hyderabad: [78.4867, 17.385], medchal: [78.4815, 17.6297],
  secunderabad: [78.4983, 17.4399], chennai: [80.2707, 13.0827], coimbatore: [76.9558, 11.0168], madurai: [78.1198, 9.9252],
  lucknow: [80.9462, 26.8467], kanpur: [80.3319, 26.4499], barabanki: [81.1958, 26.9268], varanasi: [82.9739, 25.3176],
  agra: [78.0081, 27.1767], jaipur: [75.7873, 26.9124], jodhpur: [73.0243, 26.2389], udaipur: [73.7125, 24.5854],
  indore: [75.8577, 22.7196], bhopal: [77.4126, 23.2599], chandigarh: [76.7794, 30.7333], ludhiana: [75.8573, 30.901],
  amritsar: [74.8723, 31.634], patna: [85.1376, 25.5941], bhubaneswar: [85.8245, 20.2961], kochi: [76.2673, 9.9312],
  thiruvananthapuram: [76.9366, 8.5241], guwahati: [91.7362, 26.1445], ranchi: [85.3096, 23.3441], raipur: [81.6296, 21.2514],
  dehradun: [78.0322, 30.3165], visakhapatnam: [83.2185, 17.6868], vijayawada: [80.648, 16.5062], goa: [74.124, 15.2993],
  panaji: [73.8278, 15.4909], bicholim: [73.9551, 15.5895], moga: [75.1717, 30.8165], rudrapur: [79.4048, 28.9845],
  pantnagar: [79.475, 29.0222], sanand: [72.3811, 22.9921], hosur: [77.8253, 12.7409], manesar: [76.9366, 28.3544],
};

const STATES: Record<string, LngLat> = {
  maharashtra: [75.7139, 19.7515], 'uttar pradesh': [80.9462, 26.8467], up: [80.9462, 26.8467], karnataka: [75.7139, 15.3173],
  'tamil nadu': [78.6569, 11.1271], 'west bengal': [87.855, 22.9868], gujarat: [71.1924, 22.2587], rajasthan: [74.2179, 27.0238],
  telangana: [79.0193, 18.1124], 'andhra pradesh': [79.74, 15.9129], kerala: [76.2711, 10.8505], punjab: [75.3412, 31.1471],
  haryana: [76.0856, 29.0588], 'madhya pradesh': [78.6569, 22.9734], bihar: [85.3131, 25.0961], odisha: [85.0985, 20.9517],
  assam: [92.9376, 26.2006], jharkhand: [85.2799, 23.6102], chhattisgarh: [81.8661, 21.2787], uttarakhand: [79.0193, 30.0668],
  'himachal pradesh': [77.1734, 31.1048], goa: [74.124, 15.2993], 'delhi-ncr': [77.209, 28.6139], ncr: [77.209, 28.6139],
};

export interface Placed {
  lngLat: LngLat;
  precision: 'city' | 'state';
}

export function placeLocation(location: string): Placed | null {
  const parts = location
    .toLowerCase()
    .replace(/\[.*?\]/g, ' ')
    .split(/[,/]| - /)
    .map((p) => p.trim())
    .filter((p) => p && p !== 'india');
  for (const p of parts) {
    if (CITIES[p]) return { lngLat: CITIES[p], precision: 'city' };
  }
  for (const p of parts) {
    for (const [name, ll] of Object.entries(CITIES)) if (p.includes(name)) return { lngLat: ll, precision: 'city' };
  }
  for (const p of [...parts].reverse()) {
    if (STATES[p]) return { lngLat: STATES[p], precision: 'state' };
    for (const [name, ll] of Object.entries(STATES)) if (p === name || p.endsWith(` ${name}`)) return { lngLat: ll, precision: 'state' };
  }
  return null;
}
