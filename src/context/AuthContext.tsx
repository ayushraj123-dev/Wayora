/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  onSnapshot 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../services/firebase';
import { UserProfile, SavedRoute, RouteOption } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  savedRoutes: SavedRoute[];
  loading: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  signInWithGoogle: () => Promise<void>;
  continueAsGuest: () => void;
  signOutUser: () => Promise<void>;
  saveRoute: (route: RouteOption) => Promise<void>;
  removeSavedRoute: (routeId: string) => Promise<void>;
  updateUserPreferences: (prefs: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Monitor Auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setSavedRoutes([]);
        setLoading(false);
        return;
      }

      const userPath = `users/${currentUser.uid}`;
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // Initialize fresh user profile doc
          const initialProfile: UserProfile = {
            userId: currentUser.uid,
            email: currentUser.email || 'user@wayora.app',
            displayName: currentUser.displayName || 'Jaipur Traveler',
            photoURL: currentUser.photoURL || '',
            defaultOriginId: 'mansarovar-terminal',
            defaultDestinationId: 'badi-chaupar',
            preferredMode: 'all',
            wheelchairAccessible: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(userDocRef, initialProfile);
          setProfile(initialProfile);
        } else {
          setProfile(userDocSnap.data() as UserProfile);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, userPath);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to User Profile changes in real-time
  useEffect(() => {
    if (!user || user.uid === 'guest-jaipur-traveler') return;
    const userPath = `users/${user.uid}`;
    const unsubscribeProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, userPath);
      }
    );

    // Listen to Saved Routes subcollection in real-time
    const routesPath = `users/${user.uid}/savedRoutes`;
    const unsubscribeRoutes = onSnapshot(
      collection(db, 'users', user.uid, 'savedRoutes'),
      (snap) => {
        const routes: SavedRoute[] = [];
        snap.forEach((d) => routes.push(d.data() as SavedRoute));
        setSavedRoutes(routes.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, routesPath);
      }
    );

    return () => {
      unsubscribeProfile();
      unsubscribeRoutes();
    };
  }, [user]);

  // Google Login popup with graceful cancellation handling
  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      const code = firebaseErr?.code || '';

      // Gracefully handle normal user actions without console errors
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User closed or dismissed the popup window - harmless
        return;
      }
      if (code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups or continue as Demo Traveler.');
        return;
      }
      setAuthError('Sign-in was not completed. You can try again or continue as Demo Traveler.');
    }
  };

  // Guest / Demo Traveler mode for instant access without external popup requirements
  const continueAsGuest = () => {
    setAuthError(null);
    const guestUser: Partial<User> = {
      uid: 'guest-jaipur-traveler',
      displayName: 'Jaipur Explorer (Guest)',
      email: 'explorer@jaipur.demo',
      photoURL: ''
    };
    const guestProfile: UserProfile = {
      userId: 'guest-jaipur-traveler',
      email: 'explorer@jaipur.demo',
      displayName: 'Jaipur Explorer (Guest)',
      photoURL: '',
      defaultOriginId: 'jaipur-junction',
      defaultDestinationId: 'sms-hospital',
      preferredMode: 'all',
      wheelchairAccessible: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setUser(guestUser as User);
    setProfile(guestProfile);
    setSavedRoutes([
      {
        id: 'saved-sample-pink-metro',
        userId: 'guest-jaipur-traveler',
        title: 'Jaipur Metro Pink Line Rapid Corridor',
        originName: 'Jaipur Junction',
        destinationName: 'Badi Chaupar (Hawa Mahal)',
        originId: 'jaipur-junction',
        destinationId: 'badi-chaupar',
        durationMinutes: 14,
        fare: 18,
        categoryTag: 'Fastest Choice',
        savedAt: new Date().toISOString()
      }
    ]);
  };

  // Sign out
  const signOutUser = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore
    }
    setUser(null);
    setProfile(null);
    setSavedRoutes([]);
  };

  // Save / Bookmark Route to Firestore or local guest session
  const saveRoute = async (route: RouteOption) => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    const routeData: SavedRoute = {
      id: route.id,
      userId: user.uid,
      title: route.title,
      originName: route.legs[0]?.from.name || 'Origin',
      destinationName: route.legs[route.legs.length - 1]?.to.name || 'Destination',
      originId: route.legs[0]?.from.id || 'origin',
      destinationId: route.legs[route.legs.length - 1]?.to.id || 'destination',
      durationMinutes: route.totalDurationMinutes,
      fare: route.totalCost,
      categoryTag: route.categoryTag,
      savedAt: new Date().toISOString()
    };

    if (user.uid === 'guest-jaipur-traveler') {
      setSavedRoutes((prev) => [routeData, ...prev.filter((r) => r.id !== route.id)]);
      return;
    }

    const path = `users/${user.uid}/savedRoutes/${route.id}`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'savedRoutes', route.id), routeData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Remove saved route
  const removeSavedRoute = async (routeId: string) => {
    if (!user) return;
    if (user.uid === 'guest-jaipur-traveler') {
      setSavedRoutes((prev) => prev.filter((r) => r.id !== routeId));
      return;
    }
    const path = `users/${user.uid}/savedRoutes/${routeId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedRoutes', routeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Update profile preferences
  const updateUserPreferences = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    if (user.uid === 'guest-jaipur-traveler') {
      setProfile((prev) => prev ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : null);
      return;
    }
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        savedRoutes,
        loading,
        authError,
        setAuthError,
        signInWithGoogle,
        continueAsGuest,
        signOutUser,
        saveRoute,
        removeSavedRoute,
        updateUserPreferences
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
