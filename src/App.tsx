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
  Download,
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
// @ts-ignore
import lamejs from 'lamejs';

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
  const [audioParts, setAudioParts] = useState<{ url: string, title: string }[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [randomLoading, setRandomLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const clearInputs = () => {
    setMovieName('');
    setMovieContent('');
    setReview(null);
    if (audioParts.length > 0) {
      audioParts.forEach(part => URL.revokeObjectURL(part.url));
      setAudioParts([]);
    }
  };

  const generateStoryFromTitle = async () => {
    if (!movieName.trim()) {
      setError("Vui lòng nhập tiêu đề truyện trước khi tạo.");
      return;
    }
    setRandomLoading(true);
    setError(null);
    
    try {
      const prompt = `Bạn là một nhà văn chuyên viết truyện kể cảm động, giàu cảm xúc. Hãy viết một câu chuyện dựa trên TIÊU ĐỀ sau: "${movieName}"

## NHIỆM VỤ:
- **BỐI CẢNH**: Tự động suy luận và xây dựng bối cảnh phù hợp nhất dựa trên TIÊU ĐỀ. Nếu tiêu đề gợi ý về:
  * Một địa danh cụ thể (Hà Nội, Sài Gòn, Huế, Đà Nẵng, Hội An, v.v.) → lấy bối cảnh chính tại nơi đó
  * Một nghề nghiệp, sự kiện, thời gian → xây dựng bối cảnh tương ứng
  * Không có gợi ý rõ ràng → sáng tạo bối cảnh Việt Nam hiện đại phù hợp với câu chuyện

## NHÂN VẬT:
- Tạo 1-2 nhân vật chính (nam/nữ, già/trẻ) với tên thuần Việt, gần gũi
- Khắc họa tính cách, hoàn cảnh sống và khát vọng của nhân vật một cách tự nhiên

## CẤU TRÚC TRUYỆN (Khoảng 1500-2000 từ):

**Mở đầu (3-4 đoạn)**
- Hook gây tò mò ngay từ những dòng đầu tiên
- Giới thiệu bối cảnh không gian, thời gian
- Gợi mở vấn đề hoặc cảm xúc chủ đạo

**Giới thiệu nhân vật (4-5 đoạn)**
- Giới thiệu nhân vật chính
- Khắc họa cuộc sống, thói quen, những điều bình dị
- Ẩn chứa những trăn trở, khao khát thầm kín

**Biến cố (3-4 đoạn)**
- Một sự kiện bất ngờ xảy ra, thay đổi cuộc đời nhân vật
- Có thể là mất mát, cơ hội, cuộc gặp định mệnh
- Đẩy nhân vật vào tình huống phải lựa chọn

**Hành trình và kết nối (5-6 đoạn)**
- Nhân vật gặp một người đặc biệt (tri kỷ, ân nhân, hoặc người cần giúp đỡ)
- Mối quan hệ phát triển tự nhiên qua những chi tiết nhỏ
- Những hy sinh, thấu hiểu và đồng cảm

**Cao trào và bất ngờ (3-4 đoạn)**
- Thử thách lớn nhất đặt ra
- Bí mật được hé lộ (về quá khứ, về nhân vật thứ hai)
- Plot twist nhẹ nhàng nhưng đủ sâu sắc, không khiên cưỡng

**Kết thúc (2-3 đoạn)**
- Giải quyết vấn đề theo hướng nhân văn
- Đọng lại cảm xúc, dư âm
- Thông điệp ý nghĩa về tình người, cuộc sống

## PHONG CÁCH VIẾT:
✓ **Giọng văn**: Chậm rãi, sâu lắng, giàu hình ảnh, như đang kể chuyện đêm khuya
✓ **Câu văn**: Ngắn gọn (1-3 câu/đoạn), dễ đọc, dễ nghe, phù hợp với AI voice
✓ **Ngôn từ**: Trong sáng, giàu chất thơ, đậm chất Việt Nam
✓ **Cảm xúc**: Tinh tế, không sướt mướt nhưng đủ lay động
✓ **Nhịp điệu**: Linh hoạt - lúc chậm để lắng đọng, lúc nhanh để tạo kịch tính

## LƯU Ý:
- KHÔNG dùng hội thoại quá dài, chủ yếu là kể chuyện
- KHÔNG chia thành các phần như trên (viết liền mạch)
- KHÔNG dùng tiêu đề phụ, chỉ viết thuần văn xuôi
- ĐẶC BIỆT: Bối cảnh phải PHÙ HỢP VỚI TIÊU ĐỀ - nếu tiêu đề nhắc đến địa danh nào, hãy khai thác chất liệu văn hóa, con người nơi đó
- Hãy để câu chuyện tự nhiên như đang kể cho người thân nghe

Bắt đầu câu chuyện ngay bây giờ:`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Switch to Flash to avoid quota issues
        contents: prompt,
      });

      const story = response.text || '';
      setMovieContent(story);
      setReview(null); // Clear previous review if any
    } catch (error: any) {
      console.error("Error generating random story:", error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setError("Hệ thống đang quá tải (hết lượt dùng thử). Vui lòng thử lại sau vài phút hoặc đổi chủ đề khác.");
      } else {
        setError("Có lỗi xảy ra khi tạo truyện. Vui lòng thử lại.");
      }
    } finally {
      setRandomLoading(false);
    }
  };

  const generateTTS = async (customText?: string) => {
    const text = customText || (review ? `Phim: ${review.title}\nNội dung: ${review.content}` : '');
    if (!text) return;
    setTtsLoading(true);
    setTtsProgress(0);
    setError(null);

    // Clear old parts
    audioParts.forEach(part => URL.revokeObjectURL(part.url));
    setAudioParts([]);

    // Split text into 3 parts
    const sentences = text.split(/[.!?]\s+/);
    const partSize = Math.ceil(sentences.length / 3);
    const textParts = [
      sentences.slice(0, partSize).join('. ') + '.',
      sentences.slice(partSize, partSize * 2).join('. ') + '.',
      sentences.slice(partSize * 2).join('. ') + '.'
    ].filter(p => p.trim().length > 1);

    const progressInterval = setInterval(() => {
      setTtsProgress(prev => {
        if (prev >= 95) return prev;
        return prev + 2;
      });
    }, 500);

    try {
      const newParts: { url: string, title: string }[] = [];

      for (let i = 0; i < textParts.length; i++) {
        const partText = textParts[i];
        const prompt = `Hãy đọc đoạn văn sau với giọng điệu sáng, ấm áp, nhẹ nhàng và truyền cảm. Nhấn nhá đúng chỗ, giữ nhịp điệu ổn định và tự nhiên: ${partText}`;

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

        const parts = response.candidates?.[0]?.content?.parts || [];
        const decodedChunks: Uint8Array[] = [];
        let totalByteLength = 0;

        for (const part of parts) {
          if (part.inlineData?.data) {
            const sanitizedBase64 = part.inlineData.data.replace(/\s/g, '');
            const binaryString = atob(sanitizedBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
            }
            decodedChunks.push(bytes);
            totalByteLength += bytes.length;
          }
        }

        if (decodedChunks.length > 0) {
          const combinedBytes = new Uint8Array(totalByteLength);
          let offset = 0;
          for (const chunk of decodedChunks) {
            combinedBytes.set(chunk, offset);
            offset += chunk.length;
          }

          // Convert to MP3
          try {
            const pcmLength = Math.floor(combinedBytes.length / 2);
            const int16Samples = new Int16Array(combinedBytes.buffer, combinedBytes.byteOffset, pcmLength);
            const lame = (lamejs as any).default || lamejs;
            const mp3encoder = new lame.Mp3Encoder(1, 24000, 128);
            const mp3Data: Uint8Array[] = [];
            
            const chunkSize = 1152 * 10;
            for (let j = 0; j < int16Samples.length; j += chunkSize) {
              const chunk = int16Samples.subarray(j, j + chunkSize);
              const mp3buf = mp3encoder.encodeBuffer(chunk);
              if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
            }
            
            const mp3Final = mp3encoder.flush();
            if (mp3Final.length > 0) mp3Data.push(new Uint8Array(mp3Final));
            
            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            newParts.push({ url: URL.createObjectURL(blob), title: `Phần ${i + 1}` });
          } catch (e) {
            // Fallback to WAV
            const wavHeader = new ArrayBuffer(44);
            const view = new DataView(wavHeader);
            view.setUint32(0, 0x52494646, false);
            view.setUint32(4, 36 + combinedBytes.length, true);
            view.setUint32(8, 0x57415645, false);
            view.setUint32(12, 0x666d7420, false);
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, 24000, true);
            view.setUint32(28, 24000 * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            view.setUint32(36, 0x64617461, false);
            view.setUint32(40, combinedBytes.length, true);
            
            const blob = new Blob([wavHeader, combinedBytes], { type: 'audio/wav' });
            newParts.push({ url: URL.createObjectURL(blob), title: `Phần ${i + 1}` });
          }
        }
        setTtsProgress(Math.round(((i + 1) / textParts.length) * 100));
      }

      setAudioParts(newParts);
      setCurrentPartIndex(0);
      setCurrentTime(0);
      setDuration(0);
    } catch (error: any) {
      console.error("Error generating TTS:", error);
      setError("Có lỗi xảy ra khi tạo giọng nói. Vui lòng thử lại.");
    } finally {
      clearInterval(progressInterval);
      setTtsLoading(false);
      setTimeout(() => setTtsProgress(0), 1000);
    }
  };

  const downloadAudio = (index: number) => {
    const part = audioParts[index];
    if (!part) return;
    const link = document.createElement('a');
    link.href = part.url;
    const fileName = (movieName || review?.title || 'blogradio').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const extension = part.url.includes('audio/wav') || !part.url.includes('mp3') ? 'wav' : 'mp3';
    link.download = `${fileName}_part${index + 1}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const switchPart = (index: number) => {
    setCurrentPartIndex(index);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
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
      audioParts.forEach(part => URL.revokeObjectURL(part.url));
    };
  }, [audioParts]);

  useEffect(() => {
    if (audioParts.length > 0 && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
    }
  }, [currentPartIndex, audioParts]);

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
            <Mic2 size={14} />
            AI BLOG RADIO
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
            Blog Radio AI
          </h1>
          <p className="text-zinc-400 text-base max-w-xl mx-auto">
            Lắng nghe những câu chuyện đời thường, những tâm sự sâu lắng qua giọng đọc AI truyền cảm.
          </p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300">
            {error}
          </div>
        )}

        {/* Search Section */}
        <div className="space-y-6 mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus-within:border-emerald-500/50 transition-all shadow-2xl backdrop-blur-xl">
              <div className="pl-4 text-zinc-500">
                <Film size={20} />
              </div>
              <input 
                type="text" 
                placeholder="Nhập tiêu đề câu chuyện bạn muốn kể..."
                className="flex-1 bg-transparent border-none outline-none py-3 text-base placeholder:text-zinc-600"
                value={movieName}
                onChange={(e) => setMovieName(e.target.value)}
              />
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
              onClick={generateStoryFromTitle}
              disabled={randomLoading}
              className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-blue-500/30"
            >
              {randomLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Tạo Truyện
            </button>
            <button 
              onClick={() => generateTTS(movieContent)}
              disabled={ttsLoading || !movieContent.trim()}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
            >
              {ttsLoading ? <Loader2 className="animate-spin" size={16} /> : <Mic2 size={16} />}
              Tạo Voice
            </button>
          </div>
        </div>

        {/* Audio Player UI (Global) */}
        {audioParts.length > 0 && (
          <div className="mb-12 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Danh sách phần</h3>
              <button 
                onClick={() => audioParts.forEach((_, i) => downloadAudio(i))}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black text-[10px] font-bold uppercase tracking-wider transition-all border border-emerald-500/20"
              >
                <Download size={12} />
                Tải tất cả
              </button>
            </div>
            {/* Parts List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {audioParts.map((part, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                    currentPartIndex === idx 
                      ? "bg-emerald-500/20 border-emerald-500/40 shadow-lg shadow-emerald-500/10" 
                      : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                  )}
                  onClick={() => switchPart(idx)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      currentPartIndex === idx ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400"
                    )}>
                      {idx + 1}
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      currentPartIndex === idx ? "text-emerald-400" : "text-zinc-400"
                    )}>
                      {part.title}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAudio(idx);
                    }}
                    className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-emerald-500 hover:text-black transition-all shadow-sm"
                    title="Tải về phần này"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Main Player */}
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center gap-5 backdrop-blur-xl shadow-2xl shadow-emerald-900/20">
              <button 
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/40 shrink-0"
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Volume2 size={16} />
                    {audioParts[currentPartIndex].title}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadAudio(currentPartIndex)}
                      className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/30"
                      title="Tải về phần hiện tại"
                    >
                      <Download size={14} />
                    </button>
                    <span className="text-zinc-500 text-[10px] uppercase font-bold">Đang phát phần {currentPartIndex + 1}/3</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400/70 text-xs font-mono w-10">
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex-1 relative group h-6 flex items-center">
                    <input 
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      className="absolute inset-0 w-full h-1.5 bg-zinc-800/50 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all z-10"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(currentTime / (duration || 1)) * 100}%, #27272a 0%)`
                      }}
                    />
                  </div>
                  <span className="text-emerald-400/70 text-xs font-mono w-10 text-right">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
              
              <audio 
                ref={audioRef} 
                src={audioParts[currentPartIndex].url} 
                onEnded={() => {
                  if (currentPartIndex < audioParts.length - 1) {
                    switchPart(currentPartIndex + 1);
                  } else {
                    setIsPlaying(false);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                className="hidden"
              />
            </div>
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
        <p>© 2026 Blog Radio AI. Powered by Gemini Flash 2.5 & 3.1</p>
      </footer>
    </div>
  );
}
