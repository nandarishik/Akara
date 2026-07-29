import type { CSSProperties, ReactNode } from "react";

import FolderImpl from "./FolderImpl";

export type FolderProps = {
  color?: string;
  size?: number;
  items?: ReactNode[];
  className?: string;
  style?: CSSProperties;
};

const Folder = FolderImpl as React.FC<FolderProps>;

export default Folder;
