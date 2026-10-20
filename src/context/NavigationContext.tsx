import React, { createContext, useContext } from 'react';
import { AuthMode, SupportCategory, ViewState } from '../types';

export interface NavigationHandlers {
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateMailbox: () => void;
  onNavigateDiscussions: (tab?: 'unopened' | 'mailbox') => void;
  onNavigateReports: () => void;
  onNavigateAdminReports: () => void;
  onNavigateAdminSupport: () => void;
  onNavigateAdmin: () => void;
  onNavigateMemberManagement: () => void;
  onNavigateGames: () => void;
  onNavigateTeenSpace: () => void;
  onNavigateLounge: () => void;
  onNavigateRules: () => void;
  onNavigateSchedules: () => void;
  onOpenContactSupport: (category?: SupportCategory) => void;
  onOpenEmergencyModal: () => void;
  onOpenAuth: (mode: AuthMode) => void;
  onTalkAnonymously: () => void;
  onSignOut: () => void;
}

const NavigationContext = createContext<NavigationHandlers | null>(null);

export const NavigationProvider: React.FC<{
  value: NavigationHandlers;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export function useNavigation(): NavigationHandlers | null {
  return useContext(NavigationContext);
}
