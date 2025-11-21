const defaultScene = {
    sceneId: 'local-circle-slide',
    name: 'circle-slide',
    schemaVersion: '1.0.0',
    durationMillis: 2400,
    elements: [
        {
            elementId: 'local-circle',
            primitiveType: 'CIRCLE',
            startMillis: 0,
            durationMillis: 2400,
            circle: {
                centerX: 0,
                centerY: 0,
                radius: 160,
                style: {
                    strokeColor: '#1F2933',
                    fillColor: '#F56565',
                    lineWidth: 12
                }
            },
            tweens: [
                {
                    propertyPath: 'positionX',
                    keyframes: [
                        {
                            timeMillis: 0,
                            value: -320,
                            easing: 'easeInOut'
                        },
                        {
                            timeMillis: 2400,
                            value: 320,
                            easing: 'easeInOut'
                        }
                    ]
                }
            ]
        }
    ]
};
const fallbackBaseUrl = 'http://localhost:8081';
function getResolvedBaseUrl(baseUrl) {
    if (baseUrl)
        return baseUrl;
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl && !envUrl.includes('host.docker.internal')) {
        return envUrl;
    }
    return fallbackBaseUrl;
}
export async function fetchCircleSlideScene(baseUrl) {
    const resolvedBaseUrl = getResolvedBaseUrl(baseUrl);
    try {
        const response = await fetch(`${resolvedBaseUrl}/api/v1/animations/circle-slide`);
        if (!response.ok) {
            console.error('Failed to fetch scene', response.status, response.statusText);
            return defaultScene;
        }
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching scene', error);
        return defaultScene;
    }
}
export async function fetchClientServerScene(baseUrl) {
    const resolvedBaseUrl = getResolvedBaseUrl(baseUrl);
    try {
        const response = await fetch(`${resolvedBaseUrl}/api/v1/animations/client-server`);
        if (!response.ok) {
            console.error('Failed to fetch client-server scene', response.status, response.statusText);
            throw new Error('Failed to fetch scene');
        }
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching client-server scene', error);
        throw error;
    }
}
export async function fetchDominoFallScene(baseUrl) {
    const resolvedBaseUrl = getResolvedBaseUrl(baseUrl);
    try {
        const response = await fetch(`${resolvedBaseUrl}/api/v1/animations/domino-fall`);
        if (!response.ok) {
            console.error('Failed to fetch domino-fall scene', response.status, response.statusText);
            throw new Error('Failed to fetch scene');
        }
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching domino-fall scene', error);
        throw error;
    }
}
