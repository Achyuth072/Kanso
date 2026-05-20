export const getPlatformKey = () => {
  if (typeof window === "undefined") return "Ctrl"; // Default for SSR
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? "⌘" : "Ctrl";
};

export const isMac = () => {
  if (typeof window === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
};
