## Integrate the <ReflectiveCard /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: ReflectiveCard
### Variant: JavaScript + CSS
### Dependencies: lucide-react

---

### Usage Example
```jsx
import ReflectiveCard from './ReflectiveCard';

<div style={{ height: '600px', position: 'relative' }}>
  <ReflectiveCard
    overlayColor="rgba(0, 0, 0, 0.2)"
    blurStrength={10}
    glassDistortion={15}
    metalness={0.8}
    roughness={0.5}
    displacementStrength={25}
    noiseScale={1.5}
    specularConstant={2.0}
    grayscale={0.5}
    color="#ffffff"
  />
</div>

```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| blurStrength | number | 12 | The intensity of the blur effect (0-20px) |
| metalness | number | 1 | The opacity of the metallic sheen (0-1) |
| roughness | number | 0.4 | The opacity of the noise texture (0-1) |
| displacementStrength | number | 20 | Strength of the displacement (how much it warps) |
| noiseScale | number | 1 | Scale of the noise texture (size of the ripples) |
| specularConstant | number | 1.2 | Specular constant for the lighting (shininess) |
| grayscale | number | 1 | Grayscale intensity (0-1) |
| glassDistortion | number | 0 | Strength of the glass edge distortion |
| color | string | white | The base text color |
| overlayColor | string | rgba(255, 255, 255, 0.1) | The color of the overlay tint |

### Full Component Source
```jsx
import { useEffect, useRef } from 'react';
import './ReflectiveCard.css';
import { Fingerprint, Activity, Lock } from 'lucide-react';

const ReflectiveCard = ({
  blurStrength = 12,
  color = 'white',
  metalness = 1,
  roughness = 0.4,
  overlayColor = 'rgba(255, 255, 255, 0.1)',
  displacementStrength = 20,
  noiseScale = 1,
  specularConstant = 1.2,
  grayscale = 1,
  glassDistortion = 0,
  className = '',
  style = {}
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    let stream = null;

    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    };

    startWebcam();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const baseFrequency = 0.03 / Math.max(0.1, noiseScale);
  const saturation = 1 - Math.max(0, Math.min(1, grayscale));

  const cssVariables = {
    '--blur-strength': `${blurStrength}px`,
    '--metalness': metalness,
    '--roughness': roughness,
    '--overlay-color': overlayColor,
    '--text-color': color,
    '--saturation': saturation
  };

  return (
    <div className={`reflective-card-container ${className}`} style={{ ...style, ...cssVariables }}>
      <svg className="reflective-svg-filters" aria-hidden="true">
        <defs>
          <filter id="metallic-displacement" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="turbulence" baseFrequency={baseFrequency} numOctaves="2" result="noise" />
            <feColorMatrix in="noise" type="luminanceToAlpha" result="noiseAlpha" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={displacementStrength}
              xChannelSelector="R"
              yChannelSelector="G"
              result="rippled"
            />
            <feSpecularLighting
              in="noiseAlpha"
              surfaceScale={displacementStrength}
              specularConstant={specularConstant}
              specularExponent="20"
              lightingColor="#ffffff"
              result="light"
            >
              <fePointLight x="0" y="0" z="300" />
            </feSpecularLighting>
            <feComposite in="light" in2="rippled" operator="in" result="light-effect" />
            <feBlend in="light-effect" in2="rippled" mode="screen" result="metallic-result" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="solidAlpha"
            />
            <feMorphology in="solidAlpha" operator="erode" radius="45" result="erodedAlpha" />
            <feGaussianBlur in="erodedAlpha" stdDeviation="10" result="blurredMap" />
            <feComponentTransfer in="blurredMap" result="glassMap">
              <feFuncA type="linear" slope="0.5" intercept="0" />
            </feComponentTransfer>
            <feDisplacementMap
              in="metallic-result"
              in2="glassMap"
              scale={glassDistortion}
              xChannelSelector="A"
              yChannelSelector="A"
              result="final"
            />
          </filter>
        </defs>
      </svg>

      <video ref={videoRef} autoPlay playsInline muted className="reflective-video" />

      <div className="reflective-noise" />
      <div className="reflective-sheen" />
      <div className="reflective-border" />

      <div className="reflective-content">
        <div className="card-header">
          <div className="security-badge">
            <Lock size={14} className="security-icon" />
            <span>SECURE ACCESS</span>
          </div>
          <Activity className="status-icon" size={20} />
        </div>

        <div className="card-body">
          <div className="user-info">
            <h2 className="user-name">ALEXANDER DOE</h2>
            <p className="user-role">SENIOR DEVELOPER</p>
          </div>
        </div>

        <div className="card-footer">
          <div className="id-section">
            <span className="label">ID NUMBER</span>
            <span className="value">8901-2345-6789</span>
          </div>
          <div className="fingerprint-section">
            <Fingerprint size={32} className="fingerprint-icon" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReflectiveCard;

```

### Component CSS
```css
.reflective-card-container {
  position: relative;
  width: 320px;
  height: 500px;
  border-radius: 20px;
  overflow: hidden;
  background: #1a1a1a;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  isolation: isolate;
  font-family: 'Inter', sans-serif;
}

.reflective-svg-filters {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  opacity: 0;
}

.reflective-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.2) scaleX(-1);

  filter: saturate(var(--saturation, 0)) contrast(120%) brightness(110%) blur(var(--blur-strength, 12px))
    url(#metallic-displacement);

  z-index: 0;
  opacity: 0.9;
  transition: filter 0.3s ease;
}

.reflective-noise {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: var(--roughness, 0.4);
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

.reflective-sheen {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.1) 40%,
    rgba(255, 255, 255, 0) 50%,
    rgba(255, 255, 255, 0.1) 60%,
    rgba(255, 255, 255, 0.3) 100%
  );
  pointer-events: none;
  mix-blend-mode: overlay;
  opacity: var(--metalness, 1);
}

.reflective-border {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0.6) 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  z-index: 20;
  pointer-events: none;
}

.reflective-content {
  position: relative;
  z-index: 10;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 32px;
  color: var(--text-color, white);
  background: var(--overlay-color, rgba(255, 255, 255, 0.05));
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 16px;
}

.security-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status-icon {
  opacity: 0.8;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: end;
  align-items: center;
  text-align: center;
  gap: 24px;
  margin-bottom: 2em;
}

.user-name {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin: 0 0 8px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.user-role {
  font-size: 12px;
  letter-spacing: 0.2em;
  opacity: 0.7;
  margin: 0;
  text-transform: uppercase;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 24px;
}

.id-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 9px;
  letter-spacing: 0.1em;
  opacity: 0.6;
}

.value {
  font-family: monospace;
  font-size: 14px;
  letter-spacing: 0.05em;
}

.fingerprint-icon {
  opacity: 0.4;
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.
