/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Search, 
  Play, 
  Pause, 
  Volume2, 
  Film, 
  Star, 
  Loader2, 
  Mic2,
  ChevronRight,
  History,
  Trash2,
  Sparkles,
  BookOpen,
  Heart,
  MessageCircle,
  Users,
  User,
  Globe
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface MovieReview {
  title: string;
  content: string;
  rating: number;
  genre: string;
  year: string;
}

export default function App() {
  const [movieName, setMovieName] = useState('');
  const [movieContent, setMovieContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<MovieReview | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [randomLoading, setRandomLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ngẫu nhiên');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const categories = [
    { id: 'ngẫu nhiên', label: 'Ngẫu nhiên', icon: <Sparkles size={16} /> },
    { id: 'vùng miền', label: 'Vùng miền', icon: <Globe size={16} /> },
    { id: 'học đường', label: 'Học đường', icon: <BookOpen size={16} /> },
    { id: 'tình yêu', label: 'Tình yêu', icon: <Heart size={16} /> },
    { id: 'tâm sự', label: 'Tâm sự', icon: <MessageCircle size={16} /> },
    { id: 'tình cha con', label: 'Tình cha con', icon: <Users size={16} /> },
    { id: 'tình mẹ con', label: 'Tình mẹ con', icon: <User size={16} /> },
    { id: 'cuộc sống', label: 'Cuộc sống', icon: <Globe size={16} /> },
  ];

  const categoryThemes: Record<string, string[]> = {
    'vùng miền': [
      "Ký ức về những con hẻm nhỏ ở Hà Nội mùa thu",
      "Chuyện tình bên bờ sông Hàn, Đà Nẵng",
      "Vẻ đẹp cổ kính của Hội An, Quảng Nam và những phận đời",
      "Hà Nội và những gánh hàng rong sáng sớm",
      "Đà Nẵng - Thành phố của những cây cầu và tình người",
      "Quảng Nam - Đất mẹ anh hùng và những kỷ niệm khó quên"
    ],
    'học đường': [
      "Tình bạn tuổi học trò dưới mái trường xưa",
      "Người thầy giáo già và những học sinh cá biệt",
      "Kỷ niệm mùa hè cuối cùng thời học sinh",
      "Bức thư tình giấu kín trong ngăn bàn"
    ],
    'tình yêu': [
      "Mối tình đầu dang dở sau 10 năm gặp lại",
      "Tình yêu vượt qua khoảng cách địa lý và thời gian",
      "Sự hy sinh thầm lặng trong tình yêu",
      "Hẹn ước dưới gốc cây đa làng"
    ],
    'tâm sự': [
      "Lời xin lỗi chưa kịp nói với người bạn thân",
      "Những trăn trở của tuổi trẻ khi đứng trước ngưỡng cửa cuộc đời",
      "Nỗi lòng của người con xa quê hương",
      "Góc khuất sau vẻ hào nhoáng của thành thị"
    ],
    'tình cha con': [
      "Tình cha con thầm lặng của người lái xe ôm",
      "Bàn tay chai sạn của cha và giấc mơ của con",
      "Chuyến đi cuối cùng của hai cha con",
      "Chiếc xe đạp cũ và hành trình vào đại học"
    ],
    'tình mẹ con': [
      "Nồi canh của mẹ và những ngày đông giá rét",
      "Sự hy sinh cả đời của mẹ cho sự nghiệp của con",
      "Lời ru của mẹ theo con suốt cuộc đời",
      "Đôi mắt mẹ mờ đi vì sương gió"
    ],
    'cuộc sống': [
      "Lòng tốt bất ngờ của người lạ trong đêm mưa Sài Gòn",
      "Ước mơ dang dở của cô bán hàng rong và cái kết bất ngờ",
      "Chuyến xe cuối cùng của năm và cuộc gặp gỡ định mệnh",
      "Tiệm sửa giày cũ và những câu chuyện đời"
    ]
  };

  const clearInputs = () => {
    setMovieName('');
    setMovieContent('');
    setReview(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const generateRandomStory = async () => {
    setRandomLoading(true);
    let themes: string[] = [];
    
    if (selectedCategory === 'ngẫu nhiên') {
      themes = Object.values(categoryThemes).flat();
    } else {
      themes = categoryThemes[selectedCategory] || [];
    }
    
    const randomTheme = themes[Math.floor(Math.random() * themes.length)] || "Một câu chuyện đời thường đầy ý nghĩa";
    
    try {
      const prompt = `Hãy viết một câu chuyện kể chuyện cảm động về chủ đề: "${randomTheme}".
      
      Bối cảnh cụ thể: 
      - Nếu chủ đề liên quan đến Hà Nội, hãy mô tả vẻ đẹp cổ kính, những con phố nhỏ, gánh hàng rong và nét thanh lịch của người Tràng An.
      - Nếu chủ đề liên quan đến Đà Nẵng, hãy mô tả sự hiện đại hòa quyện cùng thiên nhiên, sông Hàn, những cây cầu và sự chân chất của người dân miền Trung.
      - Nếu chủ đề liên quan đến Quảng Nam, hãy mô tả vẻ đẹp trầm mặc của Hội An, những cánh đồng lúa, và sự kiên cường của mảnh đất này.
      
      Phong cách:
      - Giống truyện kể trên YouTube (narration)
      - Có yếu tố cảm động và bất ngờ
      - Nhịp kể chậm rãi, sâu lắng
      - Đoạn văn ngắn để dễ đọc (mỗi đoạn 1-3 câu)
      
      Cấu trúc:
      - Hook gây tò mò trong 3 đoạn đầu
      - Giới thiệu nhân vật chính là người bình thường trong xã hội Việt Nam hiện đại
      - Biến cố thay đổi cuộc đời
      - Nhân vật gặp một người đặc biệt
      - Mối quan hệ dần phát triển
      - Cao trào cảm xúc và thử thách lớn
      - Plot twist nhẹ
      - Kết thúc ý nghĩa, khiến người nghe suy ngẫm
      
      Yêu cầu kỹ thuật:
      - Độ dài: Cố gắng viết chi tiết, dài và sâu sắc (khoảng 1200-2000 từ nếu có thể).
      - Văn phong: Kể chuyện chậm rãi, cảm xúc, dễ nghe.
      - Không dùng hội thoại quá dài.
      - Viết theo giọng kể chuyện, không chia tiêu đề.
      - Phù hợp để đọc bằng AI voice.
      
      Bối cảnh: Việt Nam hiện đại.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", // Use Pro for longer, better stories
        contents: prompt,
      });

      const story = response.text || '';
      setMovieContent(story);
      setMovieName(randomTheme);
      setReview(null); // Clear previous review if any
    } catch (error) {
      console.error("Error generating random story:", error);
    } finally {
      setRandomLoading(false);
    }
  };

  // Helper to create a WAV header for raw PCM data (16-bit, mono, 24000Hz)
  const createWavHeader = (dataLength: number) => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataLength, true); // file length
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // format chunk length
    view.setUint16(20, 1, true); // sample format (PCM)
    view.setUint16(22, 1, true); // channel count (mono)
    view.setUint32(24, 24000, true); // sample rate
    view.setUint32(28, 24000 * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLength, true); // data chunk length
    return buffer;
  };

  const generateReview = async () => {
    if (!movieName.trim()) return;
    setLoading(true);
    setReview(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    
    try {
      const prompt = `Hãy viết một bài review phim cực kỳ kịch tính, hấp dẫn và sâu sắc cho bộ phim: "${movieName}". 
        ${movieContent ? `Dựa trên nội dung/tóm tắt sau: "${movieContent}"` : ''}
        Yêu cầu:
        1. Ngôn ngữ: Tiếng Việt.
        2. Phong cách: Chuyên nghiệp, lôi cuốn, có cao trào.
        3. Định dạng JSON: { "title": "Tên phim", "content": "Nội dung review", "rating": 8.5, "genre": "Thể loại", "year": "Năm phát hành" }`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const data = JSON.parse(response.text || '{}') as MovieReview;
      setReview(data);
    } catch (error) {
      console.error("Error generating review:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateTTS = async (customText?: string) => {
    const text = customText || (review ? `Phim: ${review.title}\nNội dung: ${review.content}` : '');
    if (!text) return;
    setTtsLoading(true);
    setTtsProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setTtsProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);
    
    try {
      const prompt = customText 
        ? `Hãy đọc đoạn văn sau với giọng điệu sáng, ấm áp, nhẹ nhàng và truyền cảm. Nhấn nhá đúng chỗ, giữ nhịp điệu ổn định và tự nhiên từ đầu đến cuối: ${customText}`
        : `Hãy đọc bài review phim sau đây với giọng điệu sáng, ấm áp, nhẹ nhàng và truyền cảm. Nhấn nhá đúng chỗ, giữ nhịp điệu ổn định và tự nhiên từ đầu đến cuối:
          Phim: ${review?.title}
          Nội dung: ${review?.content}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, 
            },
          },
        },
      });

      setTtsProgress(100);
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // Sanitize base64 string (remove any potential whitespace/newlines)
        const sanitizedBase64 = base64Audio.replace(/\s/g, '');
        
        // Convert base64 to Uint8Array more reliably
        const binaryString = atob(sanitizedBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        let byteArray = bytes;
        
        // Ensure the data length is even for 16-bit PCM
        if (byteArray.length % 2 !== 0) {
          byteArray = byteArray.slice(0, byteArray.length - 1);
        }
        
        // Add WAV header to raw PCM data
        const wavHeader = createWavHeader(byteArray.length);
        const wavBlob = new Blob([wavHeader, byteArray], { type: 'audio/wav' });
        
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);
      }
    } catch (error) {
      console.error("Error generating TTS:", error);
    } finally {
      clearInterval(progressInterval);
      setTtsLoading(false);
      setTimeout(() => setTtsProgress(0), 1000);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    // Use movieName or review title as filename
    const fileName = (movieName || review?.title || 'cinevoice').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${fileName}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Playback failed:", e));
      }
    }
  };

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
    }
  }, [audioUrl]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-24">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            <Film size={14} />
            AI MOVIE REVIEWER
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
            CineVoice AI
          </h1>
          <p className="text-zinc-400 text-base max-w-xl mx-auto">
            Khám phá những góc nhìn điện ảnh sâu sắc với giọng đọc AI kịch tính và đầy cảm xúc.
          </p>
        </header>

        {/* Search Section */}
        <div className="space-y-6 mb-16">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 flex items-center gap-3 p-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus-within:border-emerald-500/50 transition-all shadow-2xl backdrop-blur-xl">
                <div className="pl-4 text-zinc-500">
                  <Film size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder="Nhập tên bộ phim hoặc chủ đề..."
                  className="flex-1 bg-transparent border-none outline-none py-3 text-base placeholder:text-zinc-600"
                  value={movieName}
                  onChange={(e) => setMovieName(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-full p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus:border-emerald-500/50 transition-all outline-none text-zinc-300 appearance-none cursor-pointer backdrop-blur-xl text-sm"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-zinc-900 text-zinc-300">
                      {cat.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </div>
            </div>

            <textarea 
              placeholder="Nhập tóm tắt nội dung hoặc cảm nhận sơ bộ của bạn về phim (tùy chọn)..."
              className="w-full min-h-[160px] p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus:border-emerald-500/50 transition-all outline-none text-zinc-300 placeholder:text-zinc-600 resize-none backdrop-blur-xl"
              value={movieContent}
              onChange={(e) => setMovieContent(e.target.value)}
            />
          </div>

          {ttsLoading && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex justify-between text-[10px] uppercase tracking-widest text-emerald-500 font-bold">
                <span>Đang tạo giọng đọc AI...</span>
                <span>{Math.round(ttsProgress)}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                  style={{ width: `${ttsProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
            <button 
              onClick={clearInputs}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-zinc-800"
            >
              <Trash2 size={16} />
              Xóa
            </button>
            <button 
              onClick={generateRandomStory}
              disabled={randomLoading}
              className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-blue-500/30"
            >
              {randomLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Truyện Ngẫu Nhiên
            </button>
            <button 
              onClick={() => generateTTS(movieContent)}
              disabled={ttsLoading || !movieContent.trim()}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
            >
              {ttsLoading ? <Loader2 className="animate-spin" size={16} /> : <Mic2 size={16} />}
              Tạo Voice
            </button>
            <button 
              onClick={generateReview}
              disabled={loading || !movieName.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <ChevronRight size={16} />}
              Tạo Review
            </button>
          </div>
        </div>

        {/* Audio Player UI (Global) */}
        {audioUrl && (
          <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center gap-6 backdrop-blur-xl shadow-2xl shadow-emerald-900/20">
              <button 
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/40"
              >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Volume2 size={16} />
                    {review ? `Review: ${review.title}` : "Giọng đọc AI theo yêu cầu"}
                  </span>
                  <button 
                    onClick={downloadAudio}
                    className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black text-xs font-bold transition-all border border-emerald-500/30"
                  >
                    Tải về (.wav)
                  </button>
                </div>
                <div className="h-2 bg-zinc-800/50 rounded-full overflow-hidden border border-zinc-700/30">
                  <div className={cn(
                    "h-full bg-emerald-500 transition-all duration-300",
                    isPlaying ? "w-full animate-pulse" : "w-1/3"
                  )} />
                </div>
              </div>
              
              <audio 
                ref={audioRef} 
                src={audioUrl} 
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Content Section */}
        {review && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Movie Info Card */}
              <div className="md:col-span-1">
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 sticky top-8 backdrop-blur-md">
                  <div className="aspect-[2/3] bg-zinc-800 rounded-2xl mb-6 overflow-hidden relative group">
                    <img 
                      src={`https://picsum.photos/seed/${review.title}/600/900`} 
                      alt={review.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-1 text-yellow-500 mb-1">
                        <Star size={16} fill="currentColor" />
                        <span className="font-bold text-lg">{review.rating}</span>
                        <span className="text-zinc-400 text-sm font-normal">/10</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Thể loại</label>
                      <p className="text-zinc-200">{review.genre}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Năm phát hành</label>
                      <p className="text-zinc-200">{review.year}</p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button 
                      onClick={() => generateTTS()}
                      disabled={ttsLoading}
                      className="w-full py-3 bg-white text-black text-sm font-bold rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                    >
                      {ttsLoading ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <>
                          <Mic2 size={18} />
                          Nghe Review AI
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Review Content */}
              <div className="md:col-span-2 space-y-8">
                <div className="bg-zinc-900/20 border border-zinc-800/50 rounded-3xl p-8 md:p-10 backdrop-blur-sm">
                  <h2 className="text-2xl font-bold mb-6 text-white leading-tight">
                    {review.title}
                  </h2>
                  
                  <div className="prose prose-invert max-w-none">
                    <p className="text-zinc-300 text-base leading-relaxed whitespace-pre-wrap italic">
                      "{review.content}"
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl">
                    <History className="text-emerald-500 mb-3" size={24} />
                    <h4 className="font-bold text-white mb-1">Kịch tính</h4>
                    <p className="text-zinc-500 text-sm">Giọng đọc được tối ưu cho các phân cảnh cao trào.</p>
                  </div>
                  <div className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl">
                    <Star className="text-emerald-500 mb-3" size={24} />
                    <h4 className="font-bold text-white mb-1">Sâu sắc</h4>
                    <p className="text-zinc-500 text-sm">Phân tích đa chiều về nội dung và nghệ thuật.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!review && !loading && (
          <div className="mt-24 text-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl">
            <Film className="mx-auto text-zinc-700 mb-4" size={48} />
            <p className="text-zinc-500">Bắt đầu bằng cách tìm kiếm bộ phim yêu thích của bạn.</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mt-24 text-center py-20">
            <Loader2 className="mx-auto text-emerald-500 animate-spin mb-4" size={48} />
            <p className="text-zinc-400 animate-pulse">Đang phân tích dữ liệu điện ảnh...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>© 2026 CineVoice AI. Powered by Gemini Flash 2.5 & 3.1</p>
      </footer>
    </div>
  );
}
