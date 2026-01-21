
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, GraduationCap, Clock, Video, ChevronRight, AlertCircle, 
  Loader2, Download, ExternalLink, Globe, Volume2, Pause, Play,
  Sun, Moon, CheckCircle2, Circle, MessageSquare, 
  Send, X, FileVideo, Zap, Brain, Sparkles, Award, ShieldCheck, Map,
  Share2, Settings2, Monitor, Smartphone, Sliders, Save, Trash2, Library,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, CourseContent, LearningDepth, AppTheme, ChatMessage, VideoOrientation, VideoResolution, CertifiedPathway, SavedCourse } from './types';
import { 
  generateCourse, generateCourseVideo, generateNarration, 
  chatWithGemini, analyzeVideoContent, generateCertifiedPathway, expandLessonContent 
} from './services/geminiService';

const ProBadge: React.FC = () => (
  <span className="pro-gradient text-[8px] font-black text-white px-2 py-0.5 rounded-sm uppercase tracking-widest border border-blue-500/30">Pro</span>
);

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
    videoResolution: '720p',
    isExpandingLesson: null,
    savedCourses: []
  });

  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<LearningDepth>('express');
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'learn' | 'analyze' | 'certified' | 'library'>('learn');
  const [currentAudio, setCurrentAudio] = useState<{ lessonIdx: number; playing: boolean } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('africourse_saved_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(prev => ({ ...prev, savedCourses: parsed }));
      } catch (e) {
        console.error("Failed to load saved courses", e);
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedTopic = params.get('topic');
    const sharedDepth = params.get('depth');

    if (sharedTopic) {
      setTopic(sharedTopic);
      if (sharedDepth && ['express', 'standard', 'deep', 'certified'].includes(sharedDepth)) {
        setDepth(sharedDepth as LearningDepth);
      }
      
      setTimeout(() => {
        const generateBtn = document.getElementById('main-generate-btn');
        if (generateBtn) generateBtn.click();
      }, 500);
    }
  }, []);

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

  const handleShare = () => {
    const shareUrl = new URL(window.location.origin + window.location.pathname);
    shareUrl.searchParams.set('topic', topic);
    shareUrl.searchParams.set('depth', depth);
    
    navigator.clipboard.writeText(shareUrl.toString());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveForOffline = () => {
    if (!state.course) return;
    
    const newSaved: SavedCourse = {
      id: crypto.randomUUID(),
      content: state.course,
      savedAt: Date.now(),
      depth: depth
    };

    const updated = [newSaved, ...state.savedCourses.filter(c => c.content.topic !== state.course?.topic)];
    setState(prev => ({ ...prev, savedCourses: updated }));
    localStorage.setItem('africourse_saved_v1', JSON.stringify(updated));
    alert(`${state.course.topic} has been saved for offline viewing in your Library.`);
  };

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = state.savedCourses.filter(c => c.id !== id);
    setState(prev => ({ ...prev, savedCourses: updated }));
    localStorage.setItem('africourse_saved_v1', JSON.stringify(updated));
  };

  const handleLoadSaved = (saved: SavedCourse) => {
    setState(prev => ({ 
      ...prev, 
      course: saved.content, 
      completedLessons: [], 
      certifiedPathway: null,
      error: null
    }));
    setTopic(saved.content.topic);
    setDepth(saved.depth);
    setActiveTab('learn');
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
      
      const data = new Uint8Array(audioData);
      const dataInt16 = new Int16Array(data.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      if (audioSourceRef.current) audioSourceRef.current.stop();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setCurrentAudio(null);
      source.start();
      audioSourceRef.current = source;
      setCurrentAudio({ lessonIdx: idx, playing: true });
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Failed to generate narration.' }));
    } finally {
      setState(prev => ({ ...prev, isAudioGenerating: false }));
    }
  };

  const handleGenerateVideoClick = async (lessonTitle: string) => {
    if (!state.course) return;
    setState(prev => ({ ...prev, isVideoGenerating: true, error: null }));
    try {
      const url = await generateCourseVideo(state.course.topic, lessonTitle, state.videoOrientation, state.videoResolution);
      setState(prev => ({ ...prev, videoUrl: url, isVideoGenerating: false }));
    } catch (err) {
      setState(prev => ({ ...prev, isVideoGenerating: false, error: 'Failed to generate video.' }));
    }
  };

  const progressPercentage = useMemo(() => {
    if (!state.course || state.course.lessons.length === 0) return 0;
    return Math.round((state.completedLessons.length / state.course.lessons.length) * 100);
  }, [state.completedLessons, state.course]);

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-300">
      <header className="bg-white/95 dark:bg-black/95 backdrop-blur-xl border-b border-slate-200 dark:border-blue-900/30 sticky top-0 z-50 no-print">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setState(p => ({...p, course: null, certifiedPathway: null})); setActiveTab('learn')}}>
              <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-600/20"><GraduationCap className="text-white w-6 h-6" /></div>
              <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">AfriCourse <span className="text-blue-600">AI</span></span>
            </div>
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-blue-900/20 p-1 rounded-xl border border-slate-200 dark:border-blue-900/30">
              {['learn', 'analyze', 'certified', 'library'].map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab as any)} 
                  className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
                >
                  {tab === 'library' ? <Library className="w-3.5 h-3.5" /> : tab}
                  {(tab === 'analyze' || tab === 'certified') && <ProBadge />}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-blue-950/50 rounded-full border border-slate-200 dark:border-blue-900/30">
              {(['blue', 'black'] as AppTheme[]).map((t) => (
                <button 
                  key={t} 
                  onClick={() => setState(prev => ({ ...prev, theme: t }))} 
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    t === 'blue' ? 'bg-blue-600' : 'bg-black'
                  } ${state.theme === t ? 'border-white dark:border-blue-400 scale-125 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                />
              ))}
            </div>
            <button onClick={toggleDarkMode} className="p-2 rounded-xl bg-slate-100 dark:bg-blue-900/20 border border-slate-200 dark:border-blue-900/30 text-slate-600 dark:text-blue-400 hover:text-blue-600 transition-colors">
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
                    <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white leading-none tracking-tight">Level Up Your Skills. <br /><span className="text-blue-600">Pure Intelligence.</span></h1>
                    <p className="text-xl text-slate-600 dark:text-blue-100/60 font-medium">Professional high-fidelity courses crafted for Africa's elite learners.</p>
                  </div>
                  <div className="bg-white dark:bg-black p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-blue-900/30 space-y-8 card-premium-border">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 dark:text-blue-400 uppercase tracking-[0.2em]">Your Professional Goal</label>
                      <input type="text" placeholder="e.g., Computer Science, Law, Agriculture..." className="w-full px-6 py-5 bg-slate-50 dark:bg-blue-950/20 border border-slate-200 dark:border-blue-900/30 rounded-3xl focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-xl font-bold dark:text-white" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerate()} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {['express', 'standard', 'deep'].map((d) => (
                        <button key={d} onClick={() => setDepth(d as any)} className={`py-5 rounded-3xl border-2 text-xs font-black uppercase tracking-widest flex flex-col items-center gap-3 transition-all ${depth === d ? 'bg-blue-600/5 border-blue-600 text-blue-600 shadow-sm' : 'bg-white dark:bg-black border-slate-100 dark:border-blue-900/20 text-slate-500 hover:border-slate-300'}`}>
                          <Brain className="w-6 h-6" /> {d}
                          {d === 'deep' && <ProBadge />}
                        </button>
                      ))}
                    </div>
                    <button 
                      id="main-generate-btn"
                      onClick={handleGenerate} 
                      disabled={!topic.trim() || state.isGenerating} 
                      className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-600/20 flex items-center justify-center gap-4 text-xl disabled:opacity-50 transition-all transform active:scale-95"
                    >
                      {state.isGenerating ? <Loader2 className="animate-spin" /> : 'Start Learning Path'} <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ) : state.isGenerating ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-8">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}><Zap className="w-24 h-24 text-blue-600" /></motion.div>
                  <div className="text-center space-y-2">
                    <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">AI Reasoning...</h2>
                    <p className="text-slate-500 dark:text-blue-400 font-bold uppercase text-xs tracking-widest">Sourcing verified educational data</p>
                  </div>
                </div>
              ) : state.course && (
                <div className="space-y-12 pb-20">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-10 border-b dark:border-blue-900/30">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black uppercase text-[10px] bg-blue-600/10 px-3 py-1 rounded-full w-fit">Module: {depth}</div>
                      <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{state.course.topic}</h1>
                      <div className="w-full h-3 bg-slate-100 dark:bg-blue-950 rounded-full mt-4 overflow-hidden border dark:border-blue-900/30">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercentage}%` }} className="h-full bg-blue-600" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 no-print">
                      <button onClick={handleSaveForOffline} className="px-6 py-4 bg-slate-100 dark:bg-blue-900/20 text-slate-900 dark:text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-200 shadow-sm transition-all border border-transparent dark:border-blue-900/30">
                        <Save className="w-4 h-4" /> Save Offline
                      </button>
                      <button onClick={handleShare} className={`px-6 py-4 rounded-2xl font-black text-sm flex items-center gap-2 transition-all ${isCopied ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-blue-900/20 text-slate-900 dark:text-white hover:bg-slate-200 shadow-sm border border-transparent dark:border-blue-900/30'}`}>
                        {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                        {isCopied ? 'Link Copied' : 'Share'}
                      </button>
                      <button onClick={() => window.print()} className="px-6 py-4 bg-black text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-900 transition-all shadow-xl">
                        <Download className="w-4 h-4" /> Export PDF
                      </button>
                    </div>
                  </div>
                  <div className="space-y-20">
                    {state.course.lessons.map((lesson, idx) => {
                      const isDone = state.completedLessons.includes(idx);
                      const isExpanding = state.isExpandingLesson === idx;
                      const isAudioLoading = state.isAudioGenerating && currentAudio?.lessonIdx === idx;
                      return (
                        <section key={idx} className={`bg-white dark:bg-black p-10 rounded-[3rem] border-2 ${isDone ? 'border-blue-600' : 'border-slate-100 dark:border-blue-900/20'} transition-all shadow-2xl relative overflow-hidden group`}>
                          {isDone && <div className="absolute top-0 right-0 p-8 text-blue-600/5"><CheckCircle2 className="w-40 h-40" /></div>}
                          <div className="flex flex-col lg:flex-row gap-16 relative z-10">
                            <div className="flex-1 space-y-8">
                              <div className="flex justify-between items-start gap-4">
                                <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-4 tracking-tight">
                                  <span className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-xl font-black ${isDone ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 dark:bg-blue-900/20 text-slate-400'}`}>{isDone ? <CheckCircle2 className="w-7 h-7" /> : idx + 1}</span>
                                  {lesson.title}
                                </h2>
                                <div className="flex gap-2">
                                  <button onClick={() => handleNarration(idx, lesson.content)} className="p-3 rounded-2xl bg-slate-50 dark:bg-blue-900/20 transition-colors hover:bg-slate-200 dark:hover:bg-blue-900/40 shadow-sm">
                                    {isAudioLoading ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <Volume2 className="w-5 h-5 dark:text-blue-400" />}
                                  </button>
                                  <button onClick={() => setState(p => ({...p, completedLessons: isDone ? p.completedLessons.filter(i => i !== idx) : [...p.completedLessons, idx]}))} className={`px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${isDone ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20' : 'bg-black text-white hover:bg-slate-900 shadow-lg'}`}>{isDone ? 'Finished' : 'Mark Done'}</button>
                                </div>
                              </div>
                              <div className="prose prose-lg dark:prose-invert max-w-none text-slate-600 dark:text-blue-100/60 font-medium leading-relaxed whitespace-pre-wrap">{lesson.content}</div>
                              
                              <AnimatePresence>
                                {lesson.expandedContent && (
                                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-8 bg-slate-50 dark:bg-blue-950/30 rounded-[2rem] border-l-8 border-blue-600 shadow-inner">
                                    <h4 className="text-sm font-black text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2 uppercase tracking-widest"><Sparkles className="w-4 h-4" /> Professional Insight <ProBadge /></h4>
                                    <div className="text-base text-slate-600 dark:text-blue-100/60 leading-loose whitespace-pre-wrap font-medium">{lesson.expandedContent}</div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div className="flex gap-4 pt-4 no-print">
                                <button onClick={() => handleExpandLesson(idx)} disabled={isExpanding} className="flex items-center gap-3 text-sm font-black text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity disabled:opacity-50">
                                  {isExpanding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                                  Deep Tech Analysis <ProBadge />
                                </button>
                              </div>
                            </div>

                            <div className="w-full lg:w-[400px] space-y-6 no-print">
                              <div className="bg-black rounded-[2.5rem] p-2 border-4 border-slate-100 dark:border-blue-900/20 shadow-2xl overflow-hidden group/video">
                                <div className="aspect-video relative flex items-center justify-center text-white p-6 bg-slate-900 dark:bg-blue-950/20 rounded-[2rem]">
                                  {state.videoUrl && state.isVideoGenerating === false ? (
                                    <video src={state.videoUrl} controls className="w-full h-full rounded-[1.8rem]" />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-center space-y-6">
                                      {state.isVideoGenerating ? (
                                        <div className="flex flex-col items-center gap-4">
                                          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                                          <p className="text-xs font-black uppercase tracking-widest text-blue-600">Rendering {state.videoResolution} Video...</p>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-2"><Video className="w-8 h-8 text-blue-600" /></div>
                                          <div className="space-y-2">
                                            <p className="text-sm font-black uppercase tracking-widest text-slate-300">Veo 3 Architecture <ProBadge /></p>
                                            <p className="text-xs text-slate-500 font-medium px-4">Generate custom technical visualization.</p>
                                          </div>
                                          
                                          <div className="w-full space-y-4 pt-4 px-4">
                                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest bg-blue-900/20 p-3 rounded-2xl">
                                              <span className="flex items-center gap-2"><Sliders className="w-3 h-3" /> Config</span>
                                              <div className="flex gap-4">
                                                <button onClick={() => setState(p => ({...p, videoOrientation: p.videoOrientation === '16:9' ? '9:16' : '16:9'}))} className="flex items-center gap-1 hover:text-white transition-colors">
                                                  {state.videoOrientation === '16:9' ? <Monitor className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                                                  {state.videoOrientation}
                                                </button>
                                                <button onClick={() => setState(p => ({...p, videoResolution: p.videoResolution === '720p' ? '1080p' : '720p'}))} className="hover:text-white transition-colors">
                                                  {state.videoResolution}
                                                </button>
                                              </div>
                                            </div>
                                            <button onClick={() => handleGenerateVideoClick(lesson.title)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-blue-600/20">Generate Video</button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="p-6 bg-slate-50 dark:bg-blue-900/10 rounded-3xl border dark:border-blue-900/20">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><ShieldCheck className="w-3 h-3 text-blue-600" /> Critical takeaways</h4>
                                <ul className="space-y-3">
                                  {lesson.keyTakeaways.map((k, ki) => (
                                    <li key={ki} className="text-xs font-bold text-slate-600 dark:text-blue-100/60 flex items-start gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 flex-shrink-0" />
                                      {k}
                                    </li>
                                  ))}
                                </ul>
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
            <motion.div key="analyze-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto py-12 space-y-12">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto transition-colors"><FileVideo className="text-blue-600 w-10 h-10" /></div>
                <h2 className="text-4xl font-black dark:text-white tracking-tighter">Video Reasoning <ProBadge /></h2>
                <p className="text-slate-500 dark:text-blue-200/60 font-medium">Cognitive visual analysis for expert level comprehension.</p>
              </div>
              <div className="bg-white dark:bg-black p-16 rounded-[3rem] border-4 border-dashed dark:border-blue-900/30 text-center shadow-inner card-premium-border">
                <label className="cursor-pointer group block">
                  <div className="flex flex-col items-center gap-6">
                    <span className="px-12 py-5 bg-black dark:bg-blue-600 text-white rounded-[2rem] font-black text-lg group-hover:scale-110 transition-transform shadow-2xl">Upload Video Context</span>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Architectural analysis enabled</p>
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
              {state.isAnalyzingVideo && (
                <div className="text-center py-12 flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin w-12 h-12 text-blue-600" />
                  <p className="text-sm font-black text-blue-600 uppercase tracking-[0.3em]">Processing Metadata...</p>
                </div>
              )}
              {state.videoAnalysis && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-12 bg-white dark:bg-black rounded-[3rem] border-2 border-blue-600/20 shadow-2xl prose prose-lg dark:prose-invert max-w-none">
                  <h3 className="text-3xl font-black mb-8 flex items-center gap-4 text-blue-600 dark:text-blue-400 tracking-tighter"><Brain /> Cognitive Breakdown</h3>
                  <div className="whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-blue-100/60 font-medium">{state.videoAnalysis}</div>
                </motion.div>
              )}
            </motion.div>
          ) : activeTab === 'certified' ? (
            <motion.div key="certified-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto py-12 space-y-12">
              <div className="bg-gradient-to-br from-blue-600 via-blue-800 to-black p-16 rounded-[3.5rem] text-white space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12"><Award className="w-64 h-64" /></div>
                <div className="relative z-10 space-y-6">
                  <div className="px-5 py-1.5 bg-white/10 backdrop-blur-md rounded-full w-fit text-xs font-black tracking-[0.2em] uppercase flex items-center gap-2 border border-white/20">
                    <Sparkles className="w-3 h-3 text-blue-400" /> Academic Engine <ProBadge />
                  </div>
                  <h2 className="text-6xl font-black tracking-tighter leading-none">Professional Degree Architect</h2>
                  <p className="text-2xl font-medium max-w-3xl leading-relaxed opacity-95">Multi-year expert roadmaps designed for world-class technical competence.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white dark:bg-black p-12 rounded-[3rem] border-2 dark:border-blue-900/30 space-y-8 shadow-xl">
                  <h3 className="text-3xl font-black dark:text-white flex items-center gap-4 tracking-tighter"><ShieldCheck className="text-blue-600 w-8 h-8" /> Academic Portal</h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-blue-400 uppercase tracking-widest">Professional Discipline</label>
                      <input type="text" placeholder="e.g. Mechanical Engineering, Journalism..." value={topic} onChange={e => setTopic(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-blue-950/20 rounded-2xl border dark:border-blue-900/30 outline-none focus:ring-4 ring-blue-600/10 font-bold transition-all dark:text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map(y => (
                        <button key={y} onClick={() => handleGenerateCertified(y)} className="group py-5 rounded-[1.5rem] border-2 border-slate-100 dark:border-blue-900/20 font-black text-sm text-slate-600 dark:text-blue-400 hover:border-blue-600 hover:text-blue-600 transition-all flex flex-col items-center gap-2">
                          <span className="text-2xl group-hover:scale-110 transition-transform">{y}</span>
                          Year {y === 1 ? 'Cert' : y === 2 ? 'Dipl' : 'Deg'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-black p-12 rounded-[3rem] border-2 border-blue-900/30 flex flex-col items-center justify-center text-center space-y-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-full pro-gradient opacity-0 group-hover:opacity-10 transition-opacity duration-700" />
                  <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center"><Map className="text-blue-600 w-10 h-10" /></div>
                  <div className="space-y-3 relative z-10">
                    <h4 className="font-black text-white uppercase tracking-[0.3em] text-xs">Knowledge architecture</h4>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">Certification pathways utilize heavy reasoning to simulate academic board verified curriculums.</p>
                  </div>
                  <ProBadge />
                </div>
              </div>

              {state.isGenerating && (
                <div className="text-center py-16 space-y-4">
                  <Loader2 className="animate-spin mx-auto w-16 h-16 text-blue-600" />
                  <p className="font-black text-blue-600 uppercase tracking-[0.3em] text-xs">Architecting Roadmap...</p>
                </div>
              )}

              {state.certifiedPathway && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-12">
                  <div className="text-center space-y-3">
                    <h2 className="text-5xl font-black dark:text-white tracking-tighter">{state.certifiedPathway.title}</h2>
                    <div className="flex items-center justify-center gap-4">
                      <span className="text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest text-xs border-2 border-blue-600/20 px-4 py-1.5 rounded-full">Duration: {state.certifiedPathway.duration}</span>
                      <span className="pro-gradient text-white font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest">Verified Path</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {state.certifiedPathway.roadmap.map((y, i) => (
                      <div key={i} className="bg-white dark:bg-black p-10 rounded-[2.5rem] border-2 border-slate-100 dark:border-blue-900/30 shadow-2xl hover:border-blue-600 transition-all">
                        <div className="flex items-center justify-between mb-8">
                          <h4 className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter transition-colors">Year {y.year}</h4>
                          <Zap className="w-6 h-6 text-blue-600 opacity-20" />
                        </div>
                        <div className="space-y-8">
                          {y.semesters.map((s, si) => (
                            <div key={si} className="space-y-3">
                              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-blue-300/40 tracking-[0.2em] bg-slate-50 dark:bg-blue-950/30 px-3 py-1 rounded-md">Semester {si + 1}</span>
                              <p className="text-lg font-bold dark:text-blue-100/80 leading-relaxed">{s}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div key="library-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto py-12 space-y-8">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto"><Library className="text-blue-600 w-10 h-10" /></div>
                <h2 className="text-4xl font-black dark:text-white tracking-tighter">Your Intelligence Hub</h2>
                <p className="text-slate-500 dark:text-blue-200/60 font-medium">Persistent offline knowledge components.</p>
              </div>

              {state.savedCourses.length === 0 ? (
                <div className="bg-white dark:bg-black p-20 rounded-[3rem] border-2 border-dashed dark:border-blue-900/30 text-center space-y-4">
                  <p className="text-slate-400 dark:text-blue-400 font-bold uppercase tracking-widest text-sm">Library empty.</p>
                  <button onClick={() => setActiveTab('learn')} className="text-blue-600 dark:text-blue-400 font-black hover:underline">Download knowledge</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {state.savedCourses.map((saved) => (
                    <div key={saved.id} onClick={() => handleLoadSaved(saved)} className="bg-white dark:bg-black p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-blue-900/30 shadow-xl hover:border-blue-600 transition-all cursor-pointer group relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-5 transition-opacity"><Library className="w-24 h-24 text-blue-600" /></div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-600/10 px-3 py-1 rounded-full">
                          {saved.depth}
                        </div>
                        <button onClick={(e) => handleDeleteSaved(saved.id, e)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="text-2xl font-black dark:text-white mb-2 tracking-tight group-hover:text-blue-600 transition-colors relative z-10">{saved.content.topic}</h3>
                      <p className="text-sm text-slate-500 dark:text-blue-100/40 mb-6 line-clamp-2 relative z-10">{saved.content.summary}</p>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 relative z-10">
                        <span className="flex items-center gap-2"><History className="w-3 h-3" /> {new Date(saved.savedAt).toLocaleDateString()}</span>
                        <span className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Resume →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }} className="fixed bottom-28 right-8 w-[450px] h-[600px] bg-white dark:bg-black shadow-2xl rounded-[3rem] border-2 dark:border-blue-900/30 z-50 flex flex-col overflow-hidden">
            <div className="p-6 bg-black text-white flex justify-between items-center shadow-lg transition-colors border-b border-blue-900/30">
              <span className="font-black flex items-center gap-3 text-lg tracking-tighter"><MessageSquare className="w-6 h-6 text-blue-600" /> AI Support <ProBadge /></span>
              <button onClick={() => setIsChatOpen(false)} className="hover:rotate-90 transition-transform"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-blue-950/20">
              {state.chatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                  <MessageSquare className="w-16 h-16 mb-4 text-blue-600" />
                  <p className="font-bold text-sm uppercase tracking-widest dark:text-blue-200">Start a high-reasoning thread</p>
                </div>
              )}
              {state.chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-[1.5rem] text-sm font-semibold shadow-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-black dark:text-blue-100 rounded-tl-none border-2 dark:border-blue-900/30'}`}>{m.text}</div>
                </div>
              ))}
              {state.isChatLoading && <div className="flex justify-start"><Loader2 className="animate-spin w-5 h-5 text-blue-600" /></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-6 flex gap-3 border-t dark:border-blue-900/30 bg-white dark:bg-black">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder="Ask complex educational questions..." className="flex-1 bg-slate-100 dark:bg-blue-900/20 rounded-2xl px-5 text-sm font-bold outline-none border-2 border-transparent focus:border-blue-600 transition-all dark:text-white" />
              <button onClick={handleChat} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-xl transition-all"><Send className="w-6 h-6" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group border border-blue-400/20">
        <MessageSquare className="w-8 h-8 group-hover:rotate-12 transition-transform" />
      </button>
    </div>
  );
};

export default App;
