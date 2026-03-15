/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  History, 
  BarChart3, 
  Settings, 
  LogOut, 
  LogIn,
  CheckCircle2,
  Clock,
  BookOpen,
  Briefcase,
  Dumbbell,
  MoreHorizontal,
  Trash2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { format, differenceInSeconds, startOfDay, endOfDay, subDays, isSameDay, parseISO } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db } from './firebase';
import { Category, FocusSession } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: { id: Category; icon: React.ReactNode; color: string }[] = [
  { id: 'Study', icon: <BookOpen className="w-4 h-4" />, color: 'bg-blue-500' },
  { id: 'Work', icon: <Briefcase className="w-4 h-4" />, color: 'bg-indigo-500' },
  { id: 'Exercise', icon: <Dumbbell className="w-4 h-4" />, color: 'bg-emerald-500' },
  { id: 'Other', icon: <MoreHorizontal className="w-4 h-4" />, color: 'bg-slate-500' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [activeTab, setActiveTab] = useState<'timer' | 'history' | 'stats'>('timer');
  
  // Timer State
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  const [initialSeconds, setInitialSeconds] = useState(25 * 60);
  const [selectedCategory, setSelectedCategory] = useState<Category>('Study');
  const [startTime, setStartTime] = useState<Date | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sessions Listener
  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }

    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      orderBy('startTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FocusSession[];
      setSessions(docs);
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Timer Logic
  useEffect(() => {
    if (isActive && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s - 1);
      }, 1000);
    } else if (seconds === 0 && isActive) {
      handleComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, seconds]);

  const handleStart = () => {
    if (!isActive) {
      setStartTime(new Date());
    }
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setSeconds(initialSeconds);
    setStartTime(null);
  };

  const handleComplete = async () => {
    setIsActive(false);
    const endTime = new Date();
    const duration = initialSeconds - seconds;

    if (user && startTime && duration > 10) {
      try {
        await addDoc(collection(db, 'sessions'), {
          userId: user.uid,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: duration,
          category: selectedCategory,
        });
      } catch (err) {
        console.error("Failed to save session:", err);
      }
    }
    
    setSeconds(initialSeconds);
    setStartTime(null);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleDeleteSession = async (id: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'sessions', id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Stats Data
  const statsData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const daySessions = sessions.filter(s => isSameDay(parseISO(s.startTime), date));
      const totalMinutes = daySessions.reduce((acc, s) => acc + s.duration, 0) / 60;
      return {
        name: format(date, 'EEE'),
        minutes: Math.round(totalMinutes),
        fullDate: format(date, 'MMM d'),
      };
    });
    return last7Days;
  }, [sessions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200">
      {/* Header */}
      <header className="max-w-2xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">FocusFlow</h1>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.displayName}</p>
              <button 
                onClick={handleLogout}
                className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-stone-200" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold">
                {user.displayName?.charAt(0)}
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-full text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'timer' && (
            <motion.div
              key="timer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12"
            >
              {/* Timer Display */}
              <div className="flex flex-col items-center justify-center py-12 space-y-8">
                <div className="relative">
                  <svg className="w-64 h-64 -rotate-90">
                    <circle
                      cx="128"
                      cy="128"
                      r="120"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-stone-200"
                    />
                    <motion.circle
                      cx="128"
                      cy="128"
                      r="120"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 120}
                      animate={{ strokeDashoffset: (2 * Math.PI * 120) * (1 - seconds / initialSeconds) }}
                      className="text-stone-900"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-6xl font-light tracking-tighter tabular-nums">
                      {formatTime(seconds)}
                    </span>
                    <span className="text-sm text-stone-500 font-medium uppercase tracking-widest mt-2">
                      {isActive ? 'Focusing' : 'Ready'}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6">
                  <button 
                    onClick={handleReset}
                    className="p-4 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={handleStart}
                    className="p-6 rounded-full bg-stone-900 text-white hover:scale-105 active:scale-95 transition-all shadow-xl shadow-stone-200"
                  >
                    {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
                  </button>
                  <button 
                    onClick={handleComplete}
                    disabled={!startTime}
                    className={cn(
                      "p-4 rounded-full transition-colors",
                      startTime ? "bg-stone-100 text-stone-600 hover:bg-stone-200" : "bg-stone-50 text-stone-300 cursor-not-allowed"
                    )}
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Category Selection */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => !isActive && setSelectedCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border transition-all",
                      selectedCategory === cat.id 
                        ? "border-stone-900 bg-stone-900 text-white shadow-lg" 
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300",
                      isActive && selectedCategory !== cat.id && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg", selectedCategory === cat.id ? "bg-white/20" : "bg-stone-100")}>
                      {cat.icon}
                    </div>
                    <span className="text-sm font-medium">{cat.id}</span>
                  </button>
                ))}
              </div>

              {/* Quick Presets */}
              <div className="flex items-center justify-center gap-4">
                {[15, 25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      if (!isActive) {
                        setInitialSeconds(mins * 60);
                        setSeconds(mins * 60);
                      }
                    }}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      initialSeconds === mins * 60 
                        ? "bg-stone-200 text-stone-900" 
                        : "text-stone-500 hover:bg-stone-100"
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Session History</h2>
                <span className="text-sm text-stone-500">{sessions.length} sessions</span>
              </div>

              {sessions.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                    <History className="w-8 h-8 text-stone-300" />
                  </div>
                  <p className="text-stone-500">No sessions recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div 
                      key={session.id}
                      className="group flex items-center justify-between p-4 bg-white border border-stone-200 rounded-2xl hover:border-stone-300 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                          CATEGORIES.find(c => c.id === session.category)?.color || 'bg-stone-500'
                        )}>
                          {CATEGORIES.find(c => c.id === session.category)?.icon}
                        </div>
                        <div>
                          <p className="font-medium">{session.category}</p>
                          <p className="text-xs text-stone-500">
                            {format(parseISO(session.startTime), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">
                            {Math.round(session.duration / 60)}m
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">Duration</p>
                        </div>
                        <button 
                          onClick={() => session.id && handleDeleteSession(session.id)}
                          className="p-2 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white border border-stone-200 rounded-2xl">
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Total Focus</p>
                  <p className="text-3xl font-light tracking-tight">
                    {Math.round(sessions.reduce((acc, s) => acc + s.duration, 0) / 60)}
                    <span className="text-sm font-medium text-stone-500 ml-1">mins</span>
                  </p>
                </div>
                <div className="p-6 bg-white border border-stone-200 rounded-2xl">
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Avg Session</p>
                  <p className="text-3xl font-light tracking-tight">
                    {sessions.length > 0 ? Math.round(sessions.reduce((acc, s) => acc + s.duration, 0) / sessions.length / 60) : 0}
                    <span className="text-sm font-medium text-stone-500 ml-1">mins</span>
                  </p>
                </div>
              </div>

              <div className="p-6 bg-white border border-stone-200 rounded-2xl space-y-6">
                <h3 className="font-semibold">Weekly Activity</h3>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#a8a29e' }}
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: '#f5f5f4' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-stone-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl">
                                <p className="font-bold">{payload[0].payload.fullDate}</p>
                                <p>{payload[0].value} minutes</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                        {statsData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.minutes > 0 ? '#1c1917' : '#e7e5e4'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-4">
                <h3 className="font-semibold">Categories</h3>
                <div className="space-y-3">
                  {CATEGORIES.map(cat => {
                    const catSessions = sessions.filter(s => s.category === cat.id);
                    const totalMins = catSessions.reduce((acc, s) => acc + s.duration, 0) / 60;
                    const totalAllMins = sessions.reduce((acc, s) => acc + s.duration, 0) / 60;
                    const percentage = totalAllMins > 0 ? (totalMins / totalAllMins) * 100 : 0;

                    return (
                      <div key={cat.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium flex items-center gap-2">
                            {cat.icon} {cat.id}
                          </span>
                          <span className="text-stone-500">{Math.round(totalMins)}m ({Math.round(percentage)}%)</span>
                        </div>
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className={cn("h-full", cat.color)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-stone-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          <button 
            onClick={() => setActiveTab('timer')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === 'timer' ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <Clock className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Timer</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === 'history' ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <History className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === 'stats' ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Stats</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
