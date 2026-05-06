'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { luminaStorage, ChatSession } from '@/lib/db';

interface HistoryContextType {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  createSession: () => string;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  updateSession: (id: string, updates: Partial<ChatSession>) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

// Helper to generate UUID if crypto.randomUUID is not available
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await luminaStorage.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const createSession = useCallback(() => {
    const newId = generateId();
    setCurrentSessionId(newId);
    return newId;
  }, []);

  const selectSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    // Optimistic UI update
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
    await luminaStorage.deleteSession(id);
  }, [currentSessionId]);

  const updateSession = useCallback(async (id: string, updates: Partial<ChatSession>) => {
    const existing = await luminaStorage.getSession(id);
    
    const title = (existing?.title && existing.title !== '新对话') 
      ? existing.title 
      : (updates.title || existing?.title || '新对话');

    const session: ChatSession = existing 
      ? { ...existing, ...updates, title, updatedAt: Date.now() }
      : { 
          id, 
          title: updates.title || '新对话', 
          messages: updates.messages || [], 
          updatedAt: Date.now() 
        };
    
    // Optimistic UI update
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = session;
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      } else {
        return [session, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
      }
    });

    await luminaStorage.saveSession(session);
  }, []);

  return (
    <HistoryContext.Provider value={{
      sessions,
      currentSessionId,
      isLoading,
      createSession,
      selectSession,
      deleteSession,
      updateSession,
      refreshSessions
    }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
