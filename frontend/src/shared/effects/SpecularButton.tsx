import type { ComponentPropsWithoutRef, FC, ReactNode } from "react";

import SpecularButtonImpl from "./SpecularButtonImpl";

export type SpecularButtonProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "children"
> & {
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  /** When set, renders as React Router Link instead of button */
  to?: string;
};

const SpecularButton = SpecularButtonImpl as FC<SpecularButtonProps>;

export default SpecularButton;
