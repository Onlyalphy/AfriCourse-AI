
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, GraduationCap, Clock, Video, ChevronRight, AlertCircle, 
  Loader2, Download, ExternalLink, Globe, Volume2, Pause, Play,
  Sun, Moon, CheckCircle2, Circle, MessageSquare, 
  Send, X, FileVideo, Zap, Brain, Sparkles, Award, ShieldCheck, Map
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, CourseContent, LearningDepth, AppTheme, ChatMessage, VideoOrientation, CertifiedPathway } from './types';
import { 
  generateCourse, generateCourseVideo, generateNarration, 
  chatWithGemini, analyzeVideoContent, generateCertifiedPathway, expandLessonContent 
} from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isGenerating: false,
    course: null,
    certifiedPathway: null,
    completedLessons: [],
    videoUrl: null,
    isVideoGenerating: false,
    isAudioGenerating: false,
    isAnalyzingVideo: false,
    videoAnalysis: null,
    error: null,
    theme: 'blue',
    isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    chatMessages: [],
    isChatLoading: false,
    videoOrientation: '16:9',
    isExpandingLesson: null
  });

  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<LearningDepth>('express');
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'learn' | 'analyze' | 'certified'>('learn');
  const [currentAudio, setCurrentAudio] = useState<{ lessonIdx: number; playing: boolean } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (state.isDarkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    document.body.className = `${state.isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'} theme-${state.theme} transition-colors duration-300`;
  }, [state.theme, state.isDarkMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatMessages]);

  const toggleDarkMode = () => setState(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }));

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setState(prev => ({ ...prev, isGenerating: true, error: null, course: null, certifiedPathway: null, completedLessons: [] }));
    try {
      const course = await generateCourse(topic, depth);
      setState(prev => ({ ...prev, course, isGenerating: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, isGenerating: false, error: 'Failed to generate course.' }));
    }
  };

  const handleGenerateCertified = async (years: number) => {
    if (!topic.trim()) return;
    if (!(await (window as any).aistudio.hasSelectedApiKey())) {
      await (window as any).aistudio.openSelectKey();
    }
    setState(prev => ({ ...prev, isGenerating: true, error: null, certifiedPathway: null }));
    try {
      const pathway = await generateCertifiedPathway(topic, years);
      setState(prev => ({ ...prev, certifiedPathway: pathway, isGenerating: false }));
    } catch (err) {
      setState(prev => ({ ...prev, isGenerating: false, error: 'Failed to generate pathway.' }));
    }
  };

  const handleExpandLesson = async (idx: number) => {
    if (!state.course) return;
    setState(prev => ({ ...prev, isExpandingLesson: idx }));
    try {
      const lesson = state.course.lessons[idx];
      const expanded = await expandLessonContent(state.course.topic, lesson.title, lesson.content);
      setState(prev => {
        const newLessons = [...(prev.course?.lessons || [])];
        newLessons[idx] = { ...newLessons[idx], expandedContent: expanded };
        return { ...prev, course: prev.course ? { ...prev.course, lessons: newLessons } : null, isExpandingLesson: null };
      });
    } catch (err) {
      setState(prev => ({ ...prev, isExpandingLesson: null, error: 'Failed to expand content.' }));
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setState(prev => ({ ...prev, chatMessages: [...prev.chatMessages, userMsg], isChatLoading: true }));
    setChatInput('');
    try {
      const response = await chatWithGemini(userMsg.text, state.chatMessages);
      setState(prev => ({ ...prev, chatMessages: [...prev.chatMessages, { role: 'model', text: response }], isChatLoading: false }));
    } catch (err) {
      setState(prev => ({ ...prev, isChatLoading: false }));
    }
  };

  // Fix: Implemented handleNarration to process and play TTS audio bytes
  const handleNarration = async (idx: number, text: string) => {
    if (currentAudio?.lessonIdx === idx && currentAudio.playing) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      setCurrentAudio(null);
      return;
    }

    setState(prev => ({ ...prev, isAudioGenerating: true }));
    try {
      const audioData = await generateNarration(text);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      
      // Manual PCM decoding logic as per Gemini API guidelines for raw audio streams
      const data = new Uint8Array(audioData);
      const numChannels = 1;
      const sampleRate = 24000;
      const dataInt16 = new Int16Array(data.buffer);
      const frameCount = dataInt16.length / numChannels;
      const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
      }

      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setCurrentAudio(null);
      };
      source.start();
      audioSourceRef.current = source;
      setCurrentAudio({ lessonIdx: idx, playing: true });
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, error: 'Failed to generate narration.' }));
    } finally {
      setState(prev => ({ ...prev, isAudioGenerating: false }));
    }
  };

  // Fix: Implemented handleGenerateVideoClick to trigger Veo model video generation
  const handleGenerateVideoClick = async (lessonTitle: string) => {
    if (!state.course) return;
    setState(prev => ({ ...prev, isVideoGenerating: true, error: null }));
    try {
      const url = await generateCourseVideo(state.course.topic, lessonTitle, state.videoOrientation);
      setState(prev => ({ ...prev, videoUrl: url, isVideoGenerating: false }));
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, isVideoGenerating: false, error: 'Failed to generate video.' }));
    }
  };

  const progressPercentage = useMemo(() => {
    if (!state.course || state.course.lessons.length === 0) return 0;
    return Math.round((state.completedLessons.length / state.course.lessons.length) * 100);
  }, [state.completedLessons, state.course]);

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-primary transition-colors duration-300">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 no-print">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setState(p => ({...p, course: null, certifiedPathway: null})); setActiveTab('learn')}}>
              <div className="bg-primary p-2 rounded-lg"><GraduationCap className="text-white w-6 h-6" /></div>
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">AfriCourse <span className="text-primary">AI</span></span>
            </div>
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {['learn', 'analyze', 'certified'].map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab as any)} 
                  className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'}`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={toggleDarkMode} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
              {state.isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'learn' ? (
            <motion.div key="learn-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!state.course && !state.isGenerating ? (
                <div className="max-w-2xl mx-auto mt-12 space-y-12">
                  <div className="text-center space-y-4">
                    <h1 className="text-5xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">Master Any Skill. <br /><span className="text-primary">Anytime, Anywhere.</span></h1>
                    <p className="text-xl text-slate-600 dark:text-slate-400">Grounded, expert-level crash courses for Africa's future leaders.</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-8">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-500 uppercase">Search a topic to start</label>
                      <input type="text" placeholder="e.g., Computer Science, Law, Agriculture..." className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all text-lg dark:text-slate-100" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerate()} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {['express', 'standard', 'deep'].map((d) => (
                        <button key={d} onClick={() => setDepth(d as any)} className={`py-4 rounded-2xl border-2 text-sm font-bold flex flex-col items-center gap-2 ${depth === d ? 'bg-primary/5 border-primary text-primary' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                          <Brain className="w-5 h-5" /> {d}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleGenerate} disabled={!topic.trim() || state.isGenerating} className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 text-lg disabled:opacity-50 transition-transform active:scale-95">
                      {state.isGenerating ? <Loader2 className="animate-spin" /> : 'Create Course Now'} <ChevronRight />
                    </button>
                  </div>
                </div>
              ) : state.isGenerating ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-8">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }}><Zap className="w-20 h-20 text-primary" /></motion.div>
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Deep Reasoning Active...</h2>
                    <p className="text-slate-500">Constructing a high-fidelity learning path for you.</p>
                  </div>
                </div>
              ) : state.course && (
                <div className="space-y-12 pb-20">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-10 border-b dark:border-slate-800">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] bg-primary/10 px-3 py-1 rounded-full w-fit">Module: {depth}</div>
                      <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-100">{state.course.topic}</h1>
                      <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full mt-4"><motion.div initial={{ width: 0 }} animate={{ width: `${progressPercentage}%` }} className="h-full bg-primary" /></div>
                    </div>
                    <button onClick={() => window.print()} className="no-print px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"><Download className="w-4 h-4" /> Save PDF</button>
                  </div>
                  <div className="space-y-16">
                    {state.course.lessons.map((lesson, idx) => {
                      const isDone = state.completedLessons.includes(idx);
                      const isExpanding = state.isExpandingLesson === idx;
                      const isAudioLoading = state.isAudioGenerating && currentAudio?.lessonIdx === idx;
                      return (
                        <section key={idx} className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border ${isDone ? 'border-primary' : 'border-slate-100 dark:border-slate-800'} transition-all`}>
                          <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1 space-y-6">
                              <div className="flex justify-between items-start">
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDone ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{isDone ? <CheckCircle2 /> : idx + 1}</span>
                                  {lesson.title}
                                </h2>
                                <div className="flex gap-2">
                                  <button onClick={() => handleNarration(idx, lesson.content)} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                                    {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Volume2 className="w-4 h-4" />}
                                  </button>
                                  <button onClick={() => setState(p => ({...p, completedLessons: isDone ? p.completedLessons.filter(i => i !== idx) : [...p.completedLessons, idx]}))} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${isDone ? 'bg-primary/10 text-primary' : 'bg-slate-900 text-white'}`}>{isDone ? 'Done' : 'Mark'}</button>
                                </div>
                              </div>
                              <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{lesson.content}</div>
                              
                              <AnimatePresence>
                                {lesson.expandedContent && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border-l-4 border-primary">
                                    <h4 className="text-sm font-black text-primary mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Deep Analysis Expansion</h4>
                                    <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{lesson.expandedContent}</div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div className="flex gap-4 pt-4 no-print">
                                <button 
                                  onClick={() => handleExpandLesson(idx)} 
                                  disabled={isExpanding}
                                  className="flex items-center gap-2 text-xs font-black text-primary hover:underline disabled:opacity-50"
                                >
                                  {isExpanding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                                  Go Deeper into this Topic
                                </button>
                              </div>
                            </div>
                            <div className="w-full lg:w-80 h-fit bg-slate-950 rounded-3xl p-4 overflow-hidden">
                              <div className="aspect-video flex items-center justify-center text-white text-xs text-center p-4">
                                {state.videoUrl && state.isVideoGenerating === false ? <video src={state.videoUrl} controls className="w-full h-full rounded-xl" /> : 
                                <div className="space-y-4">
                                  {state.isVideoGenerating ? (
                                    <div className="flex flex-col items-center gap-2">
                                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                      <p className="text-[10px] font-black uppercase text-slate-400">Rendering Video...</p>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-slate-500">Need visual help?</p>
                                      <button onClick={() => handleGenerateVideoClick(lesson.title)} className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:scale-105 transition-transform">Generate Video</button>
                                    </>
                                  )}
                                </div>}
                              </div>
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'analyze' ? (
            <motion.div key="analyze-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto py-12 space-y-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto"><FileVideo className="text-primary w-8 h-8" /></div>
                <h2 className="text-3xl font-black dark:text-white">Video Understanding</h2>
                <p className="text-slate-500">Gemini 3 Pro will analyze your educational video for key insights.</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] border-4 border-dashed dark:border-slate-800 text-center">
                <label className="cursor-pointer group">
                  <div className="flex flex-col items-center gap-4">
                    <span className="px-8 py-3 bg-primary text-white rounded-xl font-black group-hover:scale-105 transition-transform">Select Video File</span>
                    <p className="text-xs text-slate-400">Max 50MB for best results</p>
                  </div>
                  <input type="file" className="hidden" accept="video/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = (reader.result as string).split(',')[1];
                        setState(p => ({ ...p, isAnalyzingVideo: true }));
                        const analysis = await analyzeVideoContent(base64, file.type);
                        setState(p => ({ ...p, videoAnalysis: analysis, isAnalyzingVideo: false }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
              </div>
              {state.isAnalyzingVideo && <div className="text-center py-8"><Loader2 className="animate-spin mx-auto w-8 h-8 text-primary" /><p className="text-xs font-black text-primary mt-2">THINKING...</p></div>}
              {state.videoAnalysis && <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800 prose dark:prose-invert max-w-none">{state.videoAnalysis}</div>}
            </motion.div>
          ) : (
            <motion.div key="certified-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto py-12 space-y-12">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-12 rounded-[3rem] text-white space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-20"><Award className="w-48 h-48" /></div>
                <div className="relative z-10 space-y-4">
                  <div className="px-4 py-1 bg-white/20 rounded-full w-fit text-xs font-black tracking-widest uppercase">Premium Certified Pathway</div>
                  <h2 className="text-5xl font-black">Certified Long-term Learning</h2>
                  <p className="text-xl font-medium max-w-2xl opacity-90">Step into a full university-grade curriculum. 1-4 years of grounded knowledge leading to professional mastery.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 space-y-6">
                  <h3 className="text-2xl font-black dark:text-white flex items-center gap-3"><ShieldCheck className="text-amber-500" /> Start Professional Path</h3>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">Enter a topic to build a multi-year professional roadmap.</p>
                    <input type="text" placeholder="e.g. Mechanical Engineering, Journalism..." value={topic} onChange={e => setTopic(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border dark:border-slate-700 outline-none focus:ring-2 ring-primary" />
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map(y => (
                        <button key={y} onClick={() => handleGenerateCertified(y)} className="py-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 font-black text-slate-600 dark:text-slate-400 hover:border-amber-500 hover:text-amber-500 transition-all">
                          {y} Year {y === 1 ? 'Certificate' : y === 2 ? 'Diploma' : 'Degree'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[2.5rem] border dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center"><Map className="text-amber-500" /></div>
                  <h4 className="font-black dark:text-white uppercase tracking-widest text-xs">Curriculum Intelligence</h4>
                  <p className="text-xs text-slate-400">Paid certification pathways utilize Gemini 3 Pro with max thinking budget to simulate a world-class academic board.</p>
                </div>
              </div>

              {state.isGenerating && <div className="text-center py-12"><Loader2 className="animate-spin mx-auto w-12 h-12 text-amber-500" /><p className="font-black text-amber-500 mt-2">DRAFTING ACADEMIC ROADMAP...</p></div>}

              {state.certifiedPathway && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black dark:text-white">{state.certifiedPathway.title}</h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Duration: {state.certifiedPathway.duration}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {state.certifiedPathway.roadmap.map((y, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border dark:border-slate-800 shadow-lg">
                        <h4 className="text-xl font-black text-amber-500 mb-6">Year {y.year}</h4>
                        <div className="space-y-6">
                          {y.semesters.map((s, si) => (
                            <div key={si} className="space-y-2">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Semester {si + 1}</span>
                              <p className="text-sm font-bold dark:text-slate-200">{s}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-24 right-6 w-96 h-[500px] bg-white dark:bg-slate-900 shadow-2xl rounded-3xl border dark:border-slate-800 z-50 flex flex-col overflow-hidden">
            <div className="p-4 bg-primary text-white flex justify-between items-center"><span className="font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> AfriCourse Tutor</span><button onClick={() => setIsChatOpen(false)}><X /></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
              {state.chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium ${m.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700'}`}>{m.text}</div>
                </div>
              ))}
              {state.isChatLoading && <Loader2 className="animate-spin w-4 h-4 text-primary" />}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 flex gap-2 border-t dark:border-slate-800">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder="Ask a question..." className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 text-sm outline-none border focus:border-primary dark:text-white" />
              <button onClick={handleChat} className="bg-primary text-white p-2 rounded-xl"><Send className="w-5 h-5" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-50"><MessageSquare /></button>
    </div>
  );
};

export default App;
