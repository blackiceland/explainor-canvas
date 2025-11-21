export type KeyframeResponse = {
  timeMillis: number;
  value: number;
  easing: string;
};

export type PropertyTweenResponse = {
  propertyPath: string;
  keyframes: KeyframeResponse[];
};

type ShadowResponse = {
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
};

type StyleResponse = {
  fillColor: string;
  strokeColor: string;
  lineWidth: number;
  shadow?: ShadowResponse;
};

type CirclePropertiesResponse = {
  centerX: number;
  centerY: number;
  radius: number;
  style: StyleResponse;
};

type RectPropertiesResponse = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  radius: number;
  style: StyleResponse;
};

type LinePropertiesResponse = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  style: StyleResponse;
};

type TextPropertiesResponse = {
  text: string;
  centerX: number;
  centerY: number;
  fontSize: number;
  color: string;
  fontWeight: string;
};

export type ElementResponse = {
  elementId: string;
  primitiveType: string;
  startMillis: number;
  durationMillis: number;
  circle?: CirclePropertiesResponse;
  rect?: RectPropertiesResponse;
  line?: LinePropertiesResponse;
  text?: TextPropertiesResponse;
  tweens: PropertyTweenResponse[];
};

export type SceneResponse = {
  sceneId: string;
  name: string;
  schemaVersion: string;
  durationMillis: number;
  background?: string;
  elements: ElementResponse[];
};

const defaultScene: SceneResponse = {
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

function getResolvedBaseUrl(baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && !envUrl.includes('host.docker.internal')) {
    return envUrl;
  }
  return fallbackBaseUrl;
}

export async function fetchCircleSlideScene(baseUrl?: string): Promise<SceneResponse> {
  const resolvedBaseUrl = getResolvedBaseUrl(baseUrl);
  try {
    const response = await fetch(`${resolvedBaseUrl}/api/v1/animations/circle-slide`);
    if (!response.ok) {
      console.error('Failed to fetch scene', response.status, response.statusText);
      return defaultScene;
    }
    return (await response.json()) as SceneResponse;
  } catch (error) {
    console.error('Error fetching scene', error);
    return defaultScene;
  }
}

export async function fetchClientServerScene(baseUrl?: string): Promise<SceneResponse> {
  const resolvedBaseUrl = getResolvedBaseUrl(baseUrl);
  try {
    const response = await fetch(`${resolvedBaseUrl}/api/v1/animations/client-server`);
    if (!response.ok) {
      console.error('Failed to fetch client-server scene', response.status, response.statusText);
      return defaultScene;
    }
    return (await response.json()) as SceneResponse;
  } catch (error) {
    console.error('Error fetching client-server scene', error);
    return defaultScene;
  }
}

export async function fetchDominoFallScene(baseUrl?: string): Promise<SceneResponse> {
  const resolvedBaseUrl = getResolvedBaseUrl(baseUrl);
  try {
    const response = await fetch(`${resolvedBaseUrl}/api/v1/animations/domino-fall`);
    if (!response.ok) {
      console.error('Failed to fetch domino-fall scene', response.status, response.statusText);
      return defaultScene;
    }
    return (await response.json()) as SceneResponse;
  } catch (error) {
    console.error('Error fetching domino-fall scene', error);
    return defaultScene;
  }
}
