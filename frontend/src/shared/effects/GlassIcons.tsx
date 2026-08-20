import type React from 'react';
import './GlassIcons.css';

export const GRADIENT_MAPPING = {
  blue: 'linear-gradient(hsl(223, 90%, 50%), hsl(208, 90%, 50%))',
  purple: 'linear-gradient(hsl(283, 90%, 50%), hsl(268, 90%, 50%))',
  red: 'linear-gradient(hsl(3, 90%, 50%), hsl(348, 90%, 50%))',
  indigo: 'linear-gradient(hsl(253, 90%, 50%), hsl(238, 90%, 50%))',
  orange: 'linear-gradient(hsl(43, 90%, 50%), hsl(28, 90%, 50%))',
  green: 'linear-gradient(hsl(123, 90%, 40%), hsl(108, 90%, 40%))'
};

export type GlassIconColor = keyof typeof GRADIENT_MAPPING;

export type GlassIconsItem = {
  icon: React.ReactElement;
  color: GlassIconColor | string;
  label: string;
  customClass?: string;
};

type GlassIconsProps = {
  items: GlassIconsItem[];
  className?: string;
  columns?: 2 | 3 | 4 | 6;
};

const GlassIcons = ({ items, className, columns = 3 }: GlassIconsProps) => {
  const getBackgroundStyle = (color: GlassIconColor | string) => {
    if (GRADIENT_MAPPING[color as GlassIconColor]) {
      return { background: GRADIENT_MAPPING[color as GlassIconColor] };
    }
    return { background: color };
  };

  return (
    <div className={`icon-btns icon-btns--cols-${columns} ${className || ""}`}>
      {items.map((item, index) => (
        <button key={index} className={`icon-btn ${item.customClass || ''}`} aria-label={item.label} type="button">
          <span className="icon-btn__back" style={getBackgroundStyle(item.color)}></span>
          <span className="icon-btn__front">
            <span className="icon-btn__icon" aria-hidden="true">
              {item.icon}
            </span>
          </span>
          <span className="icon-btn__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default GlassIcons;

