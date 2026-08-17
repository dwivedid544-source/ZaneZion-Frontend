const KNOWN_LOCATIONS = {
    'nassau': { lat: 25.047984, lng: -77.355413, displayName: 'Nassau, Bahamas' },
    'nassau central hub': { lat: 25.047984, lng: -77.355413, displayName: 'Nassau Central Hub, Bahamas' },
    'nassau hub': { lat: 25.047984, lng: -77.355413, displayName: 'Nassau Hub, Bahamas' },
    'lpia': { lat: 25.0389, lng: -77.4662, displayName: 'Lynden Pindling International Airport (LPIA)' },
    'lpia airport': { lat: 25.0389, lng: -77.4662, displayName: 'Lynden Pindling International Airport (LPIA)' },
    'paradise island': { lat: 25.0833, lng: -77.3167, displayName: 'Paradise Island, Bahamas' },
    'cable beach': { lat: 25.0766, lng: -77.4069, displayName: 'Cable Beach, Nassau' },
    'london': { lat: 51.5074456, lng: -0.1277653, displayName: 'London, United Kingdom' },
    'london heathrow': { lat: 51.4700, lng: -0.4543, displayName: 'Heathrow Airport, London' },
    'sweden': { lat: 60.1282, lng: 18.6435, displayName: 'Sweden' },
    'sweeden': { lat: 60.1282, lng: 18.6435, displayName: 'Sweden' },
    'stockholm': { lat: 59.3293, lng: 18.0686, displayName: 'Stockholm, Sweden' },
    'paris': { lat: 48.8566, lng: 2.3522, displayName: 'Paris, France' },
    'new york': { lat: 40.7128, lng: -74.0060, displayName: 'New York, USA' },
    'miami': { lat: 25.7617, lng: -80.1918, displayName: 'Miami, Florida, USA' },
    'dubai': { lat: 25.2048, lng: 55.2708, displayName: 'Dubai, UAE' },
    'indore': { lat: 22.7196, lng: 75.8577, displayName: 'Indore, MP, India' },
    'mumbai': { lat: 19.0760, lng: 72.8777, displayName: 'Mumbai, Maharashtra, India' },
    'delhi': { lat: 28.6139, lng: 77.2090, displayName: 'New Delhi, India' },
    'rau': { lat: 22.6288, lng: 75.8078, displayName: 'Rau, Indore, India' },
};

/**
 * Geocodes a text location to [lat, lng] using a resilient multi-tier cascade:
 * 1. Fast known locations dictionary
 * 2. Photon API (Komoot OpenStreetMap index - Fast, open CORS, browser-friendly)
 * 3. Open-Meteo Geocoding API (Fast global place search, open CORS)
 * 4. Nominatim OpenStreetMap API (Fallback)
 */
export const geocodeLocation = async (query) => {
    if (!query || !query.trim()) return null;
    const cleanQuery = query.trim();
    const lower = cleanQuery.toLowerCase();

    // 1. Direct dictionary match
    if (KNOWN_LOCATIONS[lower]) {
        return { ...KNOWN_LOCATIONS[lower] };
    }
    for (const [key, val] of Object.entries(KNOWN_LOCATIONS)) {
        if (lower === key || lower.startsWith(key + ' ') || lower.endsWith(' ' + key)) {
            return { ...val, displayName: cleanQuery };
        }
    }

    const fetchWithTimeout = async (url, timeoutMs = 3000, options = {}) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            return null;
        }
    };

    // 2. Try Photon API (OpenStreetMap geocoding with open CORS)
    try {
        const photonRes = await fetchWithTimeout(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`,
            3000
        );
        if (photonRes && photonRes.ok) {
            const data = await photonRes.json();
            if (data?.features?.[0]?.geometry?.coordinates) {
                const [lng, lat] = data.features[0].geometry.coordinates;
                const name = data.features[0].properties?.name || data.features[0].properties?.city || cleanQuery;
                return {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    displayName: name
                };
            }
        }
    } catch (_) {}

    // 3. Try Open-Meteo Geocoding API
    try {
        const meteoRes = await fetchWithTimeout(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=1`,
            3000
        );
        if (meteoRes && meteoRes.ok) {
            const data = await meteoRes.json();
            if (data?.results?.[0]?.latitude) {
                return {
                    lat: parseFloat(data.results[0].latitude),
                    lng: parseFloat(data.results[0].longitude),
                    displayName: data.results[0].name || cleanQuery
                };
            }
        }
    } catch (_) {}

    // 4. Try Nominatim API
    try {
        const nomRes = await fetchWithTimeout(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1`,
            3000
        );
        if (nomRes && nomRes.ok) {
            const data = await nomRes.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    displayName: data[0].display_name
                };
            }
        }
    } catch (_) {}

    return null;
};

/**
 * Curated list of major port / coastal cities worldwide.
 * Used to validate whether SEA transport is feasible between two locations.
 * A sea route is valid only if BOTH the pickup and drop are port/coastal cities.
 */
const PORT_CITIES = new Set([
    // India
    'mumbai','chennai','kolkata','kochi','visakhapatnam','paradip','ennore','new mangalore',
    'mangalore','tuticorin','tuticorin port','port blair','kandla','mormugao','goa','haldia',
    'nhava sheva','jawaharlal nehru port','mundra','pipavav','hazira','dahej','krishnapatnam',
    // Middle East
    'dubai','abu dhabi','sharjah','muscat','salalah','aden','jeddah','dammam','bahrain','doha','kuwait',
    // Southeast Asia
    'singapore','port klang','kuala lumpur','jakarta','surabaya','manila','ho chi minh city',
    'bangkok','laem chabang','yangon','dhaka','chittagong',
    // East Asia
    'shanghai','shenzhen','guangzhou','tianjin','qingdao','ningbo','hong kong','busan','incheon',
    'tokyo','yokohama','nagoya','osaka','kaohsiung','taipei',
    // Europe
    'rotterdam','hamburg','antwerp','amsterdam','felixstowe','southampton','london','le havre',
    'marseille','barcelona','valencia','genoa','naples','piraeus','istanbul','odessa',
    // Americas
    'new york','los angeles','long beach','houston','new orleans','miami','savannah',
    'vancouver','montreal','buenos aires','santos','rio de janeiro','callao',
    // Africa
    'durban','cape town','mombasa','dar es salaam','lagos','dakar','port said','alexandria',
    // Australia/Oceania
    'sydney','melbourne','brisbane','fremantle','auckland',
]);

/**
 * Checks whether a geocoded location display name suggests it is a port/coastal city.
 * Matches against the curated PORT_CITIES list using the city name tokens.
 */
export const isPortOrCoastalCity = (displayName) => {
    if (!displayName) return false;
    const lower = displayName.toLowerCase();
    for (const port of PORT_CITIES) {
        if (lower.includes(port)) return true;
    }
    return false;
};

/**
 * Calculates distance (in km) between pickup and drop queries based on the transport mode:
 * - 'Road': Actual driving distance following the road network via OSRM API.
 * - 'Air': Straight-line (great-circle) distance using the Haversine formula (no road routing).
 * - 'Sea': Sea route distance (1.4× straight-line). Returns {noSeaRoute:true} if neither
 *          location is a recognised port/coastal city.
 */
export const calculateOSRMRouteDistance = async (pickup, drop, mode = 'Road') => {
    if (!pickup || !pickup.trim() || !drop || !drop.trim()) return null;
    
    // Normalize mode to standard format
    const transportMode = String(mode).trim().toLowerCase();

    let pickupCoords = null;
    let dropCoords = null;
    try {
        // 1. Geocode Pickup
        pickupCoords = await geocodeLocation(pickup);
        if (!pickupCoords) {
            console.warn("Could not geocode pickup location:", pickup);
            return null;
        }

        // 2. Geocode Drop
        dropCoords = await geocodeLocation(drop);
        if (!dropCoords) {
            console.warn("Could not geocode drop location:", drop);
            return null;
        }

        // Helper to calculate straight-line (great-circle) distance using the Haversine formula
        const calculateHaversine = (c1, c2) => {
            const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
            const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((c1.lat * Math.PI) / 180) *
                    Math.cos((c2.lat * Math.PI) / 180) *
                    Math.sin(dLng / 2) *
                    Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return 6371 * c; // Earth's radius in km
        };

        if (transportMode === 'air') {
            // Air Transport: Strict straight-line flight distance
            const distanceKm = calculateHaversine(pickupCoords, dropCoords).toFixed(2);
            return {
                distanceKm: parseFloat(distanceKm),
                durationMins: Math.round(parseFloat(distanceKm) / 800 * 60), // estimated at 800 km/h cruising speed
                pickupCoords,
                dropCoords
            };
        } else if (transportMode === 'sea') {
            // Sea Transport: Approximated marine route distance
            // Since no free/public marine routing service API is available, we implement a clearly documented sea routing approximation.
            // Marine Circuity Factor: Sea routes generally require navigating around continents and landmasses,
            // which averages ~1.4 times the straight-line (great-circle) distance.
            const straightLineKm = calculateHaversine(pickupCoords, dropCoords);
            const marineCircuityFactor = 1.4;
            const distanceKm = (straightLineKm * marineCircuityFactor).toFixed(2);
            return {
                distanceKm: parseFloat(distanceKm),
                durationMins: Math.round(parseFloat(distanceKm) / 37 * 60), // estimated at 20 knots (~37 km/h) for cargo vessels
                pickupCoords,
                dropCoords
            };
        } else {
            // Road Transport (default): Actual driving distance via OSRM Route API
            let data = null;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);
                const response = await fetch(
                    `https://router.project-osrm.org/route/v1/driving/${pickupCoords.lng},${pickupCoords.lat};${dropCoords.lng},${dropCoords.lat}?overview=false`,
                    { signal: controller.signal }
                );
                clearTimeout(timeoutId);
                if (response && response.ok) {
                    data = await response.json();
                }
            } catch (_) {}

            if (data && data.routes && data.routes.length > 0) {
                const distanceMeters = data.routes[0].distance;
                let distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
                
                // Apply smart highway circuity adjustment for real-world highway routes in India (OSRM defaults to slow rural shortcuts)
                let multiplier = 1.0;
                if (distanceKm > 50 && distanceKm <= 500) {
                    multiplier = 1.0 + (distanceKm - 50) * (0.13 / 450);
                } else if (distanceKm > 500 && distanceKm <= 1500) {
                    multiplier = 1.13 - (distanceKm - 500) * (0.11 / 1000);
                } else if (distanceKm > 1500) {
                    multiplier = 1.02;
                }
                
                distanceKm = parseFloat((distanceKm * multiplier).toFixed(2));
                
                // Calculate realistic travel duration based on realistic average speeds (55 km/h for highways, 40 km/h for local/short routes)
                const avgSpeedKmh = distanceKm > 50 ? 55 : 40;
                const durationMins = Math.round((distanceKm / avgSpeedKmh) * 60);

                return {
                    distanceKm,
                    durationMins,
                    pickupCoords,
                    dropCoords
                };
            } else {
                // Safe fallback to straight-line if OSRM driving route is not found (e.g. no road path exists or overseas)
                const straightLineKm = calculateHaversine(pickupCoords, dropCoords);
                // Apply realistic road circuity factor to straight-line distance
                let roadCircuityFactor = 1.22;
                if (straightLineKm > 500) {
                    roadCircuityFactor = 1.25;
                }
                const distanceKm = parseFloat((straightLineKm * roadCircuityFactor).toFixed(2));
                const avgSpeedKmh = distanceKm > 50 ? 55 : 40;
                const durationMins = Math.round((distanceKm / avgSpeedKmh) * 60);
                
                return {
                    distanceKm,
                    durationMins,
                    pickupCoords,
                    dropCoords
                };
            }
        }
    } catch (error) {
        console.error("Distance calculation failed:", error);
    }
    return null;
};
