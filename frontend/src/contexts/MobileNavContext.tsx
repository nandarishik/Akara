import { createContext, useContext } from "react";

const MobileNavContext = createContext<(() => void) | null>(null);

export function MobileNavProvider({
  openNav,
  children,
}: {
  openNav: () => void;
  children: React.ReactNode;
}) {
  return (
    <MobileNavContext.Provider value={openNav}>{children}</MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  return useContext(MobileNavContext);
}
