export function isChromium() {
  const isChrome = !!window.chrome;
  const isEdge = navigator.userAgent.indexOf('Edg') !== -1;
  const isBrave = navigator.userAgent.indexOf('Brave') !== -1;
  return isChrome || isEdge || isBrave;
}

export async function detectExtension() {
  if (!isChromium()) {
    return false;
  }

  return new Promise((resolve) => {
    const checkExtensionMarker = () => {
      return document.documentElement.hasAttribute('data-promptroot-extension');
    };

    if (checkExtensionMarker()) {
      resolve(true);
      return;
    }
    
    const timeout = setTimeout(() => {
      resolve(checkExtensionMarker());
    }, 300);

    const observer = new MutationObserver(() => {
      if (checkExtensionMarker()) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(true);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-promptroot-extension']
    });
  });
}
