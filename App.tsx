
import React, { useState, useEffect, useCallback } from 'react';
import { LoginPage } from './components/LoginPage';
import { MainApp } from './MainApp';

// For simplicity in this demo, the password is hardcoded.
// In a real application, this would be handled by a backend server.
const ADMIN_PASSWORD = 'jaga-pohon-admin';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check session storage on initial load
    try {
      const loggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
      setIsAuthenticated(loggedIn);
    } catch (e) {
      console.error("Could not access session storage", e);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async (password: string): Promise<boolean> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (password === ADMIN_PASSWORD) {
      try {
        sessionStorage.setItem('isLoggedIn', 'true');
      } catch (e) {
        console.error("Could not set session storage", e);
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const handleLogout = useCallback(() => {
    try {
      sessionStorage.removeItem('isLoggedIn');
    } catch (e) {
      console.error("Could not clear session storage", e);
    }
    setIsAuthenticated(false);
  }, []);
  
  if (isLoading) {
    // Render a blank screen during the initial check to prevent flicker
    return <div className="min-h-screen bg-green-50/50" />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <MainApp onLogout={handleLogout} />;
};

export default App;
