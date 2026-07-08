/**
 * Geocodes a text location to [lat, lng] using OpenStreetMap Nominatim API (Free & No API Key)
 * Supports smart right-to-left fallback matching for extremely specific local/neighborhood addresses.
 */
export const geocodeLocation = async (query) => {
    if (!query || !query.trim()) return null;
    
    const fetchGeocode = async (q) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
                {
                    headers: {
                        'Accept-Language': 'en',
                        'User-Agent': 'ZaneZion-App'
                    }
                }
            );
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    displayName: data[0].display_name
                };
            }
        } catch (e) {
            console.error("Geocoding fetch failed for:", q, e);
        }
        return null;
    };

    // 1. Try matching full search query
    let result = await fetchGeocode(query.trim());
    if (result) return result;

    // 2. Fallback: Right-to-left word extraction for local specific neighborhoods/landmarks
    const parts = query.trim().split(/\s+/);
    if (parts.length > 2) {
        // Try last 3 words
        const last3 = parts.slice(-3).join(' ');
        result = await fetchGeocode(last3);
        if (result) return result;

        // Try last 2 words
        const last2 = parts.slice(-2).join(' ');
        result = await fetchGeocode(last2);
        if (result) return result;

        // Try last 1 word
        const last1 = parts.slice(-1).join(' ');
        result = await fetchGeocode(last1);
        if (result) return result;
    }
    return null;
};

/**
 * Calculates driving distance (in km) between pickup and drop queries using OSRM API (Free & No API Key)
 */
export const calculateOSRMRouteDistance = async (pickup, drop) => {
    if (!pickup || !pickup.trim() || !drop || !drop.trim()) return null;
    try {
        // 1. Geocode Pickup
        const pickupCoords = await geocodeLocation(pickup);
        if (!pickupCoords) {
            console.warn("Could not geocode pickup location:", pickup);
            return null;
        }

        // 2. Geocode Drop
        const dropCoords = await geocodeLocation(drop);
        if (!dropCoords) {
            console.warn("Could not geocode drop location:", drop);
            return null;
        }

        // 3. Call OSRM Route API
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${pickupCoords.lng},${pickupCoords.lat};${dropCoords.lng},${dropCoords.lat}?overview=false`
        );
        const data = await response.json();
        if (data && data.routes && data.routes.length > 0) {
            const distanceMeters = data.routes[0].distance;
            const distanceKm = (distanceMeters / 1000).toFixed(2);
            return {
                distanceKm: parseFloat(distanceKm),
                durationMins: Math.round(data.routes[0].duration / 60),
                pickupCoords,
                dropCoords
            };
        }
    } catch (error) {
        console.error("OSRM Route calculation failed:", error);
    }
    return null;
};
