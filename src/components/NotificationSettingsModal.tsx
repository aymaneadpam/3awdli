import React, { useState } from 'react';
import { 
  Bell, 
  BellOff, 
  BellRing, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ExternalLink, 
  Sparkles,
  Laptop,
  Smartphone,
  Info
} from 'lucide-react';
import { 
  getNotificationPermission, 
  requestListenerNotificationPermission, 
  sendDiscussionWaitingNotification,
  NotificationPermissionStatus 
} from '../utils/listenerNotificationService';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPermission: NotificationPermissionStatus;
  onPermissionChange: (status: NotificationPermissionStatus) => void;
}

export function NotificationSettingsModal({
  isOpen,
  onClose,
  currentPermission,
  onPermissionChange,
}: NotificationSettingsModalProps) {
  const [testSent, setTestSent] = useState(false);
  const [activeBrowserTab, setActiveBrowserTab] = useState<'chrome' | 'firefox' | 'safari' | 'mobile'>('chrome');

  if (!isOpen) return null;

  const handleRequest = async () => {
    const res = await requestListenerNotificationPermission();
    onPermissionChange(res);
  };

  const handleTestNotification = () => {
    const success = sendDiscussionWaitingNotification(1, 'Demo Verification');
    if (success) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#E8E1D5] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#315243] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-200 border border-white/15">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-['Lora',serif]">
                Listener Waiting Alerts
              </h3>
              <p className="text-xs text-[#D5E5DC]">
                Get notified when visitors need a listener while you are free
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-[#24362C]">
          {/* Current Status Banner */}
          <div className="p-4 rounded-2xl border flex items-start gap-3 bg-[#FAF8F5] border-[#E8E1D5]">
            {currentPermission === 'granted' ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Alerts Active
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                  <p className="text-xs text-[#4E6155] leading-relaxed">
                    Browser notifications are enabled. You will receive an alert whenever a new discussion arrives in the waiting queue and you have no active conversations.
                  </p>
                  <button
                    onClick={handleTestNotification}
                    className="mt-2 px-3 py-1.5 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-medium rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{testSent ? 'Test Alert Dispatched!' : 'Send Test Notification'}</span>
                  </button>
                </div>
              </>
            ) : currentPermission === 'denied' ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <BellOff className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                      Blocked in Browser
                    </span>
                  </div>
                  <p className="text-xs text-[#5D4E37] leading-relaxed">
                    Notifications are currently blocked by your browser settings. To receive waiting queue alerts, you can manually re-enable them below.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-[#E8EFEA] text-[#315243] flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <span className="text-xs font-bold text-[#315243] uppercase tracking-wider">
                    Permission Not Yet Granted
                  </span>
                  <p className="text-xs text-[#526359] leading-relaxed">
                    Enable notifications so you never miss an incoming visitor while your schedule is open.
                  </p>
                  <button
                    onClick={handleRequest}
                    className="mt-2 px-3.5 py-1.5 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Enable Browser Notifications</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Behavior Rules Explanation */}
          <div className="p-3.5 rounded-2xl bg-[#F4EFE7]/80 border border-[#E6DECة] space-y-1.5 text-xs text-[#516358]">
            <div className="flex items-center gap-1.5 font-bold text-[#20352A]">
              <Info className="w-4 h-4 text-[#315243]" />
              <span>Smart Notification Rules</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11.5px] text-[#55695D]">
              <li>
                <strong>Free Listeners Only:</strong> Alerts are only dispatched when you have zero ongoing active discussions and are free to connect.
              </li>
              <li>
                <strong>Zero Distractions:</strong> If you are already in an open discussion with someone, no notifications will interrupt your session.
              </li>
              <li>
                <strong>Privacy Respect:</strong> If you decline permission, we respect your choice and will not spam you with repeated prompts.
              </li>
            </ul>
          </div>

          {/* Step-by-step instructions to manually turn permission back on */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#23352A] uppercase tracking-wider flex items-center gap-1.5">
              <span>How to re-enable in your browser settings:</span>
            </h4>

            {/* Browser Tabs */}
            <div className="flex border-b border-[#E8E1D5] gap-1">
              <button
                onClick={() => setActiveBrowserTab('chrome')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 cursor-pointer transition-colors ${
                  activeBrowserTab === 'chrome'
                    ? 'border-[#315243] text-[#315243] font-bold'
                    : 'border-transparent text-[#77887E] hover:text-[#23352A]'
                }`}
              >
                Chrome / Edge / Brave
              </button>
              <button
                onClick={() => setActiveBrowserTab('firefox')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 cursor-pointer transition-colors ${
                  activeBrowserTab === 'firefox'
                    ? 'border-[#315243] text-[#315243] font-bold'
                    : 'border-transparent text-[#77887E] hover:text-[#23352A]'
                }`}
              >
                Firefox
              </button>
              <button
                onClick={() => setActiveBrowserTab('safari')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 cursor-pointer transition-colors ${
                  activeBrowserTab === 'safari'
                    ? 'border-[#315243] text-[#315243] font-bold'
                    : 'border-transparent text-[#77887E] hover:text-[#23352A]'
                }`}
              >
                Safari (Mac)
              </button>
              <button
                onClick={() => setActiveBrowserTab('mobile')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 cursor-pointer transition-colors ${
                  activeBrowserTab === 'mobile'
                    ? 'border-[#315243] text-[#315243] font-bold'
                    : 'border-transparent text-[#77887E] hover:text-[#23352A]'
                }`}
              >
                Mobile
              </button>
            </div>

            {/* Step content */}
            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E8E1D5] text-xs text-[#46574D] space-y-2">
              {activeBrowserTab === 'chrome' && (
                <ol className="list-decimal pl-4 space-y-1.5 text-[11.5px]">
                  <li>
                    Look at the address bar at the very top of your browser (where the URL is).
                  </li>
                  <li>
                    Click the <strong>Padlock</strong> or <strong>Tune icon</strong> (View site information) located directly to the left of the website URL.
                  </li>
                  <li>
                    Find <strong>Notifications</strong> in the menu and toggle it to <strong>Allow</strong> (or switch from "Block" to "Allow").
                  </li>
                  <li>
                    Refresh the page. Notifications will now be active!
                  </li>
                </ol>
              )}

              {activeBrowserTab === 'firefox' && (
                <ol className="list-decimal pl-4 space-y-1.5 text-[11.5px]">
                  <li>
                    Click the <strong>Padlock</strong> or <strong>crossed-out Bell icon</strong> on the left side of the address bar.
                  </li>
                  <li>
                    Under the <strong>Permissions</strong> section, locate <strong>Send Notifications</strong>.
                  </li>
                  <li>
                    Click the <strong>&quot;X&quot; (Clear)</strong> button next to &quot;Blocked&quot; so the browser can ask again, or select <strong>Allow</strong>.
                  </li>
                  <li>
                    Reload the page to start receiving alerts.
                  </li>
                </ol>
              )}

              {activeBrowserTab === 'safari' && (
                <ol className="list-decimal pl-4 space-y-1.5 text-[11.5px]">
                  <li>
                    In the Apple menu bar at the very top of your screen, click <strong>Safari &gt; Settings (or Preferences)</strong>.
                  </li>
                  <li>
                    Click the <strong>Websites</strong> tab at the top of the settings window.
                  </li>
                  <li>
                    Select <strong>Notifications</strong> from the list on the left side.
                  </li>
                  <li>
                    Find this website in the list and change its permission dropdown from <strong>Deny</strong> to <strong>Allow</strong>.
                  </li>
                </ol>
              )}

              {activeBrowserTab === 'mobile' && (
                <ol className="list-decimal pl-4 space-y-1.5 text-[11.5px]">
                  <li>
                    On Android Chrome: Tap the <strong>Padlock or Tune icon</strong> in the address bar &gt; tap <strong>Permissions</strong> &gt; set <strong>Notifications</strong> to <strong>Allow</strong>.
                  </li>
                  <li>
                    On iPhone / iPad (Safari): Ensure the site is added to your Home Screen (PWA) if you wish to receive system web push notifications on iOS 16.4+.
                  </li>
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F5EFE6] border-t border-[#E8E1D5] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#315243] hover:bg-[#253E33] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
