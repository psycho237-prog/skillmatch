import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';

export default function OTPStatus() {
  const [status, setStatus] = useState('connecting');
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      const data = await api.request('/auth/status');
      setStatus(data.status);
      setQr(data.qr);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setStatus('disconnected');
      setQr(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // Polling every 3s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">WhatsApp OTP Gateway</h2>
          <p className="text-sm text-gray-500 mt-1">Gérez la connexion de votre bot WhatsApp pour l'envoi des codes OTP.</p>
        </div>
        <div>
          {status === 'connected' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Connecté
            </span>
          )}
          {status === 'connecting' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
              Connexion en cours...
            </span>
          )}
          {status === 'disconnected' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Déconnecté
            </span>
          )}
        </div>
      </div>

      <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-center max-w-md">
            <p className="font-bold mb-1">Erreur de connexion à l'API</p>
            <p className="text-sm">{error}</p>
            <p className="text-xs mt-2 opacity-80">Vérifiez que le conteneur otp-baileys-api est en cours d'exécution.</p>
          </div>
        )}

        {status === 'connected' ? (
          <div className="text-center">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
              ✓
            </div>
            <h3 className="text-lg font-bold text-gray-900">Le bot WhatsApp est prêt</h3>
            <p className="text-gray-500 max-w-md mx-auto mt-2">
              Votre serveur peut désormais envoyer des codes OTP aux utilisateurs. Aucun QR code n'est requis.
            </p>
          </div>
        ) : qr ? (
          <div className="text-center flex flex-col items-center">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Scanner le QR Code</h3>
            <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm inline-block">
              <QRCodeSVG value={qr} size={256} />
            </div>
            <p className="text-gray-500 max-w-md mx-auto mt-4 text-sm">
              Ouvrez WhatsApp sur le téléphone qui servira de passerelle, allez dans "Appareils connectés" et scannez ce code.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Génération du QR Code ou tentative de reconnexion en cours...</p>
          </div>
        )}
      </div>
    </div>
  );
}
