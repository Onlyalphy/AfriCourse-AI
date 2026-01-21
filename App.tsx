
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, GraduationCap, Clock, Video, ChevronRight, AlertCircle, 
  Loader2, Download, ExternalLink, Globe, Volume2, Pause, Play,
  Palette, Sun, Moon, CheckCircle2, Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, CourseContent, LearningDepth, AppTheme } from './types';
import { generateCourse, generateCourseVideo, generateNarration } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isGenerating: false,
    course: null,
    completedLessons: [],
    videoUrl: null,
    isVideoGenerating: false,
    isAudioGenerating: false,
    error: null,
    theme: 'blue',
    isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches
  });

  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<LearningDepth>('express');
  const [currentAudio, setCurrentAudio] = useState<{ lessonIdx: number; playing: boolean } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (state.isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    document.body.className = `${state.isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'} text-slate-900 theme-${state.theme} transition-colors duration-300`;
  }, [state.theme, state.isDarkMode]);

  const toggleDarkMode = () => {
    setState(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }));
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setState(prev => ({ ...prev, isGenerating: true, error: null, course: null, completedLessons: [] }));
    try {
      const course = await generateCourse(topic, depth);
      setState(prev => ({ ...prev, course, isGenerating: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isGenerating: false, error: err.message || 'Failed to generate course.' }));
    }
  };

  const toggleLessonCompletion = (idx: number) => {
    setState(prev => {
      const isCompleted = prev.completedLessons.includes(idx);
      if (isCompleted) {
        return { ...prev, completedLessons: prev.completedLessons.filter(i => i !== idx) };
      } else {
        return { ...prev, completedLessons: [...prev.completedLessons, idx] };
      }
    });
  };

  const progressPercentage = useMemo(() => {
    if (!state.course || state.course.lessons.length === 0) return 0;
    return Math.round((state.completedLessons.length / state.course.lessons.length) * 100);
  }, [state.completedLessons, state.course]);

  const handleNarration = async (lessonIdx: number, text: string) => {
    if (currentAudio?.lessonIdx === lessonIdx && currentAudio.playing) {
      audioSourceRef.current?.stop();
      setCurrentAudio(null);
      return;
    }

    setState(prev => ({ ...prev, isAudioGenerating: true }));
    try {
      const audioBuffer = await generateNarration(text);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      const dataInt16 = new Int16Array(audioBuffer);
      const audioBuf = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = audioBuf.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      if (audioSourceRef.current) audioSourceRef.current.stop();
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(ctx.destination);
      source.onended = () => setCurrentAudio(null);
      source.start();
      
      audioSourceRef.current = source;
      setCurrentAudio({ lessonIdx, playing: true });
      setState(prev => ({ ...prev, isAudioGenerating: false }));
    } catch (err) {
      setState(prev => ({ ...prev, isAudioGenerating: false, error: 'Failed to play audio narration.' }));
    }
  };

  const handleGenerateVideo = async (lessonTitle: string) => {
    setState(prev => ({ ...prev, isVideoGenerating: true, videoUrl: null }));
    try {
      const url = await generateCourseVideo(state.course?.topic || topic, lessonTitle);
      setState(prev => ({ ...prev, videoUrl: url, isVideoGenerating: false }));
    } catch (err: any) {
      if (err.message?.includes("Requested entity was not found")) {
        await (window as any).aistudio.openSelectKey();
      }
      setState(prev => ({ ...prev, isVideoGenerating: false, error: 'Video generation failed. Please try again.' }));
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-primary selection:text-white transition-colors duration-300`}>
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 no-print">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="bg-primary p-2 rounded-lg transition-colors">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">AfriCourse <span className="text-primary transition-colors">AI</span></span>
          </motion.div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
              {(['blue', 'orange', 'green', 'black'] as AppTheme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setState(prev => ({ ...prev, theme: t }))}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    t === 'blue' ? 'bg-blue-600' : 
                    t === 'orange' ? 'bg-orange-500' : 
                    t === 'green' ? 'bg-green-600' : 'bg-slate-500'
                  } ${state.theme === t ? 'border-white dark:border-slate-300 scale-110 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  title={`${t.charAt(0).toUpperCase() + t.slice(1)} Theme`}
                />
              ))}
            </div>

            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              {state.isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <div className="hidden lg:flex items-center gap-1 text-xs font-black text-slate-400 uppercase tracking-widest">
              <Globe className="w-4 h-4" /> Africa
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 relative">
        <AnimatePresence mode="wait">
          {!state.course && !state.isGenerating ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto mt-12 space-y-12 no-print"
            >
              <div className="text-center space-y-6">
                <motion.h1 
                  className="text-5xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight tracking-tight"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Master Any Skill. <br />
                  <span className="text-primary transition-colors underline decoration-slate-200 dark:decoration-slate-800">Anytime, Anywhere.</span>
                </motion.h1>
                <p className="text-xl text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Bridging the information gap with verified, high-accuracy crash courses for Kenya and beyond.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">What's your goal today?</label>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      placeholder="e.g., Modern Agriculture, Basic Human Rights, Start a Kiosk..."
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-lg dark:text-slate-100"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {(['express', 'standard', 'deep'] as LearningDepth[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDepth(d)}
                      className={`py-4 px-2 rounded-2xl border-2 text-sm font-bold capitalize transition-all flex flex-col items-center gap-2 ${
                        depth === d 
                          ? 'bg-primary/5 border-primary text-primary shadow-sm dark:bg-primary/20' 
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <Clock className={`w-5 h-5 ${depth === d ? 'text-primary' : 'text-slate-300 dark:text-slate-600'}`} />
                      {d === 'express' ? '1 Day' : d === 'standard' ? '3 Days' : '1 Week'}
                    </button>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGenerate}
                  disabled={!topic.trim()}
                  className="w-full py-5 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black transition-all shadow-xl shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                >
                  Create Course Now
                  <ChevronRight className="w-6 h-6" />
                </motion.button>
              </div>
            </motion.div>
          ) : state.isGenerating ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 space-y-8 no-print"
            >
              <div className="relative">
                <Loader2 className="w-20 h-20 text-primary animate-spin" />
                <GraduationCap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary w-8 h-8" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Verifying Knowledge...</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Sourcing expert advice tailored for your region.</p>
              </div>
            </motion.div>
          ) : state.course && (
            <motion.div 
              key="course"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12 pb-20"
            >
              {/* Course Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b-2 border-slate-100 dark:border-slate-800">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] bg-primary/10 px-3 py-1 rounded-full w-fit">
                    <GraduationCap className="w-3 h-3" />
                    {depth} Knowledge Path
                  </div>
                  <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-slate-100 leading-none">{state.course.topic}</h1>
                  <p className="text-xl text-slate-500 dark:text-slate-400 max-w-3xl font-medium leading-relaxed italic">
                    "{state.course.summary}"
                  </p>
                  
                  {/* Global Progress Bar */}
                  <div className="mt-6 space-y-2 no-print">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Progress</span>
                      <span className="text-sm font-black text-primary">{progressPercentage}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 no-print">
                  <button
                    onClick={() => window.print()}
                    className="px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-colors shadow-lg"
                  >
                    <Download className="w-4 h-4" /> PDF Export
                  </button>
                </div>
              </div>

              {/* Lessons List */}
              <div className="space-y-16">
                {state.course.lessons.map((lesson, idx) => {
                  const isCompleted = state.completedLessons.includes(idx);
                  return (
                    <motion.section 
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className={`bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border ${isCompleted ? 'border-primary' : 'border-slate-100 dark:border-slate-800'} shadow-xl shadow-slate-200/40 dark:shadow-none relative overflow-hidden transition-colors duration-500`}
                    >
                      <div className={`absolute top-0 right-0 w-32 h-32 ${isCompleted ? 'bg-primary/10' : 'bg-primary/5'} rounded-bl-full -mr-10 -mt-10 transition-colors duration-500`} />
                      
                      <div className="flex flex-col lg:flex-row gap-12">
                        <div className="flex-1 space-y-8">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-4">
                              <span className={`flex-shrink-0 w-12 h-12 ${isCompleted ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'} text-white rounded-2xl flex items-center justify-center text-xl shadow-lg transition-colors duration-500`}>
                                {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : idx + 1}
                              </span>
                              {lesson.title}
                            </h2>
                            
                            <div className="flex items-center gap-2 no-print">
                              <button 
                                onClick={() => handleNarration(idx, `${lesson.title}. ${lesson.content}. Key takeaways are: ${lesson.keyTakeaways.join(', ')}`)}
                                disabled={state.isAudioGenerating}
                                className={`p-3 rounded-2xl transition-all flex items-center gap-2 font-bold text-xs ${
                                  currentAudio?.lessonIdx === idx 
                                    ? 'bg-primary text-white shadow-lg' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                } disabled:opacity-50`}
                              >
                                {state.isAudioGenerating && currentAudio?.lessonIdx === idx ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : currentAudio?.lessonIdx === idx && currentAudio.playing ? (
                                  <Pause className="w-4 h-4 fill-current" />
                                ) : (
                                  <Volume2 className="w-4 h-4" />
                                )}
                                {currentAudio?.lessonIdx === idx && currentAudio.playing ? 'Stop' : 'Listen'}
                              </button>

                              <button 
                                onClick={() => toggleLessonCompletion(idx)}
                                className={`p-3 rounded-2xl transition-all flex items-center gap-2 font-black text-xs ${
                                  isCompleted 
                                    ? 'bg-primary/10 text-primary border border-primary/20' 
                                    : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md hover:opacity-90'
                                }`}
                              >
                                {isCompleted ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Completed
                                  </>
                                ) : (
                                  <>
                                    <Circle className="w-4 h-4" />
                                    Mark Done
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className={`prose prose-lg prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-line ${isCompleted ? 'opacity-70' : ''} transition-opacity duration-500`}>
                            {lesson.content}
                          </div>
                          
                          <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                            <h4 className="text-xs font-black text-primary mb-5 flex items-center gap-2 uppercase tracking-widest">
                              <AlertCircle className="w-4 h-4" /> Crucial Insights
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {lesson.keyTakeaways.map((point, kIdx) => (
                                <div key={kIdx} className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-primary/10 flex items-start gap-3 shadow-sm">
                                  <span className="mt-1 w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{point}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-full lg:w-96 space-y-6 no-print">
                          <div className="bg-slate-900 dark:bg-slate-950 rounded-[2rem] p-1 border-4 border-slate-100 dark:border-slate-800 shadow-2xl relative group overflow-hidden min-h-[260px] flex items-center justify-center">
                            {state.isVideoGenerating ? (
                              <div className="flex flex-col items-center gap-4 p-8 text-center">
                                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                <div className="space-y-1">
                                  <p className="text-white font-black text-sm uppercase tracking-widest">Animating...</p>
                                  <p className="text-slate-400 text-xs">Preparing visual mental model</p>
                                </div>
                              </div>
                            ) : state.videoUrl ? (
                              <video src={state.videoUrl} controls className="w-full h-full object-cover rounded-[1.8rem]" />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-center p-8 space-y-6">
                                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                                  <Video className="w-8 h-8 text-primary" />
                                </div>
                                <div className="space-y-2">
                                  <h4 className="font-black text-white text-lg">Visual Companion</h4>
                                  <p className="text-slate-400 text-sm font-medium">Struggling with the text? Watch a generated video overview.</p>
                                </div>
                                <button
                                  onClick={() => handleGenerateVideo(lesson.title)}
                                  className="w-full py-4 bg-primary hover:bg-primary-hover text-white text-sm font-black rounded-2xl transition-all shadow-lg shadow-primary/20"
                                >
                                  Generate Video Lesson
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                            <p className="text-xs text-amber-800 dark:text-amber-400 font-bold leading-tight uppercase">
                              Low Connectivity? Video may take a few moments to sync.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.section>
                  );
                })}
              </div>

              {/* Verified Sources */}
              <AnimatePresence>
                {state.course.groundingSources.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="bg-slate-900 dark:bg-slate-950 p-12 rounded-[3rem] no-print border border-slate-800"
                  >
                    <div className="flex items-center justify-between mb-10">
                      <h3 className="text-3xl font-black text-white flex items-center gap-4">
                        <ExternalLink className="w-8 h-8 text-primary" /> 
                        Verified Truth 
                      </h3>
                      <span className="text-primary font-black uppercase tracking-tighter text-xs border border-primary/30 px-3 py-1 rounded-full">Grokipedia Verified</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {state.course.groundingSources.map((source, sIdx) => (
                        <a
                          key={sIdx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all group"
                        >
                          <span className="block text-lg font-black text-white group-hover:text-primary transition-colors truncate mb-1">{source.title}</span>
                          <span className="block text-xs text-slate-500 truncate">{source.uri}</span>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-center pt-20 no-print">
                <button
                  onClick={() => { setState(prev => ({ ...prev, course: null })); setTopic(''); }}
                  className="px-8 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl font-black transition-all flex items-center gap-3 border border-slate-200 dark:border-slate-700"
                >
                  Explore Another Topic
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {state.error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto mt-8 bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/30 p-5 rounded-3xl flex gap-4 items-center text-red-700 dark:text-red-400 no-print shadow-xl"
          >
            <div className="bg-red-100 dark:bg-red-900/20 p-2 rounded-full"><AlertCircle className="w-6 h-6" /></div>
            <p className="text-sm font-bold uppercase tracking-tight">{state.error}</p>
          </motion.div>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 py-20 no-print mt-20">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-20">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <GraduationCap className="text-white w-5 h-5" />
              </div>
              <span className="font-black text-xl tracking-tighter text-slate-900 dark:text-slate-100">AfriCourse AI</span>
            </div>
            <p className="text-lg text-slate-400 font-medium leading-relaxed">
              Democratizing high-end education for every village, every city, and every person in Africa. Knowledge is a right, not a privilege.
            </p>
          </div>
          <div className="space-y-6">
            <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-[0.2em]">Verified Knowledge Fields</h4>
            <ul className="text-lg text-slate-500 font-bold space-y-3">
              <li className="hover:text-primary cursor-default transition-colors">Medicine & Public Health</li>
              <li className="hover:text-primary cursor-default transition-colors">Constitutional Law</li>
              <li className="hover:text-primary cursor-default transition-colors">Modern Agribusiness</li>
              <li className="hover:text-primary cursor-default transition-colors">FinTech & Economics</li>
            </ul>
          </div>
          <div className="space-y-8">
            <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-[0.2em]">Our Mission</h4>
            <p className="text-sm text-slate-400 font-bold uppercase italic leading-loose">
              "Closing the misinformation gap through grounded, affordable AI reasoning for marginalized regions."
            </p>
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black tracking-widest uppercase">Truth Grounded</div>
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black tracking-widest uppercase">Africa First</div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-20 pt-10 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase font-black text-slate-400 tracking-widest">
          <span>&copy; 2025 AfriCourse AI. Developed for Global Impact.</span>
          <div className="flex gap-8">
            <a href="#" className="hover:text-primary transition-colors">Accessibility</a>
            <a href="#" className="hover:text-primary transition-colors">Verified Data</a>
            <a href="#" className="hover:text-primary transition-colors">Open Learning</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
