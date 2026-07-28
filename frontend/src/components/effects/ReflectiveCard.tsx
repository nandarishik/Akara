import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Activity, Fingerprint, Lock } from "lucide-react";

import "./ReflectiveCard.css";

export type ReflectiveCardProps = {
  blurStrength?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  overlayColor?: string;
  displacementStrength?: number;
  noiseScale?: number;
  specularConstant?: number;
  grayscale?: number;
  glassDistortion?: number;
  className?: string;
  style?: React.CSSProperties;
  badgeText?: string;
  planName?: string;
  planPrice?: string;
  planId?: string;
  features?: string[];
  footer?: ReactNode;
  popular?: boolean;
  variant?: "default" | "plan";
};

export default function ReflectiveCard({
  blurStrength = 12,
  color = "white",
  metalness = 1,
  roughness = 0.4,
  overlayColor = "rgba(255, 255, 255, 0.08)",
  displacementStrength = 20,
  noiseScale = 1,
  specularConstant = 1.2,
  grayscale = 0.5,
  glassDistortion = 15,
  className = "",
  style = {},
  badgeText = "SECURE BILLING",
  planName = "AKARA PRO",
  planPrice = "₹7,999 / month",
  planId = "AKR-8901-****-6789",
  features,
  footer,
  popular = false,
  variant = "default",
}: ReflectiveCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOk, setCameraOk] = useState(false);
  const filterId = useId().replace(/:/g, "");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    const startWebcam = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraOk(true);
        }
      } catch {
        setCameraOk(false);
      }
    };

    startWebcam();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const baseFrequency = 0.03 / Math.max(0.1, noiseScale);
  const saturation = 1 - Math.max(0, Math.min(1, grayscale));

  const cssVariables = {
    "--blur-strength": `${blurStrength}px`,
    "--metalness": metalness,
    "--roughness": roughness,
    "--overlay-color": overlayColor,
    "--text-color": color,
    "--saturation": saturation,
    "--filter-id": filterId,
  } as React.CSSProperties;

  return (
    <div
      className={`reflective-card-container${variant === "plan" ? " reflective-card-container--plan" : ""} ${className}`}
      style={{ ...style, ...cssVariables }}
    >
      <svg className="reflective-svg-filters" aria-hidden="true">
        <defs>
          <filter id={`metallic-displacement-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
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

      {cameraOk ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="reflective-video"
          style={{ filter: `saturate(var(--saturation, 0)) contrast(120%) brightness(110%) blur(var(--blur-strength, 12px)) url(#metallic-displacement-${filterId})` }}
        />
      ) : (
        <div className="reflective-fallback" aria-hidden />
      )}

      <div className="reflective-noise" />
      <div className="reflective-sheen" />
      <div className="reflective-border" />

      <div className="reflective-content">
        {popular && (
          <div className="reflective-popular-badge">Most popular</div>
        )}
        <div className="card-header">
          <div className="security-badge">
            <Lock size={14} className="security-icon" />
            <span>{badgeText}</span>
          </div>
          <Activity className="status-icon" size={20} />
        </div>

        <div className="card-body">
          <div className="user-info">
            <h2 className="user-name">{planName}</h2>
            <p className="user-role">{planPrice}</p>
          </div>
          {features && features.length > 0 && (
            <ul className="reflective-features">
              {features.map((f) => (
                <li key={f}>
                  <span className="reflective-features__check" aria-hidden>✓</span>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-footer">
          {footer ? (
            <div className="reflective-footer-slot">{footer}</div>
          ) : (
            <>
              <div className="id-section">
                <span className="label">PLAN ID</span>
                <span className="value">{planId}</span>
              </div>
              <div className="fingerprint-section">
                <Fingerprint size={32} className="fingerprint-icon" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
