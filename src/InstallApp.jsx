import React, { useState, useEffect } from 'react';

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// "Install app" button. Android/Chrome installs with one tap; iPhones have no
// install prompt, so they get the Share -> Add to Home Screen steps instead.
export default function InstallApp({ className = '' }) {
  const [prompt, setPrompt] = useState(null);
  const [help, setHelp] = useState(false);
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (standalone()) return null;
  if (!prompt && !iOS) return null;

  const install = async () => {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else {
      setHelp(!help);
    }
  };

  return (
    <div className={className}>
      <button onClick={install} className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm font-semibold">
        📲 Install app
      </button>
      {help && (
        <p className="text-xs text-green-100 mt-2">
          On iPhone: tap the Share button in Safari, then "Add to Home Screen".
        </p>
      )}
    </div>
  );
}
